"""ClinicalCorrelator — correlates imaging findings with patient's blood test data."""
from typing import Any, Dict, List
from agents.base_agent import BaseAgent
from utils.llm_client import call_llm_json


class ClinicalCorrelatorAgent(BaseAgent):
    name = "clinical_correlator"
    display_name = "Clinical Correlator"

    async def execute(self, **kwargs) -> Dict[str, Any]:
        department: str = kwargs["department"]
        findings: List[Dict] = kwargs.get("findings", [])
        impression: str = kwargs.get("impression", "")
        blood_report_summary: str = kwargs.get("blood_report_summary", "No blood test data available.")
        patient_age: int = kwargs.get("patient_age", 30)
        patient_gender: str = kwargs.get("patient_gender", "Unknown")

        system_prompt = """You are a senior physician AI for an Indian hospital.
Correlate imaging/department findings with available blood test data to identify clinical patterns.
Return ONLY valid JSON, no extra text.

Output format:
{
  "correlations": [
    {
      "finding": "imaging finding",
      "blood_marker": "related blood marker if any",
      "clinical_significance": "what this correlation means",
      "concern_level": "LOW|MEDIUM|HIGH|CRITICAL"
    }
  ],
  "differential_diagnoses": [
    {
      "diagnosis": "condition name",
      "confidence": 0.0-1.0,
      "supporting_evidence": ["list of supporting findings"]
    }
  ],
  "overall_concern": "LOW|MEDIUM|HIGH|CRITICAL",
  "correlation_summary": "2-3 sentence clinical correlation summary"
}"""

        findings_text = "\n".join([f"- {f.get('structure','')}: {f.get('observation','')} [{f.get('significance','')}]" for f in findings])

        user_prompt = f"""Department: {department}
Patient: {patient_gender}, Age {patient_age}

Imaging Findings:
{findings_text}
Impression: {impression}

Blood Test Summary:
{blood_report_summary}

Provide clinical correlation."""

        result = await call_llm_json(system_prompt, user_prompt, temperature=0.1)
        return {
            "correlations": result.get("correlations", []),
            "differential_diagnoses": result.get("differential_diagnoses", []),
            "overall_concern": result.get("overall_concern", "LOW"),
            "correlation_summary": result.get("correlation_summary", ""),
        }

    async def fallback(self, **kwargs) -> Dict[str, Any]:
        return {
            "correlations": [],
            "differential_diagnoses": [],
            "overall_concern": "MEDIUM",
            "correlation_summary": "Clinical correlation unavailable — manual physician review required.",
            "manual_review_required": True,
        }
