import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv(Path(__file__).parent / ".env")


def get_connection(admin=False):
    # normal requests use ott_user, admin routes use ott_admin
    prefix = "ADMIN_DB" if admin else "DB"
    try:
        return mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv(prefix + "_USER", "ott_admin" if admin else "ott_user"),
            password=os.getenv(prefix + "_PASSWORD", ""),
            database=os.getenv("DB_NAME", "OTT_Content_Management"),
        )
    except mysql.connector.Error:
        raise HTTPException(status_code=503, detail="Cannot connect to the database")


def db_error(e):
    # Trigger rules (error 1644) become clean 400 errors
    if e.errno == 1644:
        raise HTTPException(status_code=400, detail=e.msg)
    if e.errno == 1062:
        raise HTTPException(status_code=400, detail="That value already exists (duplicate email or phone)")
    if e.errno == 1142:
        raise HTTPException(status_code=500, detail="The database account is not allowed to do this")
    if e.errno == 1451 or e.errno == 1452:
        raise HTTPException(status_code=400, detail="This record is linked to other records")
    raise HTTPException(status_code=500, detail="Database error")


def query(sql, params=(), admin=False):
    conn = get_connection(admin)
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        return cur.fetchall()
    except mysql.connector.Error as e:
        db_error(e)
    finally:
        conn.close()


def execute(sql, params=(), admin=False):
    conn = get_connection(admin)
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        return cur.lastrowid
    except mysql.connector.Error as e:
        db_error(e)
    finally:
        conn.close()


if __name__ == "__main__":
    print(query("SELECT CURRENT_USER() AS account, COUNT(*) AS users FROM Users"))
    print(query("SELECT CURRENT_USER() AS account, COUNT(*) AS users FROM Users", admin=True))