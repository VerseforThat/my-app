"""Verse for That — FastAPI entrypoint.

This file only wires together routers, middleware, and lifecycle hooks.
Domain logic lives in `core/` (db, security, llm, models, prompts) and
each feature has its own router under `routers/` (auth, verses, favorites, tts).
"""
import logging

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

# Loads .env early via core.config side-effects
from core import db as core_db
from routers import auth as auth_router
from routers import verses as verses_router
from routers import favorites as favorites_router
from routers import tts as tts_router

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


app = FastAPI(title='Verse for That API')

# Single /api prefix that fronts every router (matches Kubernetes ingress rules)
api_router = APIRouter(prefix='/api')


@api_router.get('/')
async def root():
    return {'message': 'Verse for That API', 'status': 'ok'}


api_router.include_router(auth_router.router)
api_router.include_router(verses_router.router)
api_router.include_router(favorites_router.router)
api_router.include_router(tts_router.router)

app.include_router(api_router)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.on_event('startup')
async def on_startup():
    await core_db.ensure_indexes()
    logger.info('MongoDB indexes ready')


@app.on_event('shutdown')
async def on_shutdown():
    core_db.close()
