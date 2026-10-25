import mysql.connector
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import db_error, get_connection, query
from schemas import ProgressIn
from subscriptions import current_subscription

router = APIRouter(prefix="/watch", tags=["Watch History"])

ACCESS_SQL = """
SELECT s.Subscription_ID
FROM Subscriptions s
JOIN Subscription_Plans p ON p.Plan_ID = s.Plan_ID
JOIN Content c ON c.Content_ID = %s
WHERE s.User_ID = %s
  AND s.Status = 'Active'
  AND CURDATE() BETWEEN s.Start_Date AND s.End_Date
  AND (p.Access_Type = 'All' OR c.Type IN ('Movies', 'Series'))
"""


def get_content(content_id):
    rows = query("SELECT Content_ID, Title, Type FROM Content WHERE Content_ID = %s", (content_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Content not found")
    return rows[0]


def check_access(user_id, content):
    if query(ACCESS_SQL, (content["Content_ID"], user_id)):
        return {"allowed": True}

    sub = current_subscription(user_id)
    if sub["Is_Valid"]:
        return {
            "allowed": False,
            "reason": "category_not_included",
            "message": f"Your {sub['Plan_Name']} plan covers Movies and Series only. "
            f"{content['Type']} is included in All Access plans.",
        }
    if sub["State"] == "expired":
        return {
            "allowed": False,
            "reason": "expired",
            "message": "Your subscription has expired. Renew now to continue watching.",
        }
    return {
        "allowed": False,
        "reason": "no_subscription",
        "message": "You have no active plan. Choose a plan to start watching.",
    }


@router.get("/access/{content_id}")
def watch_access(content_id: int, current=Depends(get_current_user)):
    content = get_content(content_id)
    result = check_access(current["user_id"], content)
    result["content_id"] = content["Content_ID"]
    result["title"] = content["Title"]

    if result["allowed"]:
        rows = query(
            "SELECT Progress FROM Watch_History WHERE User_ID = %s AND Content_ID = %s "
            "ORDER BY Watched_At DESC, History_ID DESC LIMIT 1",
            (current["user_id"], content_id),
        )
        progress = rows[0]["Progress"] if rows else 0
        result["resume_from"] = progress if progress < 100 else 0
    return result


@router.post("/progress")
def save_progress(data: ProgressIn, current=Depends(get_current_user)):
    user_id = current["user_id"]
    content = get_content(data.content_id)

    result = check_access(user_id, content)
    if not result["allowed"]:
        raise HTTPException(status_code=403, detail=result["message"])

    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT History_ID FROM Watch_History WHERE User_ID = %s AND Content_ID = %s "
            "ORDER BY Watched_At DESC, History_ID DESC LIMIT 1",
            (user_id, data.content_id),
        )
        old = cur.fetchone()
        if old:
            history_id = old["History_ID"]
            cur.execute(
                "UPDATE Watch_History SET Progress = GREATEST(Progress, %s), Watched_At = NOW() "
                "WHERE History_ID = %s",
                (data.progress, history_id),
            )
        else:
            cur.execute(
                "INSERT INTO Watch_History (User_ID, Content_ID, Watched_At, Progress) "
                "VALUES (%s, %s, NOW(), %s)",
                (user_id, data.content_id, data.progress),
            )
            history_id = cur.lastrowid
        conn.commit()
    except mysql.connector.Error as e:
        conn.rollback()
        db_error(e)
    finally:
        conn.close()

    return query(
        "SELECT History_ID, Content_ID, Watched_At, Progress, Completed "
        "FROM Watch_History WHERE History_ID = %s",
        (history_id,),
    )[0]


@router.get("/history")
def my_history(current=Depends(get_current_user)):
    return query(
        "SELECT h.History_ID, h.Content_ID, c.Title, c.Type, c.Language, "
        "h.Watched_At, h.Progress, h.Completed "
        "FROM Watch_History h JOIN Content c ON c.Content_ID = h.Content_ID "
        "WHERE h.User_ID = %s ORDER BY h.Watched_At DESC, h.History_ID DESC",
        (current["user_id"],),
    )


@router.get("/stats")
def my_stats(current=Depends(get_current_user)):
    row = query(
        "SELECT COUNT(*) AS total_watched, COALESCE(SUM(Completed), 0) AS completed "
        "FROM Watch_History WHERE User_ID = %s",
        (current["user_id"],),
    )[0]
    return {"total_watched": int(row["total_watched"]), "completed": int(row["completed"])}
