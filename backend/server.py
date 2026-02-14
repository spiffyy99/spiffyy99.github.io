from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class GameSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    session_id: str
    key: str
    mode: str  # "number-to-chord", "chord-to-number"
    timer_mode: str  # "untimed", "15", "30", "60"
    score: int
    total_questions: int
    accuracy: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GameSessionCreate(BaseModel):
    session_id: str
    key: str
    mode: str
    timer_mode: str
    score: int
    total_questions: int
    accuracy: float

class KeyStats(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    key: str
    total_games: int
    average_accuracy: float
    best_score: int
    recent_accuracy: float

class OverallStats(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    total_games: int
    overall_accuracy: float
    favorite_key: Optional[str] = None
    key_stats: List[KeyStats]


# API Routes
@api_router.get("/")
async def root():
    return {"message": "Scale Genius API"}

@api_router.post("/game/session")
async def save_game_session(session: GameSessionCreate):
    try:
        # Convert to dict and serialize datetime to ISO string
        session_dict = session.model_dump()
        session_dict['timestamp'] = datetime.now(timezone.utc).isoformat()
        
        await db.game_sessions.insert_one(session_dict)
        return {"status": "success", "message": "Game session saved"}
    except Exception as e:
        logging.error(f"Error saving game session: {e}")
        raise HTTPException(status_code=500, detail="Failed to save game session")

@api_router.get("/game/stats")
async def get_overall_stats():
    try:
        # Get all sessions
        sessions = await db.game_sessions.find({}, {"_id": 0}).to_list(10000)
        
        if not sessions:
            return {
                "total_games": 0,
                "overall_accuracy": 0,
                "favorite_key": None,
                "key_stats": []
            }
        
        # Calculate overall stats
        total_games = len(sessions)
        overall_accuracy = sum(s['accuracy'] for s in sessions) / total_games
        
        # Calculate per-key stats
        key_data = {}
        for session in sessions:
            key = session['key']
            if key not in key_data:
                key_data[key] = {
                    'games': [],
                    'best_score': 0
                }
            key_data[key]['games'].append({
                'accuracy': session['accuracy'],
                'score': session['score']
            })
            if session['score'] > key_data[key]['best_score']:
                key_data[key]['best_score'] = session['score']
        
        # Build key stats
        key_stats = []
        for key, data in key_data.items():
            games = data['games']
            total_key_games = len(games)
            avg_accuracy = sum(g['accuracy'] for g in games) / total_key_games
            
            # Recent accuracy (last 5 games)
            recent_games = sorted(games, key=lambda x: 0)[-5:]
            recent_accuracy = sum(g['accuracy'] for g in recent_games) / len(recent_games)
            
            key_stats.append({
                'key': key,
                'total_games': total_key_games,
                'average_accuracy': round(avg_accuracy, 2),
                'best_score': data['best_score'],
                'recent_accuracy': round(recent_accuracy, 2)
            })
        
        # Sort by total games
        key_stats.sort(key=lambda x: x['total_games'], reverse=True)
        favorite_key = key_stats[0]['key'] if key_stats else None
        
        return {
            "total_games": total_games,
            "overall_accuracy": round(overall_accuracy, 2),
            "favorite_key": favorite_key,
            "key_stats": key_stats
        }
    except Exception as e:
        logging.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stats")

@api_router.get("/game/stats/{key}")
async def get_key_stats(key: str):
    try:
        sessions = await db.game_sessions.find({"key": key}, {"_id": 0}).to_list(1000)
        
        if not sessions:
            return {
                "key": key,
                "total_games": 0,
                "average_accuracy": 0,
                "best_score": 0,
                "recent_accuracy": 0
            }
        
        total_games = len(sessions)
        avg_accuracy = sum(s['accuracy'] for s in sessions) / total_games
        best_score = max(s['score'] for s in sessions)
        
        # Recent accuracy (last 5 games)
        recent_sessions = sessions[-5:] if len(sessions) >= 5 else sessions
        recent_accuracy = sum(s['accuracy'] for s in recent_sessions) / len(recent_sessions)
        
        return {
            "key": key,
            "total_games": total_games,
            "average_accuracy": round(avg_accuracy, 2),
            "best_score": best_score,
            "recent_accuracy": round(recent_accuracy, 2)
        }
    except Exception as e:
        logging.error(f"Error fetching key stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch key stats")

@api_router.get("/game/high-scores")
async def get_high_scores():
    try:
        # Get best score for each key
        sessions = await db.game_sessions.find({}, {"_id": 0}).to_list(10000)
        
        key_best_scores = {}
        for session in sessions:
            key = session['key']
            score = session['score']
            if key not in key_best_scores or score > key_best_scores[key]:
                key_best_scores[key] = score
        
        # Convert to list
        high_scores = [{"key": k, "score": v} for k, v in key_best_scores.items()]
        high_scores.sort(key=lambda x: x['score'], reverse=True)
        
        return {"high_scores": high_scores}
    except Exception as e:
        logging.error(f"Error fetching high scores: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch high scores")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
