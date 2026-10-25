import mysql.connector
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import db_error, get_connection, query
from schemas import SubscribeIn

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

IS_VALID_SQL = "s.Status = 'Active' AND CURDATE() BETWEEN s.Start_Date AND s.End_Date"

STATE_SQL = """CASE
    WHEN s.Status = 'Cancelled' THEN 'cancelled'
    WHEN s.Status = 'Expired' OR CURDATE() > s.End_Date THEN 'expired'
    WHEN CURDATE() < s.Start_Date THEN 'upcoming'
    WHEN DATEDIFF(s.End_Date, CURDATE()) <= 7 THEN 'expiring'
    ELSE 'active'
END"""

SUBSCRIPTION_SELECT = f"""
SELECT s.Subscription_ID, s.User_ID, s.Plan_ID, p.Plan_Name, p.Access_Type,
       s.Start_Date, s.End_Date, s.Status,
       ({IS_VALID_SQL}) AS Is_Valid, {STATE_SQL} AS State
FROM Subscriptions s
JOIN Subscription_Plans p ON p.Plan_ID = s.Plan_ID
"""


def current_subscription(user_id):
    rows = query(
        SUBSCRIPTION_SELECT
        + " WHERE s.User_ID = %s ORDER BY Is_Valid DESC, s.Start_Date DESC, s.Subscription_ID DESC LIMIT 1",
        (user_id,),
    )
    if not rows:
        return {"State": "none", "Is_Valid": False}
    rows[0]["Is_Valid"] = bool(rows[0]["Is_Valid"])
    return rows[0]


@router.get("/plans")
def list_plans():
    return query(
        "SELECT Plan_ID, Plan_Name, Price, Duration_Months, Video_Quality, Access_Type "
        "FROM Subscription_Plans ORDER BY Price"
    )


@router.get("/me")
def my_subscription(current=Depends(get_current_user)):
    return current_subscription(current["user_id"])


@router.post("/subscribe", status_code=201)
def subscribe(data: SubscribeIn, current=Depends(get_current_user)):
    if current["role"] == "Admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot subscribe")
    user_id = current["user_id"]

    if not query("SELECT User_ID FROM Users WHERE User_ID = %s", (user_id,)):
        raise HTTPException(status_code=401, detail="This account no longer exists")
    if not query("SELECT Plan_ID FROM Subscription_Plans WHERE Plan_ID = %s", (data.plan_id,)):
        raise HTTPException(status_code=404, detail="Plan not found")

    now = current_subscription(user_id)
    if now["Is_Valid"] and now["Plan_ID"] == data.plan_id:
        raise HTTPException(status_code=400, detail="You are already on this plan")

    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT Subscription_ID, CURDATE() <= End_Date AS Not_Ended "
            "FROM Subscriptions WHERE User_ID = %s AND Status = 'Active'",
            (user_id,),
        )
        for row in cur.fetchall():
            new_status = "Cancelled" if row["Not_Ended"] else "Expired"
            cur.execute(
                "UPDATE Subscriptions SET Status = %s WHERE Subscription_ID = %s",
                (new_status, row["Subscription_ID"]),
            )
        cur.execute(
            "INSERT INTO Subscriptions (User_ID, Plan_ID, Start_Date, End_Date, Status) "
            "VALUES (%s, %s, CURDATE(), CURDATE(), 'Active')",
            (user_id, data.plan_id),
        )
        conn.commit()
    except mysql.connector.Error as e:
        conn.rollback()
        db_error(e)
    finally:
        conn.close()

    return current_subscription(user_id)
