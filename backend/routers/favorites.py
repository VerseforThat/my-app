import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends

from core.db import db
from core.models import VerseMatch, FavoriteCreate
from core.security import get_current_user

router = APIRouter(tags=['favorites'])


@router.get('/history', response_model=List[VerseMatch])
async def get_history(current_user: dict = Depends(get_current_user)):
    cursor = db.verse_matches.find(
        {'user_id': current_user['id']},
        {'_id': 0, 'user_id': 0, 'translation': 0},
    ).sort('created_at', -1).limit(100)
    items = await cursor.to_list(length=100)
    return [VerseMatch(**i) for i in items]


@router.post('/favorites', response_model=VerseMatch)
async def add_favorite(
    payload: FavoriteCreate,
    current_user: dict = Depends(get_current_user),
):
    match = await db.verse_matches.find_one(
        {'id': payload.match_id, 'user_id': current_user['id']},
        {'_id': 0, 'user_id': 0, 'translation': 0},
    )
    if not match:
        raise HTTPException(status_code=404, detail='Verse not found')
    existing = await db.favorites.find_one(
        {'user_id': current_user['id'], 'match_id': payload.match_id}
    )
    if not existing:
        await db.favorites.insert_one({
            'id': str(uuid.uuid4()),
            'user_id': current_user['id'],
            'match_id': payload.match_id,
            'created_at': datetime.now(timezone.utc).isoformat(),
        })
    return VerseMatch(**match)


@router.get('/favorites', response_model=List[VerseMatch])
async def list_favorites(current_user: dict = Depends(get_current_user)):
    favs = await db.favorites.find(
        {'user_id': current_user['id']}, {'_id': 0}
    ).sort('created_at', -1).to_list(200)
    match_ids = [f['match_id'] for f in favs]
    if not match_ids:
        return []
    cursor = db.verse_matches.find(
        {'id': {'$in': match_ids}, 'user_id': current_user['id']},
        {'_id': 0, 'user_id': 0, 'translation': 0},
    )
    items = await cursor.to_list(length=200)
    by_id = {i['id']: i for i in items}
    ordered = [by_id[m] for m in match_ids if m in by_id]
    return [VerseMatch(**i) for i in ordered]


@router.delete('/favorites/{match_id}')
async def remove_favorite(match_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.favorites.delete_one(
        {'user_id': current_user['id'], 'match_id': match_id}
    )
    return {'deleted': result.deleted_count}
