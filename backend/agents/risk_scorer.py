"""Risk Scorer Agent — all inputs → GREEN/YELLOW/RED/BLACK + queue number."""
from typing import Any, Dict, List

from agents.base_agent import BaseAgent
from utils.llm_client import call_llm_json

SYSTEM_PROMPT = """You are a clinical risk stratification specialist for Indian hospital triage.
Assign a risk level and queue priority based on lab flags, pattern analysis, and history trends.

Risk levels (from lowest to highest urgency):
- GREEN: Normal or mild abnormalities — routine follow-up
- YELLOW: Moderate concern — needs attention today
- RED: Significant risk — urgent consultation required
- BLACK: Critical/life-threatening — immediate intervention required

MANDATORY BLACK criteria (any one is sufficient):
- Hemoglobin < 6 g/dL
- Platelets < 20,000
- Glucose > 500 mg/dL
- WBC > 50,000 (sepsis)
- Sodium < 115 mEq/L or > 165 mEq/L
- Potassium < 2.5 or > 6.5 mEq/L
- Creatinine > 8 mg/dL (renal failure)

Return JSON:
{
  "level": "RED",
  "score": 75,
  "queue_number": 3,
  "primary_concerns": ["Uncontrolled diabetes", "Severe anemia"],
  "confidence": 0.92,
  "escalation_reason": "HbA1c 9.1% with glucose 320 mg/dL indicates uncontrolled T2DM requiring urgent management",
  "recommended_action": "Immediate endocrinology consult + IV fluid assessment"
}

Score 0-100 (higher = more urgent).
Queue number: BLACK gets 1-5, RED gets 6-20, YELLOW gets 21-50, GREEN gets 51+.
Return ONLY valid JSON. No extra text."""


class RiskScorerAgent(BaseAgent):
    name = "risk_scorer"
    display_name = "Risk Scorer"

    async def execute(
        self,
        flags: List[Dict],
        conditions: List[Dict],
        history_alerts: List[Dict],
        patient_age: int = 30,
        gender: str = "Other",
        **kwargs,
    ) -> Dict[str, Any]:
        flags_text = "\n".join(
            f"- {f['parameter']}: {f['severity']} ({f['direction']})" for f in flags
        ) or "No abnormal flags."

        conditions_text = "\n".join(
            f"- {c['name']}: {c['confidence']:.0%} confidence" for c in conditions
        ) or "No conditions identified."

        alerts_text = "\n".join(
            f"- {a['parameter']}: {a['trend']} ({a['change_pct']:+.1f}%)" for a in history_alerts
        ) or "No history alerts."

        user_prompt = (
            f"Patient: {gender}, age {patient_age}\n\n"
            f"Lab flags:\n{flags_text}\n\n"
            f"Suspected conditions:\n{conditions_text}\n\n"
            f"History alerts:\n{alerts_text}"
        )

        result = await call_llm_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.1,
        )
        return result

    async def fallback(
        self,
        flags: List[Dict],
        conditions: List[Dict],
        history_alerts: List[Dict],
        **kwargs,
    ) -> Dict[str, Any]:
        """Rule-based escalation fallback."""
        critical_flags = [f for f in flags if f.get("severity") == "CRITICAL"]
        high_flags = [f for f in flags if f.get("severity") == "HIGH"]

        if critical_flags:
            level = "BLACK"
            score = 95
            queue_number = 1
        elif len(high_flags) >= 3:
            level = "RED"
            score = 75
            queue_number = 8
        elif high_flags:
            level = "YELLOW"
            score = 45
            queue_number = 25
        else:
            level = "GREEN"
            score = 15
            queue_number = 55

        concerns = [f["parameter"].replace("_", " ").title() for f in (critical_flags or high_flags)[:3]]

        return {
            "level": level,
            "score": score,
            "queue_number": queue_number,
            "primary_concerns": concerns or ["Routine review"],
            "confidence": 0.7,
            "escalation_reason": f"Rule-based escalation: {len(critical_flags)} critical, {len(high_flags)} high flags (LLM fallback).",
            "recommended_action": "Review with attending physician",
        }
