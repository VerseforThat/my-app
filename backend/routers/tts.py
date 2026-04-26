import base64
import logging
from fastapi import APIRouter, HTTPException, Depends

from elevenlabs import ElevenLabs, VoiceSettings

from core.config import ELEVENLABS_API_KEY, DEFAULT_VOICE_ID
from core.models import TTSRequest, TTSResponse
from core.security import get_current_user

logger = logging.getLogger(__name__)

eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
router = APIRouter(tags=['tts'])


@router.post('/tts/generate', response_model=TTSResponse)
async def generate_tts(
    payload: TTSRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        audio_iter = eleven_client.text_to_speech.convert(
            text=payload.text,
            voice_id=DEFAULT_VOICE_ID,
            model_id='eleven_multilingual_v2',
            output_format='mp3_44100_128',
            voice_settings=VoiceSettings(
                stability=0.6,
                similarity_boost=0.75,
                style=0.2,
                use_speaker_boost=True,
            ),
        )
        audio_bytes = b''.join(audio_iter)
        b64 = base64.b64encode(audio_bytes).decode('utf-8')
        return TTSResponse(audio_base64=b64, mime_type='audio/mpeg')
    except Exception as e:
        logger.error(f'TTS failed: {e}')
        raise HTTPException(status_code=500, detail='Voice generation failed')
