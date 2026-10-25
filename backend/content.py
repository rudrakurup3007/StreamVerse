from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import query

router = APIRouter(prefix="/content", tags=["Content"])

CATEGORIES = ["Movies", "Series", "News", "Sports", "Kids"]


@router.get("")
def list_content(
    category: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(get_current_user),
):
    sql = (
        "SELECT Content_ID, Title, Type, Release_Year, Language, Duration_Minutes, Rating "
        "FROM Content WHERE 1 = 1"
    )
    params = []

    if category and category != "All":
        if category not in CATEGORIES:
            raise HTTPException(status_code=400, detail="Unknown category")
        sql += " AND Type = %s"
        params.append(category)

    if search and search.strip():
        text = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        sql += " AND Title LIKE %s"
        params.append("%" + text + "%")

    return query(sql + " ORDER BY Content_ID", tuple(params))
