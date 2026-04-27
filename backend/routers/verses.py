import uuid
import logging
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends

from core.db import db
from core.models import (
    ProblemRequest, VerseMatch, VerseContext, DeeperExplanation,
    RelatedVerseItem, RelatedVerses, VerseSearchRequest, VerseSearchResponse,
    VerseSearchItem, DailyVerse,
)
from core.security import get_current_user
from core.llm import claude_json
from core.prompts import (
    system_prompt_for, context_prompt_for, deeper_prompt_for,
    related_prompt_for, search_prompt_for, DAILY_VERSE_PROMPT,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=['verses'])


@router.post('/verses/match', response_model=VerseMatch)
async def match_verse(
    payload: ProblemRequest,
    current_user: dict = Depends(get_current_user),
):
    translation = current_user.get('bible_translation', 'NIV')

    # Pull last 10 references this user has already seen so the LLM avoids repeats
    recent = await db.verse_matches.find(
        {'user_id': current_user['id']}, {'_id': 0, 'reference': 1}
    ).sort('created_at', -1).limit(10).to_list(10)
    avoid_refs = [r['reference'] for r in recent if r.get('reference')]

    session_id = f"match-{current_user['id']}-{uuid.uuid4()}"

    try:
        result = await claude_json(
            system_prompt_for(translation, avoid_refs),
            payload.problem,
            session_id=session_id,
        )
        if not all(k in result for k in ('reference', 'verse_text', 'explanation')):
            raise ValueError('Invalid LLM response shape')
    except Exception as e:
        logger.error(f'Verse match failed: {e}')
        raise HTTPException(
            status_code=500,
            detail='Could not match a verse right now. Please try again.',
        )

    match_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        'id': match_id,
        'user_id': current_user['id'],
        'translation': translation,
        'problem': payload.problem,
        'reference': result['reference'],
        'verse_text': result['verse_text'],
        'explanation': result['explanation'],
        'created_at': now,
    }
    await db.verse_matches.insert_one(doc)

    return VerseMatch(
        id=match_id,
        problem=payload.problem,
        reference=result['reference'],
        verse_text=result['verse_text'],
        explanation=result['explanation'],
        created_at=now,
    )


async def _load_match(match_id: str, user_id: str) -> dict:
    match = await db.verse_matches.find_one(
        {'id': match_id, 'user_id': user_id}, {'_id': 0}
    )
    if not match:
        raise HTTPException(status_code=404, detail='Verse not found')
    return match


@router.get('/verses/{match_id}', response_model=VerseMatch)
async def get_verse(match_id: str, current_user: dict = Depends(get_current_user)):
    match = await _load_match(match_id, current_user['id'])
    return VerseMatch(
        id=match['id'],
        problem=match.get('problem', ''),
        reference=match['reference'],
        verse_text=match['verse_text'],
        explanation=match.get('explanation', ''),
        created_at=match['created_at'],
    )


@router.get('/verses/{match_id}/context', response_model=VerseContext)
async def get_verse_context(match_id: str, current_user: dict = Depends(get_current_user)):
    match = await _load_match(match_id, current_user['id'])
    translation = match.get('translation') or current_user.get('bible_translation', 'NIV')
    try:
        result = await claude_json(
            context_prompt_for(translation, match['reference']),
            f"Give me the surrounding context for {match['reference']}.",
            session_id=f"context-{current_user['id']}-{match_id}",
        )
        if not all(k in result for k in ('reference', 'context_text')):
            raise ValueError('Invalid context response')
    except Exception as e:
        logger.error(f'Context fetch failed: {e}')
        raise HTTPException(status_code=500, detail='Could not load context right now.')
    return VerseContext(**result)


@router.get('/verses/{match_id}/explanation', response_model=DeeperExplanation)
async def get_deeper_explanation(match_id: str, current_user: dict = Depends(get_current_user)):
    match = await _load_match(match_id, current_user['id'])
    translation = match.get('translation') or current_user.get('bible_translation', 'NIV')
    try:
        result = await claude_json(
            deeper_prompt_for(translation, match['reference'], match['verse_text'], match.get('problem', '')),
            f"Explain {match['reference']} more deeply.",
            session_id=f"deeper-{current_user['id']}-{match_id}",
        )
        if not all(k in result for k in ('reference', 'explanation')):
            raise ValueError('Invalid deeper-explanation response')
    except Exception as e:
        logger.error(f'Deeper explanation failed: {e}')
        raise HTTPException(status_code=500, detail='Could not load a deeper explanation right now.')
    return DeeperExplanation(**result)


@router.get('/verses/{match_id}/related', response_model=RelatedVerses)
async def get_related_verses(match_id: str, current_user: dict = Depends(get_current_user)):
    match = await _load_match(match_id, current_user['id'])
    translation = match.get('translation') or current_user.get('bible_translation', 'NIV')
    try:
        result = await claude_json(
            related_prompt_for(translation, match['reference'], match.get('problem', '')),
            f"Give me other verses related to {match['reference']}.",
            session_id=f"related-{current_user['id']}-{match_id}-{uuid.uuid4()}",
        )
        items = result.get('items') or []
        cleaned: List[RelatedVerseItem] = []
        for it in items:
            if all(k in it for k in ('reference', 'verse_text', 'note')):
                cleaned.append(RelatedVerseItem(**it))
        if not cleaned:
            raise ValueError('No related items returned')
    except Exception as e:
        logger.error(f'Related verses failed: {e}')
        raise HTTPException(status_code=500, detail='Could not load related verses right now.')
    return RelatedVerses(items=cleaned)


@router.post('/verses/search', response_model=VerseSearchResponse)
async def search_verses(
    payload: VerseSearchRequest,
    current_user: dict = Depends(get_current_user),
):
    translation = current_user.get('bible_translation', 'NIV')
    query = payload.query.strip()
    try:
        result = await claude_json(
            search_prompt_for(translation),
            query,
            session_id=f"search-{current_user['id']}-{uuid.uuid4()}",
        )
        items = result.get('items') or []
        cleaned: List[VerseSearchItem] = []
        for it in items:
            if all(k in it for k in ('reference', 'verse_text', 'note')):
                cleaned.append(VerseSearchItem(**it))
        if not cleaned:
            raise ValueError('Empty result')
    except Exception as e:
        logger.error(f'Verse search failed: {e}')
        raise HTTPException(
            status_code=500,
            detail='Could not search the Bible right now. Please try again.',
        )
    return VerseSearchResponse(query=query, items=cleaned)


@router.get('/daily-verse', response_model=DailyVerse)
async def daily_verse():
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    cached = await db.daily_verses.find_one({'date': today}, {'_id': 0})
    if cached:
        return DailyVerse(**cached)
    try:
        data = await claude_json(
            DAILY_VERSE_PROMPT,
            f"Today is {today}. Give me today's verse.",
            session_id=f'daily-{today}',
        )
        doc = {
            'date': today,
            'reference': data['reference'],
            'verse_text': data['verse_text'],
            'explanation': data['explanation'],
        }
        await db.daily_verses.insert_one(doc.copy())
        return DailyVerse(**doc)
    except Exception as e:
        logger.error(f'Daily verse failed: {e}')
        fallback = {
            'date': today,
            'reference': 'Jeremiah 29:11',
            'verse_text': '"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future."',
            'explanation': "Today, rest in the truth that God's plans for you are full of hope. Whatever uncertainty you face, He goes before you with intention and care.",
        }
        return DailyVerse(**fallback)
