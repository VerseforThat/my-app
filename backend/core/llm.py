import json
import uuid
import logging
from typing import Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage
from core.config import EMERGENT_LLM_KEY, LLM_MODEL

logger = logging.getLogger(__name__)


def strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith('```'):
        text = text.strip('`')
        if text.startswith('json'):
            text = text[4:]
        text = text.strip()
    return text


def _extract_first_json_object(text: str) -> Optional[str]:
    """Find the first balanced {...} block in text."""
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def _try_repair_json(text: str) -> Optional[dict]:
    """Best-effort recovery when Claude emits unescaped " inside string values."""
    block = _extract_first_json_object(text)
    if not block:
        return None
    try:
        return json.loads(block)
    except Exception:
        pass
    try:
        import json_repair  # type: ignore
        repaired = json_repair.loads(block)
        if isinstance(repaired, dict):
            return repaired
    except Exception:
        pass
    # Heuristic: escape stray internal quotes inside string values
    try:
        out = []
        in_str = False
        esc = False
        i = 0
        s = block
        while i < len(s):
            c = s[i]
            if not in_str:
                out.append(c)
                if c == '"':
                    in_str = True
                i += 1
                continue
            if esc:
                out.append(c)
                esc = False
                i += 1
                continue
            if c == '\\':
                out.append(c)
                esc = True
                i += 1
                continue
            if c == '"':
                # closing quote? next non-space char should be , } ] :
                j = i + 1
                while j < len(s) and s[j] in (' ', '\t', '\n', '\r'):
                    j += 1
                if j >= len(s) or s[j] in (',', '}', ']', ':'):
                    out.append(c)
                    in_str = False
                else:
                    out.append('\\"')
                i += 1
                continue
            out.append(c)
            i += 1
        return json.loads(''.join(out))
    except Exception:
        return None


async def claude_json(system_message: str, user_text: str, session_id: str, attempts: int = 2) -> dict:
    """Call Claude and parse JSON robustly. Retries with a fresh session on parse failure."""
    last_err: Optional[Exception] = None
    for n in range(attempts):
        sid = session_id if n == 0 else f'{session_id}-retry-{n}-{uuid.uuid4()}'
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=sid,
            system_message=system_message,
        ).with_model('anthropic', LLM_MODEL)
        try:
            response = await chat.send_message(UserMessage(text=user_text))
        except Exception as e:
            last_err = e
            continue
        cleaned = strip_json_fences(response)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            last_err = e
            repaired = _try_repair_json(response)
            if isinstance(repaired, dict):
                return repaired
            logger.warning(f'Claude JSON parse failed (attempt {n+1}/{attempts}): {e}')
            continue
    raise last_err or RuntimeError('Could not parse LLM JSON')
