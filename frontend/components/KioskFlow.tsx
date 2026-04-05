'use client'

import { useState } from 'react'
import type { BloodValues, RiskLevel } from '@/lib/types'
import { registerPatient, submitTest } from '@/lib/api'
import AgentPipeline from './AgentPipeline'
import QueueTag from './QueueTag'

type Step = 1 | 2 | 3 | 4

const BLOOD_FIELDS: { key: keyof BloodValues; label: string; labelHi: string; unit: string; placeholder: string }[] = [
  { key: 'hemoglobin',      label: 'Hemoglobin',      labelHi: 'हीमोग्लोबिन',      unit: 'g/dL',       placeholder: '12–16'        },
  { key: 'wbc',             label: 'WBC Count',       labelHi: 'श्वेत रक्त कणिका', unit: 'cells/µL',   placeholder: '4000–11000'   },
  { key: 'rbc',             label: 'RBC Count',       labelHi: 'लाल रक्त कणिका',   unit: 'million/µL', placeholder: '4.0–5.5'      },
  { key: 'platelets',       label: 'Platelets',       labelHi: 'प्लेटलेट्स',        unit: 'cells/µL',   placeholder: '150000–400000' },
  { key: 'hematocrit',      label: 'Hematocrit',      labelHi: 'हेमाटोक्रिट',       unit: '%',          placeholder: '36–50'        },
  { key: 'mcv',             label: 'MCV',             labelHi: 'MCV',               unit: 'fL',         placeholder: '80–100'       },
  { key: 'mch',             label: 'MCH',             labelHi: 'MCH',               unit: 'pg',         placeholder: '27–33'        },
  { key: 'mchc',            label: 'MCHC',            labelHi: 'MCHC',              unit: 'g/dL',       placeholder: '32–36'        },
  { key: 'glucose',         label: 'Blood Glucose',   labelHi: 'रक्त शर्करा',       unit: 'mg/dL',      placeholder: '70–140'       },
  { key: 'hba1c',           label: 'HbA1c',           labelHi: 'HbA1c',             unit: '%',          placeholder: '<5.7'         },
  { key: 'creatinine',      label: 'Creatinine',      labelHi: 'क्रिएटिनिन',        unit: 'mg/dL',      placeholder: '0.6–1.2'      },
  { key: 'urea',            label: 'Blood Urea',      labelHi: 'रक्त यूरिया',       unit: 'mg/dL',      placeholder: '15–45'        },
  { key: 'sodium',          label: 'Sodium',          labelHi: 'सोडियम',             unit: 'mEq/L',      placeholder: '135–145'      },
  { key: 'potassium',       label: 'Potassium',       labelHi: 'पोटेशियम',          unit: 'mEq/L',      placeholder: '3.5–5.0'      },
  { key: 'calcium',         label: 'Calcium',         labelHi: 'कैल्शियम',           unit: 'mg/dL',      placeholder: '8.5–10.5'     },
  { key: 'bilirubin_total', label: 'Bilirubin Total', labelHi: 'बिलीरुबिन',         unit: 'mg/dL',      placeholder: '0.3–1.2'      },
  { key: 'sgot',            label: 'SGOT / AST',      labelHi: 'SGOT',              unit: 'U/L',        placeholder: '10–40'        },
  { key: 'sgpt',            label: 'SGPT / ALT',      labelHi: 'SGPT',              unit: 'U/L',        placeholder: '7–40'         },
  { key: 'albumin',         label: 'Albumin',         labelHi: 'एल्बुमिन',           unit: 'g/dL',       placeholder: '3.5–5.2'      },
  { key: 'tsh',             label: 'TSH',             labelHi: 'TSH',               unit: 'mIU/L',      placeholder: '0.4–4.0'      },
]

const LAB_PRESETS: Record<string, { label: string; desc: string; risk: 'critical' | 'high' | 'moderate' | 'normal'; values: Partial<BloodValues> }> = {
  critical: {
    label: 'Critical — Diabetic Anaemia',
    desc:  'Low Hb + high glucose + high HbA1c',
    risk:  'critical',
    values: { hemoglobin: 7.2, wbc: 12000, rbc: 3.1, platelets: 85000, hematocrit: 22, mcv: 71, mch: 23, mchc: 30, glucose: 320, hba1c: 9.1, creatinine: 1.4, urea: 52, sodium: 136, potassium: 3.8, calcium: 8.9, sgot: 42, sgpt: 38, albumin: 3.2, tsh: 2.1 },
  },
  anaemia: {
    label: 'Iron Deficiency Anaemia',
    desc:  'Low Hb + low MCV + low MCH',
    risk:  'moderate',
    values: { hemoglobin: 9.5, wbc: 7200, rbc: 3.6, platelets: 310000, hematocrit: 29, mcv: 68, mch: 22, mchc: 28, glucose: 92, hba1c: 5.1, creatinine: 0.8, urea: 28, sodium: 138, potassium: 4.1, calcium: 9.2, sgot: 22, sgpt: 18, albumin: 3.9, tsh: 1.8 },
  },
  liver: {
    label: 'Liver Disease',
    desc:  'High SGOT/SGPT + high bilirubin',
    risk:  'high',
    values: { hemoglobin: 11.8, wbc: 9800, rbc: 4.1, platelets: 98000, hematocrit: 35, mcv: 88, mch: 29, mchc: 33, glucose: 88, hba1c: 5.3, creatinine: 0.9, urea: 31, sodium: 133, potassium: 3.4, calcium: 8.1, bilirubin_total: 4.2, sgot: 185, sgpt: 210, albumin: 2.8, tsh: 2.4 },
  },
  dengue: {
    label: 'Suspected Dengue',
    desc:  'Very low platelets + low WBC',
    risk:  'high',
    values: { hemoglobin: 13.2, wbc: 2800, rbc: 4.8, platelets: 42000, hematocrit: 40, mcv: 85, mch: 28, mchc: 34, glucose: 95, hba1c: 5.0, creatinine: 1.0, urea: 34, sodium: 137, potassium: 3.9, calcium: 9.0, bilirubin_total: 1.8, sgot: 65, sgpt: 48, albumin: 3.7, tsh: 2.0 },
  },
  normal: {
    label: 'Normal — Healthy',
    desc:  'All values within reference range',
    risk:  'normal',
    values: { hemoglobin: 14.2, wbc: 7800, rbc: 5.0, platelets: 280000, hematocrit: 43, mcv: 88, mch: 29, mchc: 34, glucose: 98, hba1c: 5.4, creatinine: 0.9, urea: 28, sodium: 140, potassium: 4.2, calcium: 9.5, bilirubin_total: 0.7, sgot: 24, sgpt: 22, albumin: 4.2, tsh: 2.1 },
  },
  thyroid: {
    label: 'Hypothyroidism + Anaemia',
    desc:  'High TSH + low Hb + low MCV',
    risk:  'moderate',
    values: { hemoglobin: 10.8, wbc: 6200, rbc: 3.9, platelets: 210000, hematocrit: 32, mcv: 72, mch: 24, mchc: 31, glucose: 105, hba1c: 5.6, creatinine: 0.8, urea: 25, sodium: 135, potassium: 3.7, calcium: 8.8, sgot: 30, sgpt: 25, albumin: 3.8, tsh: 9.8 },
  },
}

const RISK_STYLE: Record<string, string> = {
  critical: 'border-l-4 border-l-red-500 bg-red-50 hover:bg-red-100',
  high:     'border-l-4 border-l-orange-400 bg-orange-50 hover:bg-orange-100',
  moderate: 'border-l-4 border-l-amber-400 bg-amber-50 hover:bg-amber-100',
  normal:   'border-l-4 border-l-emerald-400 bg-emerald-50 hover:bg-emerald-100',
}

const RISK_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border border-red-200',
  high:     'bg-orange-100 text-orange-700 border border-orange-200',
  moderate: 'bg-amber-100 text-amber-700 border border-amber-200',
  normal:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
}

const RISK_LABEL: Record<string, string> = {
  critical: 'CRITICAL', high: 'HIGH', moderate: 'MODERATE', normal: 'NORMAL',
}

const STEP_CFG = [
  { step: 1, label: 'Register',     labelHi: 'पंजीकरण'     },
  { step: 2, label: 'Test Values',  labelHi: 'परीक्षण मान' },
  { step: 3, label: 'AI Analysis',  labelHi: 'AI विश्लेषण' },
  { step: 4, label: 'Your Token',   labelHi: 'आपका टोकन'   },
]

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

export default function KioskFlow() {
  const [step, setStep]           = useState<Step>(1)
  const [lang, setLang]           = useState<'en' | 'hi'>('en')
  const [name, setName]           = useState('')
  const [age, setAge]             = useState('')
  const [gender, setGender]       = useState<'M' | 'F' | 'Other'>('F')
  const [phone, setPhone]         = useState('')
  const [values, setValues]       = useState<Partial<BloodValues>>({})
  const [patientId, setPatientId] = useState('')
  const [testId, setTestId]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState<{ riskLevel: RiskLevel; queueNumber: number; totalMs: number } | null>(null)

  const [autoFilling, setAutoFilling]       = useState(false)
  const [autoFillDone, setAutoFillDone]     = useState(false)
  const [fillingIndex, setFillingIndex]     = useState(-1)
  const [justFilled, setJustFilled]         = useState<Set<string>>(new Set())
  const [showPresets, setShowPresets]       = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  const filledCount = Object.values(values).filter(v => v !== undefined && String(v) !== '').length

  const startAutoFill = async (presetKey: string) => {
    const preset = LAB_PRESETS[presetKey]
    if (!preset) return
    setShowPresets(false)
    setSelectedPreset(presetKey)
    setAutoFilling(true)
    setAutoFillDone(false)
    setValues({})
    setJustFilled(new Set())
    await delay(400)
    const entries = Object.entries(preset.values) as [keyof BloodValues, number][]
    for (let i = 0; i < entries.length; i++) {
      const [key, val] = entries[i]
      setFillingIndex(i)
      await delay(110)
      setValues(prev => ({ ...prev, [key]: val }))
      setJustFilled(prev => new Set([...prev, key]))
      setTimeout(() => setJustFilled(prev => { const n = new Set(prev); n.delete(key); return n }), 1200)
    }
    setFillingIndex(-1)
    setAutoFilling(false)
    setAutoFillDone(true)
  }

  const handleRegister = async () => {
    if (!name.trim() || !age) { setError(lang === 'en' ? 'Name and age are required' : 'नाम और आयु आवश्यक है'); return }
    setLoading(true); setError('')
    try {
      const res = await registerPatient({ name: name.trim(), age: parseInt(age), gender, phone: phone || undefined })
      setPatientId(res.patient_id)
      setStep(2)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Registration failed') }
    finally { setLoading(false) }
  }

  const handleSubmitTest = async () => {
    if (filledCount < 3) { setError(lang === 'en' ? 'Please enter at least 3 values' : 'कम से कम 3 मान दर्ज करें'); return }
    setLoading(true); setError('')
    try {
      const res = await submitTest({ patient_id: patientId, values: values as BloodValues })
      setTestId(res.test_id)
      setStep(3)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Submission failed') }
    finally { setLoading(false) }
  }

  const handleReset = () => {
    setStep(1); setName(''); setAge(''); setPhone(''); setGender('F')
    setValues({}); setPatientId(''); setTestId(''); setResult(null); setError('')
    setAutoFillDone(false); setSelectedPreset(null)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">MedFlow</h1>
            <p className="text-slate-400 text-xs mt-0.5">Patient Blood Test Portal</p>
          </div>
          <button
            onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            {lang === 'en' ? 'हिंदी' : 'English'}
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
          {STEP_CFG.map(s => (
            <div key={s.step} className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all duration-300 gap-0.5
              ${s.step === step ? 'bg-blue-600 text-white' : s.step < step ? 'text-emerald-600' : 'text-slate-300'}`}>
              <span className="text-[10px] font-bold uppercase tracking-wide">
                {s.step < step ? 'Done' : `Step ${s.step}`}
              </span>
              <span className={`text-[11px] font-semibold ${s.step === step ? 'text-blue-100' : ''}`}>
                {lang === 'en' ? s.label : s.labelHi}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">

          {/* Step 1: Register */}
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Patient Registration' : 'रोगी पंजीकरण'}</h2>
                <p className="text-slate-400 text-sm mt-1">{lang === 'en' ? 'Enter your details to get started' : 'शुरू करने के लिए अपना विवरण दर्ज करें'}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                    {lang === 'en' ? 'Full Name' : 'पूरा नाम'} *
                  </label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder={lang === 'en' ? 'Enter full name' : 'पूरा नाम दर्ज करें'}
                    className="input-light w-full rounded-xl px-4 py-3 text-base" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                      {lang === 'en' ? 'Age' : 'आयु'} *
                    </label>
                    <input type="number" value={age} onChange={e => setAge(e.target.value)}
                      placeholder="25" min="1" max="120"
                      className="input-light w-full rounded-xl px-4 py-3 text-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                      {lang === 'en' ? 'Gender' : 'लिंग'}
                    </label>
                    <select value={gender} onChange={e => setGender(e.target.value as 'M' | 'F' | 'Other')}
                      className="input-light w-full rounded-xl px-4 py-3 text-base">
                      <option value="F">Female / महिला</option>
                      <option value="M">Male / पुरुष</option>
                      <option value="Other">Other / अन्य</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                    {lang === 'en' ? 'Phone (optional)' : 'फ़ोन (वैकल्पिक)'}
                  </label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="input-light w-full rounded-xl px-4 py-3 text-base" />
                </div>
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={handleRegister} disabled={loading} className="btn-primary w-full rounded-2xl py-4 text-base">
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {lang === 'en' ? 'Registering...' : 'पंजीकृत हो रहा है...'}
                    </span>
                  : lang === 'en' ? 'Continue' : 'जारी रखें'}
              </button>
            </div>
          )}

          {/* Step 2: Blood Values */}
          {step === 2 && (
            <div className="p-6 space-y-4">

              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {lang === 'en' ? 'Blood Test Values' : 'रक्त परीक्षण मान'}
                  </h2>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {lang === 'en' ? 'Auto-imported or enter manually' : 'स्वचालित या मैन्युअल दर्ज करें'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div className={`text-2xl font-black tabular-nums ${filledCount >= 3 ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {filledCount}
                  </div>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wide">
                    {lang === 'en' ? 'filled' : 'भरे'}
                  </div>
                </div>
              </div>

              {/* Lab machine import */}
              {!autoFillDone ? (
                <div>
                  <button
                    onClick={() => setShowPresets(p => !p)}
                    disabled={autoFilling}
                    className={`w-full rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200 ${
                      autoFilling
                        ? 'border-blue-200 bg-blue-50 cursor-wait'
                        : showPresets
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                        autoFilling ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {autoFilling ? '...' : 'LAB'}
                      </div>
                      <div className="flex-1 min-w-0">
                        {autoFilling ? (
                          <>
                            <div className="text-blue-700 font-bold text-sm flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse inline-block" />
                              {lang === 'en' ? 'Receiving from lab machine...' : 'लैब मशीन से डेटा आ रहा है...'}
                            </div>
                            <div className="text-blue-400 text-xs mt-1">
                              {lang === 'en'
                                ? `Importing parameter ${fillingIndex + 1} of ${BLOOD_FIELDS.length}`
                                : `${fillingIndex + 1}/${BLOOD_FIELDS.length} पैरामीटर`}
                            </div>
                            <div className="mt-2 h-1 bg-blue-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full transition-all duration-100"
                                style={{ width: `${((fillingIndex + 1) / BLOOD_FIELDS.length) * 100}%` }} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-slate-800 font-semibold text-sm">
                              {lang === 'en' ? 'Import from Lab Machine' : 'लैब मशीन से आयात करें'}
                            </div>
                            <div className="text-slate-400 text-xs mt-0.5">
                              {lang === 'en' ? 'Select a sample profile to auto-fill all values' : 'सभी मान भरने के लिए प्रोफ़ाइल चुनें'}
                            </div>
                          </>
                        )}
                      </div>
                      {!autoFilling && (
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${showPresets ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Preset list — inline (not absolute) to avoid overlap */}
                  {showPresets && !autoFilling && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-md">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                          {lang === 'en' ? 'Select Sample Profile' : 'नमूना प्रोफ़ाइल चुनें'}
                        </p>
                      </div>
                      {Object.entries(LAB_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => startAutoFill(key)}
                          className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 transition-all flex items-center justify-between gap-3 ${RISK_STYLE[preset.risk]}`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-800 truncate">{preset.label}</div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">{preset.desc}</div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${RISK_BADGE[preset.risk]}`}>
                            {RISK_LABEL[preset.risk]}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div>
                    <div className="text-emerald-700 text-sm font-bold">
                      {lang === 'en' ? `Lab data imported — ${filledCount} values` : `लैब डेटा आयात हुआ — ${filledCount} मान`}
                    </div>
                    {selectedPreset && (
                      <div className="text-emerald-600 text-xs mt-0.5">{LAB_PRESETS[selectedPreset]?.label}</div>
                    )}
                  </div>
                  <button
                    onClick={() => { setAutoFillDone(false); setValues({}); setSelectedPreset(null) }}
                    className="text-slate-400 hover:text-slate-600 text-xs underline"
                  >
                    {lang === 'en' ? 'Clear' : 'साफ करें'}
                  </button>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 text-slate-300 text-xs">
                <div className="flex-1 h-px bg-slate-100" />
                {lang === 'en' ? 'or enter manually' : 'या मैन्युअल दर्ज करें'}
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Value fields */}
              <div className="overflow-y-auto max-h-[40vh] space-y-1.5 pr-1">
                {BLOOD_FIELDS.map((field, idx) => {
                  const isFilled   = values[field.key] !== undefined && String(values[field.key]) !== ''
                  const isJustFill = justFilled.has(field.key)
                  const isActive   = autoFilling && fillingIndex === idx

                  return (
                    <div key={field.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 ${
                      isJustFill
                        ? 'bg-emerald-50 border-emerald-300'
                        : isActive
                          ? 'bg-blue-50 border-blue-200'
                          : isFilled
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-700 truncate">
                          {lang === 'en' ? field.label : field.labelHi}
                        </div>
                        <div className="text-[10px] text-slate-400">{field.unit}</div>
                      </div>
                      <div className="relative flex-shrink-0">
                        {isJustFill && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-75" />
                        )}
                        <input
                          type="number"
                          step="0.01"
                          value={values[field.key] ?? ''}
                          onChange={e => {
                            const v = e.target.value
                            setValues(p => ({ ...p, [field.key]: v === '' ? undefined : parseFloat(v) }))
                          }}
                          placeholder={field.placeholder}
                          className={`w-28 rounded-lg px-3 py-1.5 text-sm text-right font-mono border transition-all ${
                            isJustFill
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'input-light'
                          }`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

              <button
                onClick={handleSubmitTest}
                disabled={loading || filledCount < 3}
                className="btn-primary w-full rounded-2xl py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {lang === 'en' ? 'Submitting...' : 'जमा हो रहा है...'}
                    </span>
                  : lang === 'en'
                    ? filledCount >= 3
                      ? `Submit ${filledCount} Values for AI Analysis`
                      : `Enter at least ${3 - filledCount} more value(s) to continue`
                    : `${filledCount} मान AI विश्लेषण के लिए भेजें`
                }
              </button>
            </div>
          )}

          {/* Step 3: AI Analysis */}
          {step === 3 && testId && (
            <div className="p-6 space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-slate-900">
                  {lang === 'en' ? 'AI Analysis Running' : 'AI विश्लेषण चल रहा है'}
                </h2>
                <p className="text-slate-400 text-sm">
                  {lang === 'en' ? '6-agent pipeline is processing your sample' : '6-एजेंट पाइपलाइन आपके नमूने को प्रोसेस कर रही है'}
                </p>
              </div>
              <AgentPipeline testId={testId} onComplete={data => { setResult(data); setTimeout(() => setStep(4), 800) }} />
            </div>
          )}

          {/* Step 4: Token */}
          {step === 4 && result && (
            <div className="p-6 space-y-5">
              {/* Success header */}
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-full mb-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {lang === 'en' ? 'Analysis Complete' : 'विश्लेषण पूर्ण'}
                </h2>
                <p className="text-slate-400 text-sm">
                  {lang === 'en' ? 'Your token is ready — show this at the counter' : 'काउंटर पर यह टोकन दिखाएं'}
                </p>
              </div>

              {/* Token */}
              <QueueTag queueNumber={result.queueNumber} riskLevel={result.riskLevel} patientName={name} />

              {/* Timing */}
              <div className="text-center text-slate-400 text-xs">
                {lang === 'en' ? 'AI analysis completed in' : 'विश्लेषण समय:'} {(result.totalMs / 1000).toFixed(1)}s
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-3 text-sm font-semibold transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {lang === 'en' ? 'Print Token' : 'प्रिंट करें'}
                </button>
                <button
                  onClick={handleReset}
                  className="bg-white border border-slate-200 rounded-2xl py-3 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  {lang === 'en' ? 'New Patient' : 'नया रोगी'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-slate-400 text-[11px] pb-2">
          AI SUGGESTED — DOCTOR MUST VERIFY ALL RESULTS
        </p>
      </div>
    </div>
  )
}
