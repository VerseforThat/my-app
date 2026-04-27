import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends

from core.db import db
from core.models import Note, NoteCreate
from core.security import get_current_user

router = APIRouter(tags=['notes'])


@router.post('/notes', response_model=Note)
async def create_note(
    payload: NoteCreate,
    current_user: dict = Depends(get_current_user),
):
    text = (payload.text or '').strip()
    audio = payload.audio_base64
    if not text and not audio:
        raise HTTPException(status_code=400, detail='Note must have text or audio')
    title = (payload.title or text[:60] or 'Voice memo').strip()
    note_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        'id': note_id,
        'user_id': current_user['id'],
        'text': text,
        'audio_base64': audio,
        'title': title,
        'created_at': now,
    }
    await db.notes.insert_one(doc)
    return Note(
        id=note_id, text=text, audio_base64=audio, title=title, created_at=now,
    )


@router.get('/notes', response_model=List[Note])
async def list_notes(current_user: dict = Depends(get_current_user)):
    cursor = db.notes.find(
        {'user_id': current_user['id']},
        {'_id': 0, 'user_id': 0},
    ).sort('created_at', -1).limit(200)
    items = await cursor.to_list(length=200)
    return [Note(**i) for i in items]


@router.delete('/notes/{note_id}')
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.notes.delete_one({'id': note_id, 'user_id': current_user['id']})
    return {'deleted': result.deleted_count}
