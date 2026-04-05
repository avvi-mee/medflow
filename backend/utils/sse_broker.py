"""In-memory asyncio.Queue pub/sub per test_id — no Redis needed."""
import asyncio
import json
from typing import Dict, Any, AsyncGenerator


# Maps test_id → list of subscriber queues
_subscribers: Dict[str, list[asyncio.Queue]] = {}


def subscribe(test_id: str) -> asyncio.Queue:
    """Create and register a new subscriber queue for a test_id."""
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.setdefault(test_id, []).append(q)
    return q


def unsubscribe(test_id: str, q: asyncio.Queue) -> None:
    """Remove a subscriber queue."""
    subs = _subscribers.get(test_id, [])
    if q in subs:
        subs.remove(q)
    if not subs:
        _subscribers.pop(test_id, None)


async def publish(test_id: str, event_type: str, data: Dict[str, Any]) -> None:
    """Publish an event to all subscribers of a test_id."""
    payload = {"event": event_type, "data": data}
    for q in list(_subscribers.get(test_id, [])):
        await q.put(payload)


async def event_stream(test_id: str) -> AsyncGenerator[str, None]:
    """SSE generator — yields formatted SSE strings."""
    q = subscribe(test_id)
    try:
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=30.0)
            except asyncio.TimeoutError:
                yield "event: ping\ndata: {}\n\n"
                continue

            event_type = payload.get("event", "message")
            data = json.dumps(payload.get("data", {}))
            yield f"event: {event_type}\ndata: {data}\n\n"

            # Stop streaming when pipeline is complete or errored
            if event_type in ("pipeline_complete", "pipeline_error"):
                break
    finally:
        unsubscribe(test_id, q)
