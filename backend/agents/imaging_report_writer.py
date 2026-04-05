"""ImagingReportWriter — writes a clean doctor-friendly AI summary of imaging results."""
from typing import Any, Dict, List
from agents.base_agent import BaseAgent
from utils.llm_client import call_llm


class ImagingReportWriterAgent(BaseAgent):
    name = "imaging_report_writer"
    display_name = "Report Composer"

    async def execute(self, **kwargs) -> Dict[str, Any]:
        department: str = kwargs["department"]
        patient_name: str = kwargs.get("patient_name", "Patient")
        patient_age: int = kwargs.get("patient_age", 30)
        patient_gender: str = kwargs.get("patient_gender", "Unknown")
        findings: List[Dict] = kwargs.get("findings", [])
        impression: str = kwargs.get("impression", "")
        recommendations: List[str] = kwargs.get("recommendations", [])
        correlations: List[Dict] = kwargs.get("correlations", [])
        differential_diagnoses: List[Dict] = kwargs.get("differential_diagnoses", [])
        overall_concern: str = kwargs.get("overall_concern", "LOW")
        urgency: str = kwargs.get("urgency", "ROUTINE")

        system_prompt = """You are a senior physician AI writing a clinical summary for a doctor in an Indian hospital.
Write a clear, professional 200-250 word summary of the imaging/department report.
Use plain English. Include key findings, clinical correlations, and actionable recommendations.
Always end with: 'AI SUGGESTED — DOCTOR MUST VERIFY.'
Do NOT add any JSON or formatting codes — plain paragraph text only."""

        diff_text = "\n".join([f"- {d['diagnosis']} ({int(d['confidence']*100)}%)" for d in differential_diagnoses[:3]])
        corr_text = "\n".join([f"- {c['finding']} [{c['concern_level']}]: {c['clinical_significance']}" for c in correlations[:3]])
        rec_text = "\n".join([f"- {r}" for r in recommendations[:4]])
        findings_text = "\n".join([f"- {f.get('structure','')}: {f.get('observation','')} [{f.get('significance','')}]" for f in findings])

        user_prompt = f"""Patient: {patient_name}, {patient_gender}, Age {patient_age}
Department: {department}
Urgency: {urgency} | Overall Concern: {overall_concern}

Key Findings:
{findings_text}

Impression: {impression}

Clinical Correlations:
{corr_text if corr_text else 'None identified'}

Differential Diagnoses:
{diff_text if diff_text else 'None identified'}

Recommendations:
{rec_text if rec_text else 'Routine follow-up'}

Write the AI clinical summary."""

        report_text = await call_llm(system_prompt, user_prompt, temperature=0.3)
        return {"report_text": report_text.strip()}

    async def fallback(self, **kwargs) -> Dict[str, Any]:
        department = kwargs.get("department", "Imaging")
        return {
            "report_text": (
                f"{department} report received. AI summary generation failed — "
                "manual physician review required. "
                "AI SUGGESTED — DOCTOR MUST VERIFY."
            )
        }
