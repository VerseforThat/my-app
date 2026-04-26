from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def ensure_indexes() -> None:
    await db.users.create_index('email', unique=True)
    await db.verse_matches.create_index([('user_id', 1), ('created_at', -1)])
    await db.favorites.create_index([('user_id', 1), ('match_id', 1)], unique=True)
    await db.daily_verses.create_index('date', unique=True)


def close() -> None:
    client.close()
