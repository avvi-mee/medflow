'use client'

import { useState, useEffect, useRef } from 'react'
import SafetyDisclaimer from './SafetyDisclaimer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Finding {
  structure: string
  observation: string
  significance: 'NORMAL' | 'BORDERLINE' | 'ABNORMAL' | 'CRITICAL'
  details: string
}

interface Differential {
  diagnosis: string
  confidence: number
  evidence: string[]
}

interface ScriptedResult {
  findings: Finding[]
  impression: string
  differentials: Differential[]
  recommendations: string[]
  overall_concern: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  urgency: 'ROUTINE' | 'URGENT' | 'STAT'
  report_text: string
}

// ─── Scripted presets per department ─────────────────────────────────────────

const SCRIPTED: Record<string, ScriptedResult> = {
  XRAY: {
    overall_concern: 'HIGH',
    urgency: 'URGENT',
    impression: 'Right lower lobe opacity with possible consolidation. Cardiomegaly noted.',
    findings: [
      { structure: 'Right Lower Lobe',    observation: 'Homogenous opacity with air bronchograms', significance: 'CRITICAL', details: '~6×4cm consolidation area' },
      { structure: 'Cardiac Silhouette',  observation: 'Enlarged — cardiothoracic ratio >0.55',    significance: 'ABNORMAL', details: 'CTR approximately 0.58' },
      { structure: 'Costophrenic Angles', observation: 'Right angle blunted, possible early effusion', significance: 'ABNORMAL', details: 'Left angle clear' },
      { structure: 'Trachea',             observation: 'Central, no deviation',                    significance: 'NORMAL',   details: '' },
      { structure: 'Bony Thorax',         observation: 'No acute fractures identified',            significance: 'NORMAL',   details: 'Mild degenerative changes at T7-T8' },
    ],
    differentials: [
      { diagnosis: 'Community-acquired Pneumonia',  confidence: 0.82, evidence: ['RLL consolidation', 'air bronchograms', 'fever history'] },
      { diagnosis: 'Congestive Heart Failure',      confidence: 0.61, evidence: ['cardiomegaly', 'blunted right CP angle'] },
      { diagnosis: 'Pulmonary TB (lower lobe)',     confidence: 0.34, evidence: ['consolidation pattern', 'India prevalence'] },
    ],
    recommendations: [
      'Sputum culture and sensitivity for suspected pneumonia',
      'ECG and Echocardiography to evaluate cardiac function',
      'CBC with differential — look for leukocytosis',
      'Repeat CXR after 48–72h antibiotic therapy to monitor resolution',
    ],
    report_text: `X-Ray findings reveal a right lower lobe homogenous opacity with air bronchograms measuring approximately 6×4 cm, consistent with lobar consolidation. This pattern is most consistent with community-acquired pneumonia, with Streptococcus pneumoniae being the most common causative organism in the Indian population.

Cardiomegaly is incidentally noted with a cardiothoracic ratio of approximately 0.58, which warrants further cardiac evaluation. Blunting of the right costophrenic angle suggests early pleural effusion, which may be a parapneumonic effusion or secondary to cardiac failure.

Correlation with the patient's blood tests is recommended. If inflammatory markers (CRP, ESR) and WBC are elevated, empirical antibiotic therapy is strongly indicated. Echocardiography is advised to rule out underlying cardiac pathology contributing to cardiomegaly.

Priority actions: initiate antibiotic therapy, obtain sputum culture, and arrange cardiac evaluation. Repeat imaging in 48–72 hours to assess response to treatment.

AI SUGGESTED — DOCTOR MUST VERIFY.`,
  },

  SONOGRAPHY: {
    overall_concern: 'HIGH',
    urgency: 'URGENT',
    impression: 'Hepatomegaly with diffuse fatty changes. Mild splenomegaly. Gall bladder wall thickening noted.',
    findings: [
      { structure: 'Liver',          observation: 'Enlarged at 17.2 cm with diffuse hyperechogenicity', significance: 'CRITICAL', details: 'Posterior acoustic attenuation — Grade III fatty liver' },
      { structure: 'Gall Bladder',   observation: 'Wall thickening 5.2mm, no calculi, no pericholecystic fluid', significance: 'ABNORMAL', details: 'Fasting state confirmed' },
      { structure: 'Spleen',         observation: 'Mildly enlarged at 13.8 cm, homogenous echotexture', significance: 'ABNORMAL', details: 'Normal: <12 cm' },
      { structure: 'Kidneys',        observation: 'Bilateral — normal size, cortical echogenicity, no hydronephrosis', significance: 'NORMAL', details: 'Right 10.8cm, Left 10.6cm' },
      { structure: 'Pancreas',       observation: 'Body and tail visualized — normal echogenicity, no focal lesion', significance: 'NORMAL', details: 'Head partially obscured by bowel gas' },
      { structure: 'Ascites',        observation: 'No free fluid in peritoneal cavity',                significance: 'NORMAL', details: '' },
    ],
    differentials: [
      { diagnosis: 'Non-Alcoholic Fatty Liver Disease (NAFLD)',  confidence: 0.88, evidence: ['Grade III fatty infiltration', 'hepatomegaly', 'splenomegaly'] },
      { diagnosis: 'Alcoholic Liver Disease',                    confidence: 0.52, evidence: ['hepatomegaly', 'GB wall thickening', 'splenomegaly'] },
      { diagnosis: 'Viral Hepatitis (chronic)',                  confidence: 0.41, evidence: ['hepatosplenomegaly', 'GB wall thickening'] },
    ],
    recommendations: [
      'LFT panel — AST, ALT, ALP, GGT, Bilirubin',
      'Hepatitis B surface antigen and Hepatitis C antibody serology',
      'Lipid profile and HbA1c — assess metabolic syndrome',
      'Fibroscan / Elastography for fibrosis staging',
      'Dietary consultation and lifestyle modification',
    ],
    report_text: `Abdominal sonography reveals Grade III hepatic steatosis with the liver measuring 17.2 cm — significantly above the upper limit of normal. The diffuse hyperechogenicity with posterior acoustic attenuation is characteristic of advanced fatty infiltration, most consistent with Non-Alcoholic Fatty Liver Disease (NAFLD) in the context of the Indian metabolic syndrome epidemic.

Mild splenomegaly at 13.8 cm suggests early portal hypertension or a systemic process such as chronic viral hepatitis. Gall bladder wall thickening of 5.2mm in a fasting patient may indicate cholecystitis or be secondary to hepatic disease and hypoalbuminemia.

Cross-referencing with blood test data: if SGOT/SGPT are elevated (as suspected), this supports hepatocellular injury. If platelets are low, portal hypertension should be strongly considered.

Immediate LFT panel, viral hepatitis serology, and metabolic workup are essential. Elastography to stage fibrosis should follow. Early intervention with lifestyle modification and medical management can halt progression.

AI SUGGESTED — DOCTOR MUST VERIFY.`,
  },

  MRI: {
    overall_concern: 'CRITICAL',
    urgency: 'STAT',
    impression: 'Large disc herniation at L4-L5 with severe canal stenosis. Nerve root compression confirmed.',
    findings: [
      { structure: 'L4-L5 Disc',         observation: 'Large postero-central herniation compressing thecal sac', significance: 'CRITICAL', details: 'Herniation diameter ~11mm, >60% canal compromise' },
      { structure: 'L5-S1 Disc',          observation: 'Moderate disc bulge with mild foraminal narrowing', significance: 'ABNORMAL', details: 'Bilateral neural foramina involved' },
      { structure: 'Spinal Canal',         observation: 'Severe stenosis at L4-L5 level, AP diameter 8mm', significance: 'CRITICAL', details: 'Normal: >12mm' },
      { structure: 'L4/L5 Nerve Roots',   observation: 'Bilateral compression, left > right',               significance: 'CRITICAL', details: 'Perineural edema present' },
      { structure: 'Conus Medullaris',     observation: 'Normal position and signal at T12-L1',              significance: 'NORMAL',   details: '' },
      { structure: 'Vertebral Bodies',     observation: 'Modic Type I changes at L4-L5 endplates',          significance: 'BORDERLINE', details: 'Suggests active inflammatory process' },
    ],
    differentials: [
      { diagnosis: 'Lumbar Disc Herniation with Radiculopathy', confidence: 0.94, evidence: ['L4-L5 herniation', 'nerve root compression', 'canal stenosis'] },
      { diagnosis: 'Lumbar Canal Stenosis (degenerative)',      confidence: 0.78, evidence: ['severe canal compromise 8mm', 'multilevel disc disease'] },
      { diagnosis: 'Cauda Equina Syndrome (early)',             confidence: 0.45, evidence: ['bilateral nerve compression', 'thecal sac compression'] },
    ],
    recommendations: [
      'Urgent neurosurgery / spine surgery consultation',
      'Assess for cauda equina symptoms: bladder/bowel dysfunction, bilateral leg weakness',
      'Pain management: NSAIDs, muscle relaxants, epidural steroid injection consideration',
      'Physiotherapy evaluation post-acute management',
      'Avoid heavy lifting and flexion activities until surgical review',
    ],
    report_text: `MRI lumbosacral spine reveals critical findings requiring urgent surgical attention. A large postero-central disc herniation at L4-L5 measuring 11mm significantly compresses the thecal sac with >60% canal compromise (AP diameter 8mm vs normal >12mm). Bilateral L4 and L5 nerve root compression is confirmed, with left-sided involvement being more severe.

This constellation of findings — severe canal stenosis, bilateral nerve root compression, and thecal sac compromise — raises concern for early Cauda Equina Syndrome. Immediate clinical assessment for bladder/bowel dysfunction, perineal numbness, and bilateral lower limb weakness is mandatory.

The Modic Type I changes at L4-L5 endplates indicate active inflammatory degeneration, suggesting this is a progressive condition. Concomitant L5-S1 disc bulge with foraminal narrowing adds further to the clinical burden.

Urgent neurosurgical referral is recommended. If any cauda equina symptoms are present, this becomes a surgical emergency. Epidural steroid injection may provide temporary relief pending definitive management.

AI SUGGESTED — DOCTOR MUST VERIFY.`,
  },

  CT: {
    overall_concern: 'HIGH',
    urgency: 'URGENT',
    impression: 'Acute appendicitis with periappendiceal fat stranding. No perforation identified.',
    findings: [
      { structure: 'Appendix',              observation: 'Distended, diameter 11mm, wall enhancement', significance: 'CRITICAL', details: 'Normal <6mm; periappendiceal fat stranding present' },
      { structure: 'Periappendiceal Fat',   observation: 'Significant fat stranding in right iliac fossa', significance: 'ABNORMAL', details: 'No free perforation or abscess' },
      { structure: 'Small Bowel',           observation: 'Mild ileus — few dilated loops adjacent to appendix', significance: 'BORDERLINE', details: 'Reactive change' },
      { structure: 'Free Fluid',            observation: 'Trace free fluid in right iliac fossa only', significance: 'BORDERLINE', details: 'No generalized peritoneal fluid' },
      { structure: 'Liver / Spleen',        observation: 'Normal size and attenuation, no focal lesions', significance: 'NORMAL', details: '' },
      { structure: 'Lymph Nodes',           observation: 'Few small mesenteric lymph nodes, largest 9mm', significance: 'BORDERLINE', details: 'Reactive in context' },
    ],
    differentials: [
      { diagnosis: 'Acute Appendicitis',          confidence: 0.91, evidence: ['11mm appendix', 'fat stranding', 'wall enhancement', 'RIF free fluid'] },
      { diagnosis: 'Mesenteric Adenitis',         confidence: 0.28, evidence: ['mesenteric lymphadenopathy', 'no direct appendiceal involvement'] },
      { diagnosis: 'Ovarian Pathology (if female)', confidence: 0.22, evidence: ['RIF location', 'free fluid'] },
    ],
    recommendations: [
      'Urgent surgical consultation — laparoscopic appendicectomy',
      'IV antibiotics: Ceftriaxone + Metronidazole as per protocol',
      'NPO (nil by mouth) immediately',
      'Monitor WBC, CRP trending',
      'Repeat CT if clinical deterioration or if non-operative management chosen',
    ],
    report_text: `CT abdomen and pelvis demonstrates classic features of acute appendicitis. The appendix is distended at 11mm diameter with wall enhancement and significant periappendiceal fat stranding in the right iliac fossa. Critically, no evidence of perforation, abscess formation, or generalized peritonitis is identified at this time.

Trace free fluid confined to the right iliac fossa and reactive mesenteric lymphadenopathy are consistent findings in acute appendicitis. Mild reactive ileus in adjacent small bowel loops is noted.

This is a time-critical diagnosis. The absence of perforation is reassuring but appendicitis can progress to perforation within hours. Cross-referencing with blood tests: leukocytosis with neutrophilia and elevated CRP would support the diagnosis and help stratify severity using scoring systems (Alvarado/RIPASA).

Urgent surgical consultation for laparoscopic appendicectomy is recommended. IV broad-spectrum antibiotic cover should be initiated immediately (Ceftriaxone + Metronidazole). Patient should be kept NPO pending surgical review.

AI SUGGESTED — DOCTOR MUST VERIFY.`,
  },

  ECG: {
    overall_concern: 'CRITICAL',
    urgency: 'STAT',
    impression: 'ST elevation in leads II, III, aVF consistent with acute inferior STEMI. Immediate intervention required.',
    findings: [
      { structure: 'ST Segment (inferior)', observation: 'Significant ST elevation in II, III, aVF — >2mm', significance: 'CRITICAL', details: 'Reciprocal ST depression in I, aVL' },
      { structure: 'Q Waves',               observation: 'Pathological Q waves developing in III, aVF',   significance: 'CRITICAL', details: 'Suggests myocardial necrosis onset' },
      { structure: 'Heart Rate',            observation: 'Bradycardia — 48 bpm, sinus rhythm',           significance: 'ABNORMAL', details: 'Vagal tone increased — inferior MI pattern' },
      { structure: 'PR Interval',           observation: 'First degree AV block — PR 220ms',             significance: 'ABNORMAL', details: 'Normal <200ms; monitor for progression' },
      { structure: 'QRS Complex',           observation: 'Normal width 80ms, no bundle branch block',    significance: 'NORMAL',   details: '' },
      { structure: 'Right-sided leads',     observation: 'V4R with ST elevation — RV involvement',      significance: 'CRITICAL', details: 'Right ventricular infarction suspected' },
    ],
    differentials: [
      { diagnosis: 'Acute Inferior STEMI (RCA territory)', confidence: 0.95, evidence: ['ST elevation II/III/aVF', 'reciprocal changes', 'Q waves', 'V4R elevation'] },
      { diagnosis: 'Right Ventricular Infarction',         confidence: 0.72, evidence: ['V4R ST elevation', 'bradycardia', 'inferior STEMI'] },
      { diagnosis: 'Posterior MI (co-existing)',           confidence: 0.38, evidence: ['reciprocal changes in anterior leads'] },
    ],
    recommendations: [
      'ACTIVATE CATH LAB — Primary PCI target door-to-balloon <90 min',
      'Aspirin 325mg + Clopidogrel/Ticagrelor loading dose immediately',
      'IV heparin anticoagulation',
      'Avoid nitrates — RV infarction suspected (hypotension risk)',
      'Continuous cardiac monitoring, defibrillator on standby',
      'Urgent Troponin I/T, CK-MB, and echocardiography',
    ],
    report_text: `ECG demonstrates critical findings consistent with an acute inferior ST-Elevation Myocardial Infarction (STEMI). ST elevation exceeding 2mm is present in leads II, III, and aVF, with reciprocal ST depression in leads I and aVL, confirming inferior wall ischemia. Pathological Q waves are already developing in leads III and aVF, indicating onset of myocardial necrosis.

Right-sided lead V4R shows ST elevation, strongly suggesting concurrent right ventricular infarction. This is a critical finding — vasodilators (nitrates) are contraindicated as they may precipitate severe hypotension in RV infarction. The patient requires careful volume management.

Sinus bradycardia at 48 bpm with first degree AV block is a classic vagal response to inferior MI (Bezold-Jarisch reflex). Monitor closely for progression to complete heart block, which occurs in 5-10% of inferior STEMI cases.

This is a cardiac emergency. Primary PCI must be initiated immediately — every minute of delay results in additional myocardial loss. Activate the catheterization laboratory protocol now. Dual antiplatelet therapy and anticoagulation must be started without delay.

AI SUGGESTED — DOCTOR MUST VERIFY.`,
  },

  PATHOLOGY: {
    overall_concern: 'HIGH',
    urgency: 'URGENT',
    impression: 'Biopsy findings: moderately differentiated adenocarcinoma. Definitive staging required.',
    findings: [
      { structure: 'Tumor Architecture', observation: 'Glandular formations with back-to-back arrangement',  significance: 'CRITICAL',   details: 'Moderately differentiated (Grade 2)' },
      { structure: 'Cellular Morphology', observation: 'Columnar cells with irregular hyperchromatic nuclei', significance: 'CRITICAL',  details: 'High nuclear-to-cytoplasmic ratio' },
      { structure: 'Invasion',            observation: 'Invasion into muscularis propria identified',         significance: 'CRITICAL',   details: 'Perineural invasion present' },
      { structure: 'Surgical Margins',    observation: 'Margin status: closest margin 1.2mm (posterior)',    significance: 'ABNORMAL',   details: 'Recommend wider excision' },
      { structure: 'Lymphovascular',      observation: 'Lymphovascular invasion present',                    significance: 'CRITICAL',   details: 'Increases staging and recurrence risk' },
      { structure: 'Mitotic Rate',        observation: '8 mitoses per 10 HPF',                              significance: 'ABNORMAL',   details: 'Elevated mitotic activity' },
    ],
    differentials: [
      { diagnosis: 'Moderately Differentiated Adenocarcinoma', confidence: 0.94, evidence: ['glandular architecture', 'invasion', 'nuclear atypia'] },
      { diagnosis: 'Mucinous Adenocarcinoma variant',          confidence: 0.31, evidence: ['mucin production in some areas'] },
      { diagnosis: 'Signet Ring Cell Carcinoma',               confidence: 0.12, evidence: ['few signet ring cells noted peripherally'] },
    ],
    recommendations: [
      'Multidisciplinary tumor board review — urgent',
      'Staging CT chest/abdomen/pelvis for metastasis assessment',
      'IHC panel: CEA, CA19-9, MLH1, MSH2, MSH6, PMS2 (MMR status)',
      'Oncology referral for adjuvant chemotherapy planning',
      'Wide local excision if technically feasible — margins <2mm inadequate',
      'Genetic counseling if Lynch syndrome suspected',
    ],
    report_text: `Histopathological examination of the biopsy specimen reveals a moderately differentiated (Grade 2) adenocarcinoma with a predominantly glandular growth pattern. Columnar cells exhibit irregular, hyperchromatic nuclei with a high nuclear-to-cytoplasmic ratio and an elevated mitotic index of 8 mitoses per 10 high power fields.

Critical findings include invasion into the muscularis propria, perineural invasion, and lymphovascular invasion — all of which are high-risk features that significantly impact staging and treatment planning. The posterior surgical margin is concerning at 1.2mm, falling below the recommended 2mm clear margin threshold.

These findings necessitate urgent multidisciplinary team (MDT) discussion. Staging investigations (CT chest/abdomen/pelvis) are required to assess for regional lymph node involvement and distant metastases. Immunohistochemistry for mismatch repair protein expression (MLH1, MSH2, MSH6, PMS2) is essential to identify patients who may benefit from immunotherapy.

Oncology consultation should be arranged promptly. Adjuvant chemotherapy and possible re-excision for adequate margins should be discussed at the tumor board.

AI SUGGESTED — DOCTOR MUST VERIFY.`,
  },
}

// ─── Department config ────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { id: 'XRAY',       label: 'X-Ray',           code: 'XR', color: 'border-blue-200 bg-blue-50 text-blue-700'       },
  { id: 'SONOGRAPHY', label: 'Sonography',       code: 'US', color: 'border-purple-200 bg-purple-50 text-purple-700' },
  { id: 'MRI',        label: 'MRI',              code: 'MR', color: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  { id: 'CT',         label: 'CT Scan',          code: 'CT', color: 'border-cyan-200 bg-cyan-50 text-cyan-700'       },
  { id: 'ECG',        label: 'ECG / Cardiology', code: 'EC', color: 'border-red-200 bg-red-50 text-red-700'          },
  { id: 'PATHOLOGY',  label: 'Pathology',        code: 'PA', color: 'border-amber-200 bg-amber-50 text-amber-700'    },
]

const CONCERN_STYLE: Record<string, string> = {
  LOW:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM:   'bg-amber-50 text-amber-700 border-amber-200',
  HIGH:     'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
}
const URGENCY_STYLE: Record<string, string> = {
  ROUTINE: 'bg-slate-100 text-slate-600 border-slate-200',
  URGENT:  'bg-orange-50 text-orange-700 border-orange-200',
  STAT:    'bg-red-100 text-red-700 border-red-200',
}
const SIG_STYLE: Record<string, string> = {
  CRITICAL:   'border-red-200 bg-red-50',
  ABNORMAL:   'border-orange-200 bg-orange-50',
  BORDERLINE: 'border-amber-200 bg-amber-50',
  NORMAL:     'border-slate-100 bg-slate-50',
}
const SIG_BADGE: Record<string, string> = {
  CRITICAL:   'bg-red-100 text-red-700 border-red-200',
  ABNORMAL:   'bg-orange-100 text-orange-700 border-orange-200',
  BORDERLINE: 'bg-amber-100 text-amber-700 border-amber-200',
  NORMAL:     'bg-emerald-100 text-emerald-700 border-emerald-200',
}

// ─── Agent pipeline simulation ────────────────────────────────────────────────

const AGENTS = [
  { name: 'findings_extractor',    label: 'Findings Extractor',  desc: 'Parsing report text, extracting structured findings',       ms: 3200 },
  { name: 'clinical_correlator',   label: 'Clinical Correlator', desc: 'Correlating with blood test data, identifying patterns',    ms: 2800 },
  { name: 'imaging_report_writer', label: 'Report Composer',     desc: 'Composing AI clinical summary for doctor review',          ms: 3600 },
]

type AgentStatus = 'pending' | 'running' | 'complete'

function StatusIcon({ status }: { status: AgentStatus }) {
  if (status === 'pending') return (
    <span className="w-5 h-5 rounded-full border-2 border-slate-200 flex-shrink-0" />
  )
  if (status === 'running') return (
    <span className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
  )
  return (
    <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

type Step = 'form' | 'processing' | 'result'

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImagingFlow() {
  const [step, setStep]             = useState<Step>('form')
  const [department, setDepartment] = useState('')
  const [patientName, setPatient]   = useState('')
  const [patientAge, setAge]        = useState('')
  const [rawText, setRawText]       = useState('')
  const [error, setError]           = useState('')

  // Pipeline state
  const [agentStatuses, setStatuses]   = useState<AgentStatus[]>(['pending', 'pending', 'pending'])
  const [agentTimes, setTimes]         = useState<number[]>([0, 0, 0])
  const [elapsed, setElapsed]          = useState(0)
  const [result, setResult]            = useState<ScriptedResult | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedDept = DEPARTMENTS.find(d => d.id === department)

  const handleSubmit = () => {
    if (!department)              { setError('Select a department'); return }
    if (!patientName.trim())      { setError('Patient name is required'); return }
    if (rawText.trim().length < 10) { setError('Enter some report text to analyze'); return }
    setError('')
    setStep('processing')
    runSimulation()
  }

  const runSimulation = () => {
    setStatuses(['pending', 'pending', 'pending'])
    setTimes([0, 0, 0])
    setElapsed(0)

    const start = Date.now()
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)

    // Agent 1
    setTimeout(() => {
      setStatuses(['running', 'pending', 'pending'])
    }, 300)

    setTimeout(() => {
      const t1 = AGENTS[0].ms + Math.floor(Math.random() * 400 - 200)
      setStatuses(['complete', 'pending', 'pending'])
      setTimes(prev => { const n = [...prev]; n[0] = t1; return n })
    }, 300 + AGENTS[0].ms)

    // Agent 2
    const a2start = 300 + AGENTS[0].ms + 400
    setTimeout(() => {
      setStatuses(['complete', 'running', 'pending'])
    }, a2start)

    setTimeout(() => {
      const t2 = AGENTS[1].ms + Math.floor(Math.random() * 400 - 200)
      setStatuses(['complete', 'complete', 'pending'])
      setTimes(prev => { const n = [...prev]; n[1] = t2; return n })
    }, a2start + AGENTS[1].ms)

    // Agent 3
    const a3start = a2start + AGENTS[1].ms + 400
    setTimeout(() => {
      setStatuses(['complete', 'complete', 'running'])
    }, a3start)

    setTimeout(() => {
      const t3 = AGENTS[2].ms + Math.floor(Math.random() * 400 - 200)
      setStatuses(['complete', 'complete', 'complete'])
      setTimes(prev => { const n = [...prev]; n[2] = t3; return n })
      if (timerRef.current) clearInterval(timerRef.current)

      // Show result
      setTimeout(() => {
        const scriptedResult = SCRIPTED[department] ?? SCRIPTED['XRAY']
        setResult(scriptedResult)
        setStep('result')
      }, 600)
    }, a3start + AGENTS[2].ms)
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const handleReset = () => {
    setStep('form'); setDepartment(''); setPatient(''); setAge('')
    setRawText(''); setResult(null); setError('')
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const completedCount = agentStatuses.filter(s => s === 'complete').length
  const totalMs = agentTimes.reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <SafetyDisclaimer />

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Imaging & Diagnostics</h1>
          <p className="text-slate-400 text-sm mt-1">
            Department report analysis — 3 AI agents extract findings and generate clinical summary
          </p>
        </div>

        {/* ── FORM ── */}
        {step === 'form' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">

            {/* Department grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Department *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DEPARTMENTS.map(dept => (
                  <button
                    key={dept.id}
                    onClick={() => setDepartment(dept.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                      department === dept.id ? dept.color + ' border-current' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${department === dept.id ? 'bg-white/60' : 'bg-slate-100'}`}>
                      {dept.code}
                    </span>
                    <span className="text-xs font-semibold leading-tight">{dept.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Patient name + age */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Patient Name *
                </label>
                <input
                  value={patientName}
                  onChange={e => setPatient(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="input-light w-full px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Age
                </label>
                <input
                  type="number"
                  value={patientAge}
                  onChange={e => setAge(e.target.value)}
                  placeholder="35"
                  className="input-light w-full px-4 py-3 text-sm"
                />
              </div>
            </div>

            {/* Report text */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Raw Report / Findings *
              </label>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`Paste the raw ${selectedDept?.label || 'department'} report text here...\n\nExample: Liver enlarged at 16cm with diffuse periportal echogenicity. Gallbladder shows wall thickening of 5mm...`}
                rows={7}
                className="input-light w-full px-4 py-3 text-sm resize-none leading-relaxed"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!department || !patientName || rawText.length < 10}
              className="btn-primary w-full rounded-xl py-3.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Run AI Analysis
            </button>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {step === 'processing' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div>
              {selectedDept && (
                <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-lg border mb-2 ${selectedDept.color}`}>
                  {selectedDept.label}
                </span>
              )}
              <h2 className="text-lg font-bold text-slate-900">3-Agent AI Analysis Running</h2>
              <p className="text-slate-400 text-sm mt-0.5">Agents processing the report in sequence</p>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {completedCount === 3
                    ? 'All agents complete'
                    : `Running agent ${completedCount + 1} of ${AGENTS.length}...`}
                </span>
                <span className="font-mono text-slate-400">{elapsed}s</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-700"
                  style={{ width: `${(completedCount / AGENTS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Agent cards */}
            <div className="space-y-2">
              {AGENTS.map((agent, i) => {
                const status = agentStatuses[i]
                return (
                  <div
                    key={agent.name}
                    className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all duration-300 ${
                      status === 'complete' ? 'border-emerald-200 bg-emerald-50' :
                      status === 'running'  ? 'border-blue-200 bg-blue-50' :
                      'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5"><StatusIcon status={status} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold ${
                          status === 'complete' ? 'text-emerald-700' :
                          status === 'running'  ? 'text-blue-700' :
                          'text-slate-400'
                        }`}>
                          Agent {i + 1} — {agent.label}
                        </span>
                        {status === 'complete' && agentTimes[i] > 0 && (
                          <span className="text-[10px] font-mono text-slate-400">{agentTimes[i]}ms</span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${status === 'running' ? 'text-blue-500' : 'text-slate-400'}`}>
                        {agent.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === 'result' && result && (
          <div className="space-y-4">

            {/* Header */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  {selectedDept && (
                    <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-lg border mb-2 ${selectedDept.color}`}>
                      {selectedDept.label}
                    </span>
                  )}
                  <h2 className="text-xl font-bold text-slate-900">{patientName || 'Patient'}</h2>
                  {patientAge && <p className="text-slate-400 text-sm">Age {patientAge}</p>}
                  <p className="text-slate-400 text-xs mt-1">{result.impression}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${CONCERN_STYLE[result.overall_concern]}`}>
                    {result.overall_concern} CONCERN
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${URGENCY_STYLE[result.urgency]}`}>
                    {result.urgency}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Pipeline: {(totalMs / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>

            {/* Findings */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                Extracted Findings ({result.findings.length})
              </div>
              <div className="space-y-2">
                {result.findings.map((f, i) => (
                  <div key={i} className={`px-4 py-3 rounded-xl border ${SIG_STYLE[f.significance]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-800 text-sm">{f.structure}</span>
                        <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">{f.observation}</p>
                        {f.details && <p className="text-slate-400 text-[11px] mt-0.5 font-mono">{f.details}</p>}
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${SIG_BADGE[f.significance]}`}>
                        {f.significance}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Differentials */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                Differential Diagnoses
              </div>
              <div className="space-y-4">
                {result.differentials.map((d, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-800 text-sm font-semibold">{d.diagnosis}</span>
                      <span className={`text-sm font-bold tabular-nums ${
                        d.confidence >= 0.7 ? 'text-red-600' : d.confidence >= 0.5 ? 'text-amber-600' : 'text-blue-600'
                      }`}>
                        {Math.round(d.confidence * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full progress-bar ${
                          d.confidence >= 0.7 ? 'bg-red-500' : d.confidence >= 0.5 ? 'bg-amber-400' : 'bg-blue-400'
                        }`}
                        style={{ width: `${Math.round(d.confidence * 100)}%` }}
                      />
                    </div>
                    {d.evidence.length > 0 && (
                      <p className="text-[11px] text-slate-400">via: {d.evidence.join(' · ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* AI Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                AI Clinical Summary
              </div>
              <p className="text-slate-700 text-sm leading-7 whitespace-pre-wrap">{result.report_text}</p>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Recommendations
              </div>
              <ul className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-2" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 py-3 text-sm font-semibold transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Report
              </button>
              <button
                onClick={handleReset}
                className="flex-1 bg-white border border-slate-200 rounded-xl py-3 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
              >
                New Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
