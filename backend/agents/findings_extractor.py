"""FindingsExtractor — extracts structured findings from raw imaging report text."""
from typing import Any, Dict
from agents.base_agent import BaseAgent
from utils.llm_client import call_llm_json


class FindingsExtractorAgent(BaseAgent):
    name = "findings_extractor"
    display_name = "Findings Extractor"

    async def execute(self, **kwargs) -> Dict[str, Any]:
        department: str = kwargs["department"]
        raw_text: str = kwargs["raw_text"]
        patient_age: int = kwargs.get("patient_age", 30)
        patient_gender: str = kwargs.get("patient_gender", "Unknown")

        system_prompt = """You are a radiology AI assistant for an Indian hospital.
Extract structured findings from raw imaging/department report text.
Return ONLY valid JSON, no extra text.

Output format:
{
  "findings": [
    {
      "structure": "organ/region examined",
      "observation": "what was observed",
      "significance": "NORMAL|BORDERLINE|ABNORMAL|CRITICAL",
      "details": "specific measurements or descriptions"
    }
  ],
  "impression": "1-2 sentence overall impression",
  "recommendations": ["list of recommended follow-ups or actions"],
  "urgency": "ROUTINE|URGENT|STAT"
}"""

        user_prompt = f"""Department: {department}
Patient: {patient_gender}, Age {patient_age}
Raw report text:
{raw_text}

Extract all findings in the specified JSON format."""

        result = await call_llm_json(system_prompt, user_prompt, temperature=0.1)
        return {
            "findings": result.get("findings", []),
            "impression": result.get("impression", ""),
            "recommendations": result.get("recommendations", []),
            "urgency": result.get("urgency", "ROUTINE"),
        }

    async def fallback(self, **kwargs) -> Dict[str, Any]:
        return {
            "findings": [],
            "impression": "Manual review required — AI extraction unavailable.",
            "recommendations": ["Consult radiologist directly"],
            "urgency": "ROUTINE",
            "manual_review_required": True,
        }
