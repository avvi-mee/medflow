"""Lab Interpreter Agent — raw values → flagged parameters (LOW/MEDIUM/HIGH/CRITICAL)."""
from typing import Any, Dict, List

from agents.base_agent import BaseAgent
from utils.llm_client import call_llm_json

# ICMR / Indian reference ranges (hardcoded fallback)
ICMR_RANGES = {
    "hemoglobin": {
        "unit": "g/dL",
        "M": {"low_critical": 7.0, "low": 11.0, "high": 17.5, "high_critical": 20.0},
        "F": {"low_critical": 6.0, "low": 10.0, "high": 15.5, "high_critical": 19.0},
        "Other": {"low_critical": 6.5, "low": 10.5, "high": 16.5, "high_critical": 19.5},
        "ref_M": "13.0–17.5", "ref_F": "11.5–15.5", "ref_Other": "12.0–16.5",
    },
    "wbc": {
        "unit": "cells/µL",
        "low_critical": 2000, "low": 4000, "high": 11000, "high_critical": 30000,
        "ref": "4,000–11,000",
    },
    "rbc": {
        "unit": "million/µL",
        "M": {"low_critical": 3.0, "low": 4.5, "high": 5.9, "high_critical": 7.0},
        "F": {"low_critical": 2.5, "low": 3.8, "high": 5.2, "high_critical": 6.5},
        "Other": {"low_critical": 2.8, "low": 4.2, "high": 5.5, "high_critical": 6.8},
        "ref_M": "4.5–5.9", "ref_F": "3.8–5.2", "ref_Other": "4.2–5.5",
    },
    "platelets": {
        "unit": "cells/µL",
        "low_critical": 50000, "low": 150000, "high": 400000, "high_critical": 1000000,
        "ref": "150,000–400,000",
    },
    "hematocrit": {
        "unit": "%",
        "M": {"low_critical": 20, "low": 38, "high": 54, "high_critical": 60},
        "F": {"low_critical": 18, "low": 35, "high": 47, "high_critical": 55},
        "Other": {"low_critical": 19, "low": 36, "high": 50, "high_critical": 57},
        "ref_M": "38–54", "ref_F": "35–47", "ref_Other": "36–50",
    },
    "mcv": {
        "unit": "fL",
        "low_critical": 55, "low": 80, "high": 100, "high_critical": 115,
        "ref": "80–100",
    },
    "mch": {
        "unit": "pg",
        "low_critical": 15, "low": 27, "high": 33, "high_critical": 40,
        "ref": "27–33",
    },
    "mchc": {
        "unit": "g/dL",
        "low_critical": 28, "low": 32, "high": 36, "high_critical": 40,
        "ref": "32–36",
    },
    "glucose": {
        "unit": "mg/dL",
        "low_critical": 50, "low": 70, "high": 140, "high_critical": 400,
        "ref": "70–140 (random)",
    },
    "hba1c": {
        "unit": "%",
        "low_critical": None, "low": None, "high": 5.7, "high_critical": 9.0,
        "ref": "<5.7 (normal)",
    },
    "creatinine": {
        "unit": "mg/dL",
        "M": {"low_critical": None, "low": None, "high": 1.2, "high_critical": 4.0},
        "F": {"low_critical": None, "low": None, "high": 1.0, "high_critical": 3.5},
        "Other": {"low_critical": None, "low": None, "high": 1.1, "high_critical": 3.8},
        "ref_M": "0.7–1.2", "ref_F": "0.5–1.0", "ref_Other": "0.6–1.1",
    },
    "urea": {
        "unit": "mg/dL",
        "low_critical": None, "low": None, "high": 45, "high_critical": 100,
        "ref": "15–45",
    },
    "sodium": {
        "unit": "mEq/L",
        "low_critical": 120, "low": 135, "high": 145, "high_critical": 160,
        "ref": "135–145",
    },
    "potassium": {
        "unit": "mEq/L",
        "low_critical": 2.5, "low": 3.5, "high": 5.0, "high_critical": 6.5,
        "ref": "3.5–5.0",
    },
    "calcium": {
        "unit": "mg/dL",
        "low_critical": 6.5, "low": 8.5, "high": 10.5, "high_critical": 13.0,
        "ref": "8.5–10.5",
    },
    "bilirubin_total": {
        "unit": "mg/dL",
        "low_critical": None, "low": None, "high": 1.2, "high_critical": 5.0,
        "ref": "0.3–1.2",
    },
    "sgot": {
        "unit": "U/L",
        "low_critical": None, "low": None, "high": 40, "high_critical": 200,
        "ref": "10–40",
    },
    "sgpt": {
        "unit": "U/L",
        "low_critical": None, "low": None, "high": 40, "high_critical": 200,
        "ref": "7–40",
    },
    "albumin": {
        "unit": "g/dL",
        "low_critical": 2.0, "low": 3.5, "high": 5.2, "high_critical": None,
        "ref": "3.5–5.2",
    },
    "tsh": {
        "unit": "mIU/L",
        "low_critical": 0.01, "low": 0.4, "high": 4.0, "high_critical": 10.0,
        "ref": "0.4–4.0",
    },
}

SYSTEM_PROMPT = """You are a clinical lab interpreter for Indian hospitals using ICMR/Indian reference ranges.
Analyze blood test values and return a JSON object with this exact structure:
{
  "flags": [
    {
      "parameter": "hemoglobin",
      "value": 7.2,
      "unit": "g/dL",
      "reference_range": "11.5–15.5",
      "severity": "CRITICAL",
      "direction": "LOW"
    }
  ],
  "critical_count": 2,
  "high_count": 1,
  "abnormal_summary": "Brief 1-sentence summary"
}

Severity levels: NORMAL, LOW (mild), MEDIUM (moderate concern), HIGH (significant), CRITICAL (life-threatening)
Direction: HIGH, LOW, or NORMAL

CRITICAL India-specific thresholds to always flag:
- Hemoglobin < 7 g/dL (female) or < 8 g/dL (male) → CRITICAL
- Platelets < 50,000 → CRITICAL (dengue risk)
- Glucose > 400 mg/dL → CRITICAL
- HbA1c > 9% → HIGH (uncontrolled diabetes)
- WBC > 30,000 → CRITICAL (sepsis)
- Sodium < 120 mEq/L → CRITICAL

Return ONLY valid JSON. No extra text."""


class LabInterpreterAgent(BaseAgent):
    name = "lab_interpreter"
    display_name = "Lab Interpreter"

    async def execute(self, raw_values: Dict[str, Any], gender: str = "Other", **kwargs) -> Dict[str, Any]:
        values_text = "\n".join(
            f"- {k}: {v}" for k, v in raw_values.items() if v is not None
        )
        user_prompt = f"Patient gender: {gender}\n\nBlood test values:\n{values_text}"

        result = await call_llm_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.1,
        )
        return result

    async def fallback(self, raw_values: Dict[str, Any], gender: str = "Other", **kwargs) -> Dict[str, Any]:
        """Hardcoded ICMR reference range fallback."""
        flags = []
        gender = gender if gender in ("M", "F") else "Other"

        for param, value in raw_values.items():
            if value is None or param not in ICMR_RANGES:
                continue

            ranges = ICMR_RANGES[param]
            unit = ranges.get("unit", "")

            # Get gender-specific ranges if available
            if f"low_{gender}" in ranges or f"ref_{gender}" in ranges:
                r = ranges.get(gender, {})
                ref = ranges.get(f"ref_{gender}", "N/A")
                low_crit = r.get("low_critical")
                low = r.get("low")
                high = r.get("high")
                high_crit = r.get("high_critical")
            else:
                ref = ranges.get("ref", "N/A")
                low_crit = ranges.get("low_critical")
                low = ranges.get("low")
                high = ranges.get("high")
                high_crit = ranges.get("high_critical")

            severity = "NORMAL"
            direction = "NORMAL"

            if high_crit is not None and value > high_crit:
                severity, direction = "CRITICAL", "HIGH"
            elif high is not None and value > high:
                severity, direction = "HIGH", "HIGH"
            elif low_crit is not None and value < low_crit:
                severity, direction = "CRITICAL", "LOW"
            elif low is not None and value < low:
                severity, direction = "HIGH", "LOW"

            if severity != "NORMAL":
                flags.append({
                    "parameter": param,
                    "value": value,
                    "unit": unit,
                    "reference_range": ref,
                    "severity": severity,
                    "direction": direction,
                })

        critical_count = sum(1 for f in flags if f["severity"] == "CRITICAL")
        high_count = sum(1 for f in flags if f["severity"] == "HIGH")

        return {
            "flags": flags,
            "critical_count": critical_count,
            "high_count": high_count,
            "abnormal_summary": f"{len(flags)} abnormal values detected via ICMR reference ranges (LLM fallback).",
            "note": "Generated using hardcoded ICMR thresholds (LLM unavailable).",
        }
