"""Report Writer Agent — generates plain-English 250-word doctor brief."""
from typing import Any, Dict, List

from agents.base_agent import BaseAgent
from utils.llm_client import call_llm

SYSTEM_PROMPT = """You are a senior physician writing a concise blood test analysis brief for another doctor.
Write a clear, professional summary that:
1. States the most critical findings first
2. Explains likely diagnoses with clinical reasoning
3. Notes significant trends vs previous visits
4. Recommends immediate actions and follow-up tests
5. Uses plain English (no jargon overload)

Format the report with Unicode symbols for WhatsApp compatibility:
- ⚠️ for warnings
- 🔴 for critical findings
- 🟡 for moderate concerns
- 🟢 for normal/improved values
- 📈 for increasing trends
- 📉 for decreasing trends
- ✅ for positive findings

IMPORTANT:
- Target length: ~250 words
- End with: "⚕️ AI SUGGESTED — DOCTOR MUST VERIFY"
- India-specific conditions: consider iron deficiency, B12 deficiency, dengue, typhoid, thalassemia trait
- Write in 2nd person to the reviewing doctor ("The patient presents with...")"""


class ReportWriterAgent(BaseAgent):
    name = "report_writer"
    display_name = "Report Writer"

    async def execute(
        self,
        patient_name: str,
        patient_age: int,
        gender: str,
        flags: List[Dict],
        conditions: List[Dict],
        history_alerts: List[Dict],
        risk_level: str,
        risk_score: int,
        escalation_reason: str = "",
        **kwargs,
    ) -> Dict[str, Any]:
        flags_text = "\n".join(
            f"- {f['parameter']}: {f['value']} {f['unit']} [Ref: {f['reference_range']}] — {f['severity']} {f['direction']}"
            for f in flags
        ) or "All values within normal range."

        conditions_text = "\n".join(
            f"- {c['name']} ({c['confidence']:.0%} confidence): {c.get('recommendation', '')}"
            for c in conditions
        ) or "No specific conditions identified."

        alerts_text = "\n".join(
            f"- {a['parameter']}: {a['trend']} ({a['change_pct']:+.1f}%) — {a.get('clinical_note', '')}"
            for a in history_alerts
        ) or "No previous visit data available."

        user_prompt = (
            f"Patient: {patient_name}, {gender}, Age {patient_age}\n"
            f"Risk Level: {risk_level} (Score: {risk_score}/100)\n\n"
            f"ABNORMAL LAB VALUES:\n{flags_text}\n\n"
            f"SUSPECTED CONDITIONS:\n{conditions_text}\n\n"
            f"HISTORY TRENDS:\n{alerts_text}\n\n"
            f"Key escalation reason: {escalation_reason or 'N/A'}\n\n"
            "Write a ~250-word clinical brief for the reviewing physician."
        )

        report_text = await call_llm(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.3,
            json_mode=False,
            max_tokens=600,
        )

        return {"report_text": report_text}

    async def fallback(
        self,
        patient_name: str,
        patient_age: int,
        gender: str,
        flags: List[Dict],
        conditions: List[Dict],
        history_alerts: List[Dict],
        risk_level: str,
        risk_score: int,
        **kwargs,
    ) -> Dict[str, Any]:
        """Template-filled report as fallback."""
        abnormal = [f for f in flags if f.get("severity") != "NORMAL"]
        critical = [f for f in abnormal if f.get("severity") == "CRITICAL"]

        lines = [
            f"BLOOD TEST ANALYSIS — {patient_name}, {gender}, Age {patient_age}",
            f"Risk Level: {risk_level} (Score: {risk_score}/100)",
            "",
        ]

        if critical:
            lines.append("🔴 CRITICAL FINDINGS:")
            for f in critical:
                lines.append(f"  - {f['parameter'].upper()}: {f['value']} {f['unit']} (Ref: {f.get('reference_range', 'N/A')})")
            lines.append("")

        if abnormal and not critical:
            lines.append("⚠️ ABNORMAL VALUES:")
            for f in abnormal[:5]:
                lines.append(f"  - {f['parameter'].title()}: {f['value']} {f['unit']} [{f['severity']}]")
            lines.append("")

        if conditions:
            lines.append("🔍 SUSPECTED CONDITIONS:")
            for c in conditions[:3]:
                lines.append(f"  - {c['name']}: {c['confidence']:.0%} confidence")
            lines.append("")

        if history_alerts:
            lines.append("📊 TRENDS VS LAST VISIT:")
            for a in history_alerts[:3]:
                lines.append(f"  - {a['parameter'].title()}: {a['trend']} ({a['change_pct']:+.1f}%)")
            lines.append("")

        lines.append("⚠️ NOTE: AI report generation unavailable. This is a template summary.")
        lines.append("Please review raw values directly.")
        lines.append("")
        lines.append("⚕️ AI SUGGESTED — DOCTOR MUST VERIFY")

        return {"report_text": "\n".join(lines)}
