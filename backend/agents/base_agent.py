"""BaseAgent — provides SSE publish + structured error handling for all agents."""
import asyncio
import time
from typing import Any, Dict, Optional

from utils.sse_broker import publish


class AgentError(Exception):
    """Raised when an agent fails and needs manual review fallback."""
    pass


class BaseAgent:
    """Base class for all MedFlow pipeline agents."""

    name: str = "base_agent"
    display_name: str = "Base Agent"

    def __init__(self, test_id: str):
        self.test_id = test_id
        self.start_time: Optional[float] = None
        self.elapsed_ms: Optional[int] = None

    async def _publish(self, event_type: str, data: Dict[str, Any]) -> None:
        """Publish SSE event to all subscribers of this test."""
        await publish(self.test_id, event_type, {
            "agent": self.name,
            "agent_display": self.display_name,
            **data,
        })

    async def run(self, **kwargs) -> Dict[str, Any]:
        """
        Entry point — wraps execute() with timing, SSE events, and error handling.
        Returns result dict or fallback dict on error.
        """
        self.start_time = time.monotonic()

        await self._publish("agent_start", {"status": "running"})

        try:
            result = await self.execute(**kwargs)
            self.elapsed_ms = int((time.monotonic() - self.start_time) * 1000)
            result["elapsed_ms"] = self.elapsed_ms
            result["status"] = "complete"
            await self._publish("agent_complete", {
                "status": "complete",
                "elapsed_ms": self.elapsed_ms,
                "result": result,
            })
            return result

        except Exception as exc:
            self.elapsed_ms = int((time.monotonic() - self.start_time) * 1000)
            error_msg = str(exc)
            await self._publish("agent_error", {
                "status": "error",
                "elapsed_ms": self.elapsed_ms,
                "error": error_msg,
            })
            fallback = await self.fallback(**kwargs)
            fallback["status"] = "fallback"
            fallback["error"] = error_msg
            fallback["elapsed_ms"] = self.elapsed_ms
            return fallback

    async def execute(self, **kwargs) -> Dict[str, Any]:
        """Override in subclass — main agent logic."""
        raise NotImplementedError

    async def fallback(self, **kwargs) -> Dict[str, Any]:
        """Override in subclass — deterministic fallback when LLM fails."""
        return {"manual_review_required": True, "note": f"{self.display_name} unavailable — manual review required."}
