"""History Comparator Agent — today vs last 3 visits → trend alerts."""
from typing import Any, Dict, List

from agents.base_agent import BaseAgent
from utils.llm_client import call_llm_json

SYSTEM_PROMPT = """You are a clinical trend analyst. Compare today's blood test values against previous visit data.
Identify significant trends, deteriorations, and improvements.

Return JSON:
{
  "alerts": [
    {
      "parameter": "hemoglobin",
      "trend": "DETERIORATING",
      "previous_value": 9.5,
      "current_value": 7.2,
      "change_pct": -24.2,
      "alert_level": "HIGH",
      "clinical_note": "Hemoglobin dropped 24% since last visit — treatment response inadequate"
    }
  ],
  "overall_trend": "DETERIORATING",
  "trend_summary": "1-sentence summary",
  "requires_urgent_comparison": false
}

Trend values: IMPROVING, STABLE, DETERIORATING, NEW_FINDING
Alert levels: INFO, LOW, MEDIUM, HIGH, CRITICAL

Clinically significant changes:
- Hemoglobin change > 15% → HIGH
- Platelets drop > 30% → HIGH
- Glucose change > 50 mg/dL → MEDIUM
- HbA1c change > 1% → MEDIUM
- Creatinine rise > 20% → HIGH

Return ONLY valid JSON. No extra text."""


class HistoryComparatorAgent(BaseAgent):
    name = "history_comparator"
    display_name = "History Comparator"

    async def execute(
        self,
        raw_values: Dict[str, Any],
        previous_visits: List[Dict],
        **kwargs,
    ) -> Dict[str, Any]:
        if not previous_visits:
            return {
                "alerts": [],
                "overall_trend": "NO_HISTORY",
                "trend_summary": "No previous visit data available for comparison.",
                "requires_urgent_comparison": False,
            }

        prev_text = "\n".join(
            f"Visit {i+1} ({v.get('visit_date', 'Unknown')}): {v.get('summary_flags', '{}')} | Risk: {v.get('risk_level', 'Unknown')}"
            for i, v in enumerate(previous_visits[:3])
        )
        current_text = "\n".join(
            f"- {k}: {v}" for k, v in raw_values.items() if v is not None
        )

        user_prompt = (
            f"Current test values:\n{current_text}\n\n"
            f"Previous visits (most recent first):\n{prev_text}"
        )

        result = await call_llm_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.1,
        )
        return result

    async def fallback(
        self,
        raw_values: Dict[str, Any],
        previous_visits: List[Dict],
        **kwargs,
    ) -> Dict[str, Any]:
        """Python deterministic diff as fallback."""
        alerts = []

        if not previous_visits:
            return {
                "alerts": [],
                "overall_trend": "NO_HISTORY",
                "trend_summary": "No previous history available.",
                "requires_urgent_comparison": False,
            }

        # Compare with most recent visit
        latest = previous_visits[0]
        prev_flags = {}
        try:
            import json
            prev_flags = json.loads(latest.get("summary_flags", "{}"))
        except Exception:
            pass

        for param, current_val in raw_values.items():
            if current_val is None or param not in prev_flags:
                continue
            prev_val = prev_flags.get(param)
            if prev_val is None or prev_val == 0:
                continue
            change_pct = ((current_val - prev_val) / abs(prev_val)) * 100

            alert_level = "INFO"
            if abs(change_pct) > 30:
                alert_level = "HIGH"
            elif abs(change_pct) > 15:
                alert_level = "MEDIUM"
            elif abs(change_pct) > 5:
                alert_level = "LOW"

            trend = "IMPROVING" if change_pct < 0 and param in ("glucose", "creatinine", "sgpt", "sgot") else (
                "DETERIORATING" if change_pct < 0 else "IMPROVING"
            )

            if alert_level != "INFO":
                alerts.append({
                    "parameter": param,
                    "trend": trend,
                    "previous_value": prev_val,
                    "current_value": current_val,
                    "change_pct": round(change_pct, 1),
                    "alert_level": alert_level,
                    "clinical_note": f"{param} changed {change_pct:+.1f}% since last visit",
                })

        return {
            "alerts": alerts,
            "overall_trend": "DETERIORATING" if any(a["alert_level"] in ("HIGH", "CRITICAL") for a in alerts) else "STABLE",
            "trend_summary": f"{len(alerts)} significant changes vs last visit (deterministic fallback).",
            "requires_urgent_comparison": any(a["alert_level"] in ("HIGH", "CRITICAL") for a in alerts),
        }
