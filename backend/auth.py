import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import execute, query
from schemas import LoginIn, PasswordIn, ProfileIn, SignupIn

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is missing in backend/.env")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "12"))

router = APIRouter(prefix="/auth", tags=["Auth"])
bearer = HTTPBearer(auto_error=False)


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password, hashed):
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user_id, role):
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Please log in first")
    try:
        data = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return {"user_id": int(data["sub"]), "role": data["role"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid login token")


def require_admin(user=Depends(get_current_user)):
    if user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Admin access only")
    return user


def get_user(user_id):
    rows = query(
        "SELECT User_ID, Name, Email, Phone, Role FROM Users WHERE User_ID = %s",
        (user_id,),
    )
    return rows[0] if rows else None


@router.post("/signup", status_code=201)
def signup(data: SignupIn):
    email = data.email.lower()
    if query("SELECT User_ID FROM Users WHERE Email = %s", (email,)):
        raise HTTPException(status_code=400, detail="This email is already registered")
    if query("SELECT User_ID FROM Users WHERE Phone = %s", (data.phone,)):
        raise HTTPException(status_code=400, detail="This phone number is already registered")

    user_id = execute(
        "INSERT INTO Users (Name, Email, Password, Phone, Role) VALUES (%s, %s, %s, %s, 'User')",
        (data.name, email, hash_password(data.password), data.phone),
    )
    return get_user(user_id)


@router.post("/login")
def login(data: LoginIn):
    rows = query(
        "SELECT User_ID, Name, Email, Phone, Role, Password FROM Users WHERE Email = %s",
        (data.email.lower(),),
    )
    if not rows or not verify_password(data.password, rows[0]["Password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    user = rows[0]
    del user["Password"]
    return {"token": create_token(user["User_ID"], user["Role"]), "user": user}


@router.get("/me")
def me(current=Depends(get_current_user)):
    user = get_user(current["user_id"])
    if user is None:
        raise HTTPException(status_code=401, detail="This account no longer exists")
    return user


@router.put("/me")
def update_profile(data: ProfileIn, current=Depends(get_current_user)):
    other = query(
        "SELECT User_ID FROM Users WHERE Phone = %s AND User_ID <> %s",
        (data.phone, current["user_id"]),
    )
    if other:
        raise HTTPException(status_code=400, detail="This phone number is already registered")

    execute(
        "UPDATE Users SET Name = %s, Phone = %s WHERE User_ID = %s",
        (data.name, data.phone, current["user_id"]),
    )
    return get_user(current["user_id"])


@router.put("/password")
def change_password(data: PasswordIn, current=Depends(get_current_user)):
    rows = query("SELECT Password FROM Users WHERE User_ID = %s", (current["user_id"],))
    if not rows or not verify_password(data.old_password, rows[0]["Password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    execute(
        "UPDATE Users SET Password = %s WHERE User_ID = %s",
        (hash_password(data.new_password), current["user_id"]),
    )
    return {"message": "Password changed"}
