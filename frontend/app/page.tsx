'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { seedDemo } from '@/lib/api'

const STATS = [
  { label: 'Faster Triage',  value: '60%',  sub: 'reduced cognitive load',   icon: '⚡' },
  { label: 'AI Agents',      value: '6',    sub: 'parallel pipeline',         icon: '🤖' },
  { label: 'Analysis Time',  value: '<30s', sub: 'end-to-end',                icon: '⏱' },
  { label: 'Risk Levels',    value: '4',    sub: 'GREEN → BLACK',             icon: '🎯' },
]

const ROLES = [
  {
    emoji: '🩸',
    title: 'Patient Kiosk',
    desc: 'Register & submit blood values in 4 steps — auto-import from lab machine',
    sub: 'Available in English & हिंदी',
    href: '/kiosk',
    accent: 'from-blue-500 to-cyan-500',
    border: 'border-blue-100',
    tag: 'TOUCHSCREEN',
    tagBg: 'bg-blue-50 text-blue-600',
  },
  {
    emoji: '👨‍⚕️',
    title: 'Doctor Dashboard',
    desc: 'Live risk queue with AI pre-analysis — sorted BLACK → GREEN priority',
    sub: 'Auto-refreshes every 30 seconds',
    href: '/doctor',
    accent: 'from-violet-500 to-purple-600',
    border: 'border-violet-100',
    tag: 'LIVE QUEUE',
    tagBg: 'bg-violet-50 text-violet-600',
  },
  {
    emoji: '🔬',
    title: 'Imaging & Diagnostics',
    desc: 'X-Ray, Sonography, MRI, CT — 3-agent AI pipeline analyzes reports instantly',
    sub: 'Findings extraction + clinical correlation',
    href: '/imaging',
    accent: 'from-cyan-500 to-blue-500',
    border: 'border-cyan-100',
    tag: 'NEW',
    tagBg: 'bg-cyan-50 text-cyan-600',
  },
  {
    emoji: '📊',
    title: 'Admin Console',
    desc: 'Pipeline monitor, queue statistics, and full paginated audit trail',
    sub: 'Every action permanently logged',
    href: '/admin',
    accent: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-100',
    tag: 'AUDIT TRAIL',
    tagBg: 'bg-emerald-50 text-emerald-600',
  },
]

const AGENTS = [
  { name: 'Lab Interpreter',      icon: '🔬', phase: 1 },
  { name: 'Pattern Detector',     icon: '🧬', phase: 1 },
  { name: 'History Comparator',   icon: '📈', phase: 1 },
  { name: 'Risk Scorer',          icon: '⚡', phase: 2 },
  { name: 'Report Writer',        icon: '📝', phase: 2 },
]

export default function LandingPage() {
  const router = useRouter()
  const [seeding, setSeeding]   = useState(false)
  const [seedMsg, setSeedMsg]   = useState('')
  const [active, setActive]     = useState(0)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setActive(a => (a + 1) % AGENTS.length), 1100)
    return () => clearInterval(t)
  }, [])

  const handleSeed = async () => {
    setSeeding(true); setSeedMsg('')
    try {
      const res = await seedDemo() as { created: { name: string }[] }
      setSeedMsg(`Seeded ${res.created.length} demo patients — pipelines running in background`)
    } catch (e: unknown) { setSeedMsg(`Error: ${e instanceof Error ? e.message : 'Failed'}`) }
    finally { setSeeding(false) }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] bg-dots">
      {/* Soft background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-100/60 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] bg-violet-100/60 rounded-full blur-[80px]" />
        <div className="absolute -bottom-32 left-1/3 w-[400px] h-[400px] bg-cyan-100/40 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-14 space-y-20">

        {/* ── Hero ── */}
        <div className={`text-center space-y-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-sm font-semibold">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live · India-First Hospital AI
          </div>

          <h1 className="text-6xl sm:text-8xl font-black tracking-tight text-slate-900">
            <span className="gradient-text">Med</span>Flow
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            A 6-agent AI pipeline that <span className="text-slate-800 font-semibold">pre-analyzes blood tests</span> before the patient walks in.
            Built for India&apos;s <span className="text-amber-600 font-bold">1:1500</span> doctor-to-patient ratio.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={handleSeed} disabled={seeding}
              className="btn-primary px-6 py-3 rounded-xl text-sm flex items-center gap-2">
              {seeding
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Seeding...</>
                : <><span>⚡</span> Load Demo Data</>}
            </button>
            <button onClick={() => router.push('/kiosk')}
              className="px-6 py-3 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600 shadow-sm transition-all">
              Try Kiosk →
            </button>
          </div>

          {seedMsg && (
            <p className={`text-sm font-medium animate-fade-in ${seedMsg.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
              {seedMsg.startsWith('Error') ? '✗' : '✓'} {seedMsg}
            </p>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <div key={s.label} className="card rounded-2xl p-5 text-center card-hover" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-4xl font-black gradient-text">{s.value}</div>
              <div className="text-slate-800 font-semibold text-sm mt-1">{s.label}</div>
              <div className="text-slate-400 text-xs mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Pipeline visualization ── */}
        <div className="card-elevated rounded-3xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">AI Pipeline</h2>
            <p className="text-slate-400 text-sm mt-1">Phase 1 runs in parallel · Phase 2 sequential</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 items-center">
            {AGENTS.map((agent, i) => (
              <div key={agent.name} className="flex items-center gap-3">
                <div className={`
                  relative flex flex-col items-center px-5 py-4 rounded-2xl border-2 transition-all duration-400 cursor-default
                  ${i === active
                    ? 'border-blue-300 bg-blue-50 shadow-lg shadow-blue-100 scale-105'
                    : 'border-slate-100 bg-white'
                  }
                `}>
                  <span className="text-2xl">{agent.icon}</span>
                  <span className={`text-xs font-bold mt-1 whitespace-nowrap ${i === active ? 'text-blue-700' : 'text-slate-600'}`}>{agent.name}</span>
                  <span className={`text-[10px] ${i === active ? 'text-blue-400' : 'text-slate-400'}`}>Phase {agent.phase}</span>
                  {i === active && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />}
                </div>
                {i < AGENTS.length - 1 && (
                  <div className="flex items-center">
                    <div className={`h-px w-6 transition-all duration-300 ${i < active ? 'bg-blue-400' : 'bg-slate-200'}`} />
                    <div className={`text-xs ${i < active ? 'text-blue-400' : 'text-slate-300'}`}>▶</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Role cards ── */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Choose Your Role</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {ROLES.map(role => (
              <button key={role.href} onClick={() => router.push(role.href)}
                className={`group text-left card-elevated rounded-3xl p-6 space-y-4 card-hover border-2 ${role.border} transition-all`}>
                <div className="flex items-start justify-between">
                  <span className="text-4xl">{role.emoji}</span>
                  <span className={`text-[10px] font-bold tracking-widest px-2 py-1 rounded-full ${role.tagBg}`}>{role.tag}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{role.title}</h3>
                  <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{role.desc}</p>
                  <p className="text-slate-400 text-xs mt-1.5">{role.sub}</p>
                </div>
                <div className={`text-sm font-bold bg-gradient-to-r ${role.accent} bg-clip-text text-transparent flex items-center gap-1 group-hover:gap-2 transition-all`}>
                  Open Dashboard <span>→</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Safety ── */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <span className="text-2xl flex-shrink-0">⚕️</span>
          <div>
            <p className="text-amber-800 font-bold text-sm">AI SUGGESTED — DOCTOR MUST VERIFY</p>
            <p className="text-amber-600/80 text-xs mt-1 leading-relaxed">
              MedFlow uses AI to assist clinical decision-making. All outputs are suggestions only and must be reviewed by a qualified physician before any clinical action.
            </p>
          </div>
        </div>

        <div className="text-center text-slate-400 text-xs pb-4">
          MedFlow v1.0 · FastAPI + Groq llama-3.3-70b + Next.js 14 · ICMR reference ranges
        </div>
      </div>
    </div>
  )
}
