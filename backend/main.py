from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import admin
import auth
import content
import subscriptions
import watch_history
from database import query

app = FastAPI(title="StreamVerse API")

origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "null",  # page opened directly from a file
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(subscriptions.router)
app.include_router(content.router)
app.include_router(watch_history.router)
app.include_router(admin.router)


@app.get("/")
def health_check():
    query("SELECT 1")
    return {"status": "ok", "database": "connected"}