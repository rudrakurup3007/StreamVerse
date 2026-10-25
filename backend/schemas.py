import re
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


def check_name(v):
    v = v.strip()
    if len(v) < 2 or len(v) > 100:
        raise ValueError("Name must be 2 to 100 characters")
    return v


def check_phone(v):
    v = v.strip()
    if not re.fullmatch(r"[6-9]\d{9}", v):
        raise ValueError("Enter a 10-digit mobile number")
    return v


def check_password(v):
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(v.encode()) > 72:
        raise ValueError("Password is too long (max 72 bytes)")
    return v


def not_blank(v):
    v = v.strip()
    if not v:
        raise ValueError("This field cannot be empty")
    return v


class SignupIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

    _name = field_validator("name")(check_name)
    _phone = field_validator("phone")(check_phone)
    _password = field_validator("password")(check_password)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SubscribeIn(BaseModel):
    plan_id: int


class ProgressIn(BaseModel):
    content_id: int
    progress: int = Field(ge=0, le=100)


class ProfileIn(BaseModel):
    name: str
    phone: str

    _name = field_validator("name")(check_name)
    _phone = field_validator("phone")(check_phone)


class PasswordIn(BaseModel):
    old_password: str
    new_password: str

    _new = field_validator("new_password")(check_password)


class UserAddIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

    _name = field_validator("name")(check_name)
    _phone = field_validator("phone")(check_phone)
    _password = field_validator("password")(check_password)


class UserEditIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    new_password: Optional[str] = None

    _name = field_validator("name")(check_name)
    _phone = field_validator("phone")(check_phone)

    @field_validator("new_password")
    def _new_password(cls, v):
        return check_password(v) if v else None


class PlanIn(BaseModel):
    plan_name: str = Field(min_length=2, max_length=50)
    price: float = Field(ge=0)
    duration_months: int = Field(gt=0)
    video_quality: str = Field(default="HD", min_length=1, max_length=20)
    access_type: str

    _name = field_validator("plan_name")(not_blank)

    @field_validator("access_type")
    def _access_type(cls, v):
        if v not in ("Limited", "All"):
            raise ValueError("Access type must be Limited or All")
        return v


class ContentIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    type: str
    release_year: int = Field(ge=1901, le=2155)
    language: str = Field(min_length=1, max_length=50)
    duration_minutes: int = Field(gt=0)
    rating: float = Field(ge=0, le=10)

    _title = field_validator("title")(not_blank)
    _language = field_validator("language")(not_blank)

    @field_validator("type")
    def _type(cls, v):
        if v not in ("Movies", "Series", "News", "Sports", "Kids"):
            raise ValueError("Category must be Movies, Series, News, Sports or Kids")
        return v


class SubscriptionEditIn(BaseModel):
    plan_id: int
    status: str

    @field_validator("status")
    def _status(cls, v):
        if v not in ("Active", "Expired", "Cancelled"):
            raise ValueError("Status must be Active, Expired or Cancelled")
        return v