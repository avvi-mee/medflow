"""Pattern Detector Agent — flag combos → suspected conditions + confidence."""
from typing import Any, Dict, List

from agents.base_agent import BaseAgent
from utils.llm_client import call_llm_json

SYSTEM_PROMPT = """You are a clinical pattern recognition specialist for Indian hospitals.
Given blood test flags (abnormal values), identify suspected medical conditions with confidence scores.

Focus heavily on common Indian conditions:
- Iron Deficiency Anemia (low Hb, low MCV, low MCH, low ferritin)
- Vitamin B12/Folate Deficiency (high MCV, neurological symptoms)
- Thalassemia Trait (low MCV, low MCH, normal iron)
- Dengue Fever (thrombocytopenia, low WBC)
- Typhoid (low WBC, relative bradycardia)
- Diabetes Mellitus Type 2 (high glucose, high HbA1c)
- Chronic Kidney Disease (high creatinine, high urea)
- Liver Disease (high bilirubin, high SGOT/SGPT, low albumin)
- Thyroid Disorders (abnormal TSH)
- Sepsis (very high WBC)
- Polycythemia (very high Hb, high RBC)

Return JSON:
{
  "conditions": [
    {
      "name": "Iron Deficiency Anemia",
      "confidence": 0.87,
      "supporting_flags": ["hemoglobin_low", "mcv_low", "mch_low"],
      "severity": "MODERATE",
      "recommendation": "Serum ferritin, iron studies recommended"
    }
  ],
  "dominant_pattern": "hematological",
  "requires_urgent_review": false,
  "pattern_summary": "1-sentence summary"
}

Confidence 0.0–1.0. Only include conditions with confidence > 0.3.
Return ONLY valid JSON. No extra text."""


class PatternDetectorAgent(BaseAgent):
    name = "pattern_detector"
    display_name = "Pattern Detector"

    async def execute(self, flags: List[Dict], raw_values: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        flags_text = "\n".join(
            f"- {f['parameter']}: {f['value']} {f['unit']} [{f['severity']} {f['direction']}]"
            for f in flags
        ) or "No abnormal flags detected."

        user_prompt = f"Abnormal blood test flags:\n{flags_text}"

        result = await call_llm_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.1,
        )
        return result

    async def fallback(self, flags: List[Dict], raw_values: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Return empty conditions list as safe fallback."""
        return {
            "conditions": [],
            "dominant_pattern": "unknown",
            "requires_urgent_review": len([f for f in flags if f.get("severity") == "CRITICAL"]) > 0,
            "pattern_summary": "Pattern detection unavailable — manual review required.",
            "manual_review_required": True,
        }
