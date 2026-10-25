from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from auth import hash_password, require_admin
from database import execute as run_execute, query as run_query
from schemas import ContentIn, PlanIn, SubscriptionEditIn, UserAddIn, UserEditIn
from subscriptions import IS_VALID_SQL, STATE_SQL

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


def query(sql, params=()):
    return run_query(sql, params, admin=True)


def execute(sql, params=()):
    return run_execute(sql, params, admin=True)


STATES = ["active", "expiring", "expired", "cancelled", "upcoming"]


def like(text):
    text = text.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return "%" + text + "%"


def must_exist(sql, params, message):
    if not query(sql, params):
        raise HTTPException(status_code=404, detail=message)


def check_email_phone(email, phone, user_id=0):
    if query("SELECT User_ID FROM Users WHERE Email = %s AND User_ID <> %s", (email, user_id)):
        raise HTTPException(status_code=400, detail="This email is already registered")
    if query("SELECT User_ID FROM Users WHERE Phone = %s AND User_ID <> %s", (phone, user_id)):
        raise HTTPException(status_code=400, detail="This phone number is already registered")


# ---------- Dashboard ----------
@router.get("/dashboard")
def dashboard():
    return query(
        f"""SELECT
        (SELECT COUNT(*) FROM Users WHERE Role = 'User') AS total_users,
        (SELECT COUNT(*) FROM Subscriptions s WHERE {IS_VALID_SQL}) AS active_subscriptions,
        (SELECT COUNT(*) FROM Subscriptions s
          WHERE s.Status <> 'Cancelled' AND (s.Status = 'Expired' OR CURDATE() > s.End_Date)) AS expired_subscriptions,
        (SELECT COUNT(*) FROM Content) AS total_content,
        (SELECT COUNT(*) FROM Watch_History) AS total_watch_history"""
    )[0]


# ---------- Users ----------
@router.get("/users")
def list_users(search: Optional[str] = None):
    sql = f"""SELECT u.User_ID, u.Name, u.Email, u.Phone, u.Role,
        COALESCE((SELECT {STATE_SQL} FROM Subscriptions s WHERE s.User_ID = u.User_ID
                  ORDER BY ({IS_VALID_SQL}) DESC, s.Start_Date DESC, s.Subscription_ID DESC LIMIT 1),
                 'none') AS Subscription_State
        FROM Users u WHERE u.Role = 'User'"""
    params = []
    if search and search.strip():
        sql += " AND (u.Name LIKE %s OR u.Email LIKE %s OR u.Phone LIKE %s)"
        params += [like(search)] * 3
    return query(sql + " ORDER BY u.User_ID", tuple(params))


@router.post("/users", status_code=201)
def add_user(data: UserAddIn):
    email = data.email.lower()
    check_email_phone(email, data.phone)
    user_id = execute(
        "INSERT INTO Users (Name, Email, Password, Phone, Role) VALUES (%s, %s, %s, %s, 'User')",
        (data.name, email, hash_password(data.password), data.phone),
    )
    return query("SELECT User_ID, Name, Email, Phone, Role FROM Users WHERE User_ID = %s", (user_id,))[0]


@router.put("/users/{user_id}")
def edit_user(user_id: int, data: UserEditIn):
    must_exist("SELECT User_ID FROM Users WHERE User_ID = %s AND Role = 'User'", (user_id,), "User not found")
    email = data.email.lower()
    check_email_phone(email, data.phone, user_id)
    execute(
        "UPDATE Users SET Name = %s, Email = %s, Phone = %s WHERE User_ID = %s",
        (data.name, email, data.phone, user_id),
    )
    if data.new_password:
        execute("UPDATE Users SET Password = %s WHERE User_ID = %s", (hash_password(data.new_password), user_id))
    return query("SELECT User_ID, Name, Email, Phone, Role FROM Users WHERE User_ID = %s", (user_id,))[0]


@router.delete("/users/{user_id}")
def delete_user(user_id: int):
    must_exist("SELECT User_ID FROM Users WHERE User_ID = %s AND Role = 'User'", (user_id,), "User not found")
    if query("SELECT 1 FROM Subscriptions WHERE User_ID = %s LIMIT 1", (user_id,)) or query(
        "SELECT 1 FROM Watch_History WHERE User_ID = %s LIMIT 1", (user_id,)
    ):
        raise HTTPException(status_code=400, detail="This user has subscriptions or watch history and cannot be deleted")
    execute("DELETE FROM Users WHERE User_ID = %s", (user_id,))
    return {"message": "User deleted"}


# ---------- Subscription plans ----------
@router.post("/plans", status_code=201)
def add_plan(data: PlanIn):
    plan_id = execute(
        "INSERT INTO Subscription_Plans (Plan_Name, Price, Duration_Months, Video_Quality, Access_Type) "
        "VALUES (%s, %s, %s, %s, %s)",
        (data.plan_name, data.price, data.duration_months, data.video_quality, data.access_type),
    )
    return query("SELECT * FROM Subscription_Plans WHERE Plan_ID = %s", (plan_id,))[0]


@router.put("/plans/{plan_id}")
def edit_plan(plan_id: int, data: PlanIn):
    must_exist("SELECT Plan_ID FROM Subscription_Plans WHERE Plan_ID = %s", (plan_id,), "Plan not found")
    execute(
        "UPDATE Subscription_Plans SET Plan_Name = %s, Price = %s, Duration_Months = %s, "
        "Video_Quality = %s, Access_Type = %s WHERE Plan_ID = %s",
        (data.plan_name, data.price, data.duration_months, data.video_quality, data.access_type, plan_id),
    )
    return query("SELECT * FROM Subscription_Plans WHERE Plan_ID = %s", (plan_id,))[0]


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: int):
    must_exist("SELECT Plan_ID FROM Subscription_Plans WHERE Plan_ID = %s", (plan_id,), "Plan not found")
    if query("SELECT 1 FROM Subscriptions WHERE Plan_ID = %s LIMIT 1", (plan_id,)):
        raise HTTPException(status_code=400, detail="This plan is used by subscriptions and cannot be deleted")
    execute("DELETE FROM Subscription_Plans WHERE Plan_ID = %s", (plan_id,))
    return {"message": "Plan deleted"}


# ---------- Content ----------
@router.post("/content", status_code=201)
def add_content(data: ContentIn):
    content_id = execute(
        "INSERT INTO Content (Title, Type, Release_Year, Language, Duration_Minutes, Rating) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (data.title.strip(), data.type, data.release_year, data.language.strip(), data.duration_minutes, data.rating),
    )
    return query("SELECT * FROM Content WHERE Content_ID = %s", (content_id,))[0]


@router.put("/content/{content_id}")
def edit_content(content_id: int, data: ContentIn):
    must_exist("SELECT Content_ID FROM Content WHERE Content_ID = %s", (content_id,), "Content not found")
    execute(
        "UPDATE Content SET Title = %s, Type = %s, Release_Year = %s, Language = %s, "
        "Duration_Minutes = %s, Rating = %s WHERE Content_ID = %s",
        (data.title.strip(), data.type, data.release_year, data.language.strip(),
         data.duration_minutes, data.rating, content_id),
    )
    return query("SELECT * FROM Content WHERE Content_ID = %s", (content_id,))[0]


@router.delete("/content/{content_id}")
def delete_content(content_id: int):
    must_exist("SELECT Content_ID FROM Content WHERE Content_ID = %s", (content_id,), "Content not found")
    if query("SELECT 1 FROM Watch_History WHERE Content_ID = %s LIMIT 1", (content_id,)):
        raise HTTPException(status_code=400, detail="This content is in users' watch history and cannot be deleted")
    execute("DELETE FROM Content WHERE Content_ID = %s", (content_id,))
    return {"message": "Content deleted"}


# ---------- Subscriptions ----------
@router.get("/subscriptions")
def list_subscriptions(state: Optional[str] = None, search: Optional[str] = None):
    sql = f"""SELECT * FROM (
        SELECT s.Subscription_ID, s.User_ID, u.Name, u.Email, s.Plan_ID, p.Plan_Name,
               s.Start_Date, s.End_Date, s.Status, ({IS_VALID_SQL}) AS Is_Valid, {STATE_SQL} AS State
        FROM Subscriptions s
        JOIN Users u ON u.User_ID = s.User_ID
        JOIN Subscription_Plans p ON p.Plan_ID = s.Plan_ID) t WHERE 1 = 1"""
    params = []
    if state and state != "All":
        if state not in STATES:
            raise HTTPException(status_code=400, detail="Unknown state")
        sql += " AND State = %s"
        params.append(state)
    if search and search.strip():
        sql += " AND (Name LIKE %s OR Email LIKE %s OR Plan_Name LIKE %s)"
        params += [like(search)] * 3
    rows = query(sql + " ORDER BY Start_Date DESC, Subscription_ID DESC", tuple(params))
    for r in rows:
        r["Is_Valid"] = bool(r["Is_Valid"])
    return rows


@router.put("/subscriptions/{subscription_id}")
def edit_subscription(subscription_id: int, data: SubscriptionEditIn):
    must_exist("SELECT Subscription_ID FROM Subscriptions WHERE Subscription_ID = %s", (subscription_id,), "Subscription not found")
    must_exist("SELECT Plan_ID FROM Subscription_Plans WHERE Plan_ID = %s", (data.plan_id,), "Plan not found")
    execute(
        "UPDATE Subscriptions SET Plan_ID = %s, Status = %s WHERE Subscription_ID = %s",
        (data.plan_id, data.status, subscription_id),
    )
    return query(
        "SELECT Subscription_ID, User_ID, Plan_ID, Start_Date, End_Date, Status "
        "FROM Subscriptions WHERE Subscription_ID = %s",
        (subscription_id,),
    )[0]


@router.delete("/subscriptions/{subscription_id}")
def delete_subscription(subscription_id: int):
    must_exist("SELECT Subscription_ID FROM Subscriptions WHERE Subscription_ID = %s", (subscription_id,), "Subscription not found")
    execute("DELETE FROM Subscriptions WHERE Subscription_ID = %s", (subscription_id,))
    return {"message": "Subscription deleted"}


# ---------- Watch history ----------
@router.get("/watch-history")
def list_watch_history(completed: Optional[bool] = None, search: Optional[str] = None):
    sql = """SELECT h.History_ID, h.User_ID, u.Name, u.Email, h.Content_ID, c.Title, c.Type,
                    h.Watched_At, h.Progress, h.Completed
             FROM Watch_History h
             JOIN Users u ON u.User_ID = h.User_ID
             JOIN Content c ON c.Content_ID = h.Content_ID WHERE 1 = 1"""
    params = []
    if completed is not None:
        sql += " AND h.Completed = %s"
        params.append(completed)
    if search and search.strip():
        sql += " AND (u.Name LIKE %s OR u.Email LIKE %s OR c.Title LIKE %s)"
        params += [like(search)] * 3
    return query(sql + " ORDER BY h.Watched_At DESC, h.History_ID DESC", tuple(params))


@router.delete("/watch-history/{history_id}")
def delete_watch_history(history_id: int):
    must_exist("SELECT History_ID FROM Watch_History WHERE History_ID = %s", (history_id,), "Record not found")
    execute("DELETE FROM Watch_History WHERE History_ID = %s", (history_id,))
    return {"message": "Record deleted"}


# ---------- Reports ----------
@router.get("/reports")
def reports():
    counts = {r["Type"]: r["items"] for r in query("SELECT Type, COUNT(*) AS items FROM Content GROUP BY Type")}
    by_category = [{"Type": t, "items": counts.get(t, 0)} for t in ["Movies", "Series", "News", "Sports", "Kids"]]
    most_watched = query(
        "SELECT c.Content_ID, c.Title, c.Type, COUNT(*) AS views FROM Watch_History h "
        "JOIN Content c ON c.Content_ID = h.Content_ID "
        "GROUP BY c.Content_ID, c.Title, c.Type ORDER BY views DESC, c.Title LIMIT 5"
    )
    by_state = query(f"SELECT State, COUNT(*) AS total FROM (SELECT {STATE_SQL} AS State FROM Subscriptions s) t GROUP BY State")
    return {"content_by_category": by_category, "most_watched": most_watched, "subscriptions_by_state": by_state}