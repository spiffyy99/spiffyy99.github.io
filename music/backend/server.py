from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "music_theory")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/game/session")
async def save_session(data: dict):
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.sessions.insert_one(data)
    return {"status": "saved"}

@app.get("/api/game/sessions")
async def get_sessions():
    sessions = []
    cursor = db.sessions.find({}, {"_id": 0}).sort("created_at", -1).limit(50)
    async for s in cursor:
        sessions.append(s)
    return sessions
