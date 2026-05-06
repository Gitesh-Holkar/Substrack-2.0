'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  Zap, RefreshCw, BarChart3, CreditCard, Code2,
  Sparkles, ArrowRight, ChevronDown, Check, X,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PricingTier {
  name: string
  desc: string
  priceM: number
  priceY: number
  cta: string
  featured: boolean
  features: string[]
  notIncluded?: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRICING: PricingTier[] = [
  {
    name: 'Starter',
    desc: 'Everything you need to launch your first subscription.',
    priceM: 0,
    priceY: 0,
    cta: 'Start for free',
    featured: false,
    features: ['50 active subscribers', 'Unlimited plans', 'Stripe & Cashfree', 'Email invoices', 'Basic dashboard', 'REST API'],
    notIncluded: ['Failed payment recovery', 'GIWI AI assistant', 'Automated email reminders'],
  },
  {
    name: 'Growth',
    desc: 'For businesses scaling their recurring revenue.',
    priceM: 1999,
    priceY: 1499,
    cta: 'Start 14-day trial',
    featured: true,
    features: ['500 active subscribers', 'Auto payment recovery', 'Automated email reminders', 'GIWI AI assistant', 'Advanced analytics', 'SDK + WordPress plugin', 'Priority support'],
  },
  {
    name: 'Scale',
    desc: 'Unlimited volume for established businesses.',
    priceM: 4999,
    priceY: 3999,
    cta: 'Talk to us',
    featured: false,
    features: ['Unlimited subscribers', 'Custom webhooks', 'White-label invoices', 'Dedicated manager', 'GST export reports', 'SLA guarantee', 'Custom analytics'],
  },
]

const FAQ = [
  { q: 'Is Substrack free to start?', a: 'Yes — the Starter plan is completely free. No credit card required. You get up to 50 active subscribers, unlimited plans, and full API access. Upgrade only when you grow.' },
  { q: 'Which payment gateways are supported?', a: 'Stripe for international payments (cards, Apple Pay, Google Pay) and Cashfree for India (UPI, net banking, cards, wallets). Both can run simultaneously.' },
  { q: 'How does failed payment recovery work?', a: 'When a payment fails, Substrack marks the subscriber as past-due and sends automated email reminders on Day 1, Day 3, and Day 7. If payment is still not received by Day 8, the subscription is cancelled automatically.' },
  { q: 'Can I integrate with my existing website?', a: 'Yes. The Frontend SDK adds subscription gating to any site in minutes. The WordPress plugin handles billing for WordPress/WooCommerce. The REST API gives full control for custom backends.' },
  { q: 'Is my data safe?', a: 'All data is stored in Supabase with row-level security — completely isolated between merchants. Webhook signatures are verified on every event. Zero PII is ever sent to AI models.' },
]

const BEFORE_AFTER = [
  { before: 'Chasing failed payments manually every month', after: 'Day 1 → Day 3 → Day 7 automated email recovery' },
  { before: 'Revenue visible only via bank statements', after: 'Live MRR, ARR, and churn dashboard' },
  { before: 'Manual GST invoices in Excel', after: 'Automatic GST-compliant invoices in INR' },
  { before: 'No idea which plan drives the most growth', after: 'GIWI AI surfaces insights instantly' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [wordIdx, setWordIdx] = useState(0)
  const [wordVisible, setWordVisible] = useState(true)
  const [activeTab, setActiveTab] = useState<'plans' | 'subscribers' | 'analytics'>('plans')
  const [isYearly, setIsYearly] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dashRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const bentoRef = useRef<HTMLDivElement>(null)
  const primaryBtnRef = useRef<HTMLButtonElement>(null)

  const goSignup = useCallback(() => router.push('/signup'), [router])
  const goLogin = useCallback(() => { if (user) { router.push('/dashboard'); return; } router.push('/login') }, [user, router])


  // ── Aurora canvas ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const orbs = [
      { px: 0.25, py: 0.2, r: 0.5, vx: 0.00025, vy: 0.00015, c: '79,70,229' },
      { px: 0.75, py: 0.55, r: 0.45, vx: -0.0002, vy: 0.00022, c: '124,58,237' },
      { px: 0.5, py: 0.85, r: 0.38, vx: 0.00018, vy: -0.00025, c: '99,102,241' },
    ]
    let t = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)
      orbs.forEach(o => {
        o.px += Math.sin(t * 0.8 + o.vx * 1000) * o.vx
        o.py += Math.cos(t * 0.6 + o.vy * 1000) * o.vy
        const gx = o.px * w, gy = o.py * h, gr = o.r * Math.max(w, h)
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
        g.addColorStop(0, `rgba(${o.c},0.14)`)
        g.addColorStop(0.5, `rgba(${o.c},0.05)`)
        g.addColorStop(1, `rgba(${o.c},0)`)
        ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2)
        ctx.fillStyle = g; ctx.fill()
      })
      t++
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
  }, [])

  // ── Dashboard 3D tilt ───────────────────────────────────────────────────
  useEffect(() => {
    const el = dashRef.current
    if (!el) return
    let raf: number
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / (rect.width / 2)
      const dy = (e.clientY - cy) / (rect.height / 2)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateY(${dx * 6}deg) rotateX(${-dy * 4}deg) scale(1.01)`
      })
    }
    const reset = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg) scale(1)'
      })
    }
    window.addEventListener('mousemove', handler, { passive: true })
    el.addEventListener('mouseleave', reset)
    return () => { window.removeEventListener('mousemove', handler); el.removeEventListener('mouseleave', reset); cancelAnimationFrame(raf) }
  }, [])

  // ── Bento spotlight ─────────────────────────────────────────────────────
  useEffect(() => {
    const bento = bentoRef.current
    if (!bento) return
    const cards = Array.from(bento.querySelectorAll<HTMLElement>('.bcard'))
    const handler = (e: MouseEvent) => {
      cards.forEach(card => {
        const rect = card.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        card.style.setProperty('--sx', `${x}%`)
        card.style.setProperty('--sy', `${y}%`)
      })
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  // ── Magnetic CTA ────────────────────────────────────────────────────────
  useEffect(() => {
    const btn = primaryBtnRef.current
    if (!btn) return
    let raf: number
    const enter = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect()
      const dx = e.clientX - (rect.left + rect.width / 2)
      const dy = e.clientY - (rect.top + rect.height / 2)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        btn.style.transform = `translate(${dx * 0.28}px, ${dy * 0.28}px)`
      })
    }
    const leave = () => { cancelAnimationFrame(raf); btn.style.transform = '' }
    btn.addEventListener('mousemove', enter)
    btn.addEventListener('mouseleave', leave)
    return () => { btn.removeEventListener('mousemove', enter); btn.removeEventListener('mouseleave', leave); cancelAnimationFrame(raf) }
  }, [])

  // ── Scroll reveal ───────────────────────────────────────────────────────
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.sr')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sr-v') })
    }, { threshold: 0.07 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  // ── Sticky nav ──────────────────────────────────────────────────────────
  useEffect(() => {
    const nav = document.getElementById('nav')
    const fn = () => (window.scrollY > 50 ? nav?.classList.add('stuck') : nav?.classList.remove('stuck'))
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────

  const fmt = (n: number) => n.toLocaleString('en-IN')

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg:#030014;--bg2:#0c0a1e;--bg3:#0f1328;
          --card:#0e0c20;
          --ind:#4F46E5;--ind2:#6366f1;--vio:#7c3aed;
          --idim:rgba(79,70,229,.12);--iglo:rgba(79,70,229,.3);
          --bdr:rgba(255,255,255,.07);--bdr2:rgba(255,255,255,.12);
          --t:#f1f5f9;--t2:#94a3b8;--t3:#475569;
        }
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--t);font-family:-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
        ::selection{background:rgba(99,102,241,.35);color:#fff}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:3px}

        /* NAV */
        #nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 clamp(1rem,4vw,2.5rem);height:66px;display:flex;align-items:center;justify-content:space-between;transition:all .4s}
        #nav.stuck{background:rgba(3,0,20,.9);backdrop-filter:blur(20px);border-bottom:1px solid var(--bdr)}

        /* SCROLL REVEAL */
        .sr{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s ease}
        .sr.sr-v{opacity:1;transform:none}
        .d1{transition-delay:.1s}.d2{transition-delay:.2s}.d3{transition-delay:.3s}.d4{transition-delay:.4s}.d5{transition-delay:.5s}

        /* HERO ANIMS */
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
        .a1{animation:fadeUp .85s .05s both}
        .a2{animation:fadeUp .85s .18s both}
        .a3{animation:fadeUp .85s .3s both}
        .a4{animation:fadeUp .85s .44s both}
        .a5{animation:fadeUp .85s .58s both}
        .a6{animation:fadeUp .85s .72s both}

        /* WORD CYCLE */
        @keyframes wordIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes wordOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-8px)}}
        .word-in{animation:wordIn .3s ease both}
        .word-out{animation:wordOut .3s ease both}

        /* GRID BG */
        .grid-bg{background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:52px 52px;mask-image:radial-gradient(ellipse 70% 60% at 50% 40%,black,transparent)}

        /* GRAD TEXT */
        .gt{background:linear-gradient(135deg,#a5b4fc 0%,#818cf8 45%,#c4b5fd 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

        /* BEAM BUTTON */
        .beam-btn{position:relative;overflow:hidden}
        .beam-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.15) 50%,transparent 100%);width:60%;height:100%;left:-60%;animation:beam 3s ease-in-out infinite}
        @keyframes beam{0%{left:-60%}60%,100%{left:120%}}

        /* SHIMMER BORDER */
        .shimmer-border{position:relative}
        .shimmer-border::after{content:'';position:absolute;inset:-1px;border-radius:inherit;background:linear-gradient(90deg,var(--ind),var(--vio),var(--ind));background-size:200%;animation:shimmer 3s linear infinite;z-index:-1}
        @keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}

        /* MARQUEE */
        @keyframes mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .mq-track{display:flex;width:max-content;animation:mq 40s linear infinite}
        .mq-track:hover{animation-play-state:paused}

        /* BENTO CARDS */
        .bcard{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--bdr);border-radius:18px;transition:border-color .3s,transform .3s}
        .bcard::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at var(--sx,50%) var(--sy,50%),rgba(99,102,241,.1) 0%,transparent 55%);opacity:0;transition:opacity .35s;pointer-events:none;z-index:0}
        .bcard:hover{border-color:rgba(99,102,241,.3)}
        .bcard:hover::before{opacity:1}
        .bcard>*{position:relative;z-index:1}

        /* FEATURE ICON */
        .f-icon{width:44px;height:44px;border-radius:12px;background:var(--idim);border:1px solid rgba(99,102,241,.2);display:flex;align-items:center;justify-content:center;transition:all .3s}
        .bcard:hover .f-icon{background:rgba(99,102,241,.22);box-shadow:0 0 22px rgba(79,70,229,.3)}

        /* PRICING */
        .price-card{background:var(--card);border:1px solid var(--bdr);border-radius:20px;padding:32px;transition:transform .3s}
        .price-card:hover{transform:translateY(-4px)}
        .price-card.feat{background:var(--bg2);border-color:rgba(99,102,241,.4);box-shadow:0 0 60px rgba(79,70,229,.1)}
        .price-card.feat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--ind),var(--vio));border-radius:20px 20px 0 0}

        /* FAQ */
        .fq-a{max-height:0;overflow:hidden;transition:max-height .4s ease,padding .3s;color:var(--t2);font-size:15px;line-height:1.7}
        .fq-a.open{max-height:200px;padding-bottom:20px}

        /* CTA card */
        .cta-card{background:var(--bg2);border:1px solid var(--bdr);border-radius:28px;padding:clamp(48px,8vw,88px) clamp(24px,6vw,72px);text-align:center;position:relative;overflow:hidden}
        .cta-card::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 20% 50%,rgba(79,70,229,.09) 0%,transparent 60%),radial-gradient(ellipse at 80% 50%,rgba(124,58,237,.07) 0%,transparent 60%);pointer-events:none}

        /* DASH */
        .dash-wrap{transition:transform .4s ease}

        /* B/A */
        .ba-after{background:rgba(79,70,229,.08);border:1px solid rgba(79,70,229,.25);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px}
        .ba-before{background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.2);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;text-decoration:line-through;opacity:.7}

        /* Mobile nav */
        .mob-nav{display:none;position:fixed;top:66px;left:0;right:0;background:rgba(3,0,20,.97);backdrop-filter:blur(20px);border-bottom:1px solid var(--bdr);padding:20px 1.5rem 28px;flex-direction:column;z-index:99}
        .mob-nav.open{display:flex}
        .mob-nav a{color:var(--t2);text-decoration:none;font-size:16px;font-weight:500;padding:13px 0;border-bottom:1px solid var(--bdr);transition:color .2s}
        .mob-nav a:hover{color:var(--t)}

        /* DOT PULSE */
        @keyframes dp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}
        .dp{animation:dp 2s infinite}

        /* Live chart line animation */
        @keyframes draw{from{stroke-dashoffset:400}to{stroke-dashoffset:0}}
        .chart-line-anim{stroke-dasharray:400;stroke-dashoffset:400;animation:draw 1.8s 1s ease both}

        @media(max-width:768px){
          .hide-mob{display:none!important}
          .cta-card{padding:48px 24px}
          .bento-grid{grid-template-columns:1fr!important}
          .bento-grid .bcard{grid-column:1!important;grid-row:auto!important}
          .giwi-grid{grid-template-columns:1fr!important;gap:40px!important}
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav id="nav">
        <a href="/" className="flex items-center gap-2.5 z-10 no-underline">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="text-xl font-bold text-white tracking-tight">Substrack</span>
        </a>

        <div className="hidden md:flex items-center gap-7">
          {[['#features', 'Features'], ['#demo', 'Demo'], ['#pricing', 'Pricing']].map(([h, l]) => (
            <a key={h} href={h} className="text-slate-400 hover:text-white text-sm font-medium transition-colors no-underline">{l}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={goLogin} className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-3 py-2 bg-transparent border-0 cursor-pointer">Sign in</button>
          <button ref={primaryBtnRef} onClick={goSignup}
            className="beam-btn text-sm font-bold text-white px-5 py-2.5 rounded-xl border-0 cursor-pointer transition-all"
            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7c3aed 100%)', boxShadow: '0 4px 20px rgba(79,70,229,.4)' }}>
            Get started free →
          </button>
        </div>

        <button className="md:hidden flex flex-col gap-[5px] p-2 bg-transparent border-0 cursor-pointer z-10" onClick={() => setMobileMenuOpen(v => !v)}>
          {[0, 1, 2].map(i => <span key={i} className="block w-5 h-0.5 bg-slate-400 rounded" />)}
        </button>
      </nav>

      <div className={`mob-nav${mobileMenuOpen ? ' open' : ''}`}>
        {[['#features', 'Features'], ['#demo', 'Demo'], ['#pricing', 'Pricing']].map(([h, l]) => <a key={h} href={h} onClick={() => setMobileMenuOpen(false)}>{l}</a>)}
        <button onClick={goLogin} className="text-left text-slate-400 text-base font-medium py-3 border-b border-white/[0.07] bg-transparent border-0 cursor-pointer mt-1">Sign in</button>
        <button onClick={goSignup} className="mt-4 w-full py-3 rounded-xl text-white font-bold text-base border-0 cursor-pointer" style={{ background: 'linear-gradient(135deg,#4F46E5,#7c3aed)' }}>Get started free →</button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center pt-28 pb-16 px-4 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ mixBlendMode: 'screen' }} />
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 80% at 50% -10%, transparent 40%, rgba(3,0,20,.8) 100%)' }} />

        {/* Badge */}
        <div className="a1 relative z-10 inline-flex items-center gap-2.5 mb-10 px-4 py-2 rounded-full" style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)' }}>
          <span className="dp w-1.5 h-1.5 rounded-full bg-indigo-400 block flex-shrink-0" />
          <span className="text-sm font-medium text-indigo-300">GIWI AI — your subscription business intelligence, built in</span>
        </div>

        {/* Headline */}
        <h1 className="a2 relative z-10 font-extrabold leading-[1.04] tracking-tight text-white" style={{ fontSize: 'clamp(46px,8vw,88px)', maxWidth: 900 }}>
          Run Subscription Business<br />
          <span className="gt">On Autopilot.</span>
        </h1>

        {/* Sub */}
        <p className="a4 relative z-10 text-slate-400 mt-6 leading-relaxed" style={{ fontSize: 'clamp(15px,2.5vw,19px)', maxWidth: 560 }}>
          Automate billing, recover failed payments, and get AI-powered insights — so you can focus on the business, not the backend.
        </p>

        {/* CTAs */}
        <div className="a5 relative z-10 flex flex-wrap items-center justify-center gap-3 mt-10">
          <button onClick={goSignup}
            className="beam-btn shimmer-border flex items-center gap-2 text-white font-bold rounded-xl border-0 cursor-pointer transition-all"
            style={{ background: 'linear-gradient(135deg,#4F46E5,#7c3aed)', padding: '14px 30px', fontSize: 15, boxShadow: '0 8px 32px rgba(79,70,229,.45)', borderRadius: 12 }}>
            Start for free
            <ArrowRight size={16} />
          </button>
          <a href="#demo" className="flex items-center gap-2 text-slate-300 font-medium rounded-xl no-underline transition-all" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', padding: '14px 26px', fontSize: 15 }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M10 15.5L16 12 10 8.5V15.5Z" fill="currentColor" /></svg>
            See it live
          </a>
        </div>

{/* Dashboard 3D preview */}
        <div className="a6 relative z-10 w-full mt-20 hide-mob" style={{ maxWidth: 920 }}>
          <div ref={dashRef} className="dash-wrap" style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 50px 120px -20px rgba(0,0,0,.8), 0 0 80px rgba(79,70,229,.15)', background: '#f8fafc' }}>
            
            {/* Titlebar */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded text-xs font-mono text-slate-500" style={{ background: 'rgba(0,0,0,.03)', border: '1px solid rgba(0,0,0,.05)' }}>
                  substrack-yags.vercel.app/dashboard
                </div>
              </div>
            </div>

            {/* Body - using EXACT grid structure as your original dark mode code */}
            <div className="grid select-none" style={{ gridTemplateColumns: '188px 1fr', background: '#f8fafc' }}>
              
              {/* Sidebar */}
              <div className="p-3 flex flex-col gap-1" style={{ borderRight: '1px solid rgba(0,0,0,.05)', background: '#0f172a' }}>
                <div className="flex items-center gap-2 p-2 pb-3 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center bg-blue-600 shadow-md shadow-blue-600/30">
                   </div>
                  <span className="text-xs font-bold text-white tracking-tight">Substrack</span>
                </div>
                {[['Dashboard', true], ['Plans', false], ['Subscribers', false], ['Payments', false], ['Settings', false], ['Contact', false]].map(([label, active]) => (
                  <div key={label as string} className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors" style={{ background: active ? 'rgba(37,99,235,1)' : 'transparent', color: active ? '#ffffff' : '#94a3b8' }}>
                    {label as string}
                  </div>
                ))}
              </div>

              {/* Main */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">Dashboard</h2>
                  <div className="flex items-center gap-2">
  
                  </div>
                </div>

                {/* 4 Stat Cards */}
                <div className="grid grid-cols-4 gap-2.5 mb-4">
                  {[
                    ['Monthly Revenue', '₹1197.00', '+33.9%'], 
                    ['Total Revenue', '₹2289.00', '+33.9%'], 
                    ['Active Subs', '12', '+100.0%'], 
                    ['MRR (Recurring)', '₹3588.00', '+157.8%']
                  ].map(([l, v, c]) => (
                    <div key={l} className="rounded-xl p-3 bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                      <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-1 truncate">{l}</p>
                      <p className="text-sm font-extrabold text-slate-800 leading-none mb-1.5">{v}</p>
                      <p className="text-[8px] text-emerald-500 font-bold">↗ {c}</p>
                    </div>
                  ))}
                </div>

                {/* Chart - Exact same height (100px) as original dark mode code */}
                <div className="rounded-xl p-3 bg-white border border-slate-200 shadow-sm relative flex flex-col" style={{ height: 100 }}>
                  <div className="flex justify-between items-center mb-1 z-10">
                    <h4 className="font-bold text-slate-800 text-[10px]">Revenue Trend</h4>
                    <span className="text-[8px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">6 months</span>
                  </div>
                  
                  {/* Floating Chart Tooltip */}
                  <div className="absolute top-[40%] left-[65%] bg-white border border-blue-100 shadow-md rounded p-1.5 z-20 pointer-events-none transform -translate-x-1/2 -translate-y-1/2">
                    <p className="text-[8px] font-bold text-slate-800">Mar 2026</p>
                    <p className="text-[8px] text-blue-600 font-bold mt-0.5">₹198.00</p>
                  </div>

                  <svg width="100%" height="45" viewBox="0 0 620 45" preserveAspectRatio="none" className="mt-auto">
                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,43 C150,43 250,40 325,25 C375,10 450,5 620,2 L620,45 L0,45 Z" fill="url(#blueGradient)" />
                    <path className="chart-line-anim" d="M0,43 C150,43 250,40 325,25 C375,10 450,5 620,2" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="325" cy="25" r="3" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                  </svg>
                  
                  <div className="flex justify-between text-[7px] font-medium text-slate-400 mt-1 px-1">
                    <span>Dec 25</span><span>Jan 26</span><span>Feb 26</span><span>Mar 26</span><span>Apr 26</span><span>May 26</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="a6 relative z-10 mt-16 flex flex-col items-center gap-1.5 text-slate-600">
          <span className="text-xs uppercase tracking-widest font-medium">scroll</span>
          <ChevronDown size={16} style={{ animation: 'dp 2s infinite' }} />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MARQUEE                                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div style={{ borderTop: '1px solid var(--bdr)', borderBottom: '1px solid var(--bdr)', background: 'rgba(255,255,255,.015)', padding: '20px 0', overflow: 'hidden' }}>
        <p className="text-center text-[11px] uppercase tracking-[.15em] text-slate-600 font-semibold mb-5">Powering subscription businesses across every industry</p>
        <div className="mq-track">
          {[...Array(2)].flatMap(() => ['Yoga & Fitness', 'SaaS Products', 'Online Coaching', 'Coworking Spaces', 'EdTech Platforms', 'Membership Clubs', 'Clinics & Healthcare', 'Photography Studios', 'Gym Chains', 'Music Schools', 'Legal Retainers', 'Digital Creators']).map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 text-slate-500 text-sm font-medium whitespace-nowrap" style={{ padding: '0 32px' }}>
              <span className="w-1 h-1 rounded-full bg-slate-600 opacity-40" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* BEFORE / AFTER                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ maxWidth: 1060, margin: '0 auto', padding: '88px 1.5rem' }}>
        <div className="sr text-center mb-14">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3 block">The transformation</span>
          <h2 className="font-extrabold text-white leading-tight" style={{ fontSize: 'clamp(28px,5vw,48px)', letterSpacing: '-1.5px' }}>
            Before Substrack vs. After Substrack
          </h2>
        </div>
        <div className="sr grid grid-cols-1 md:grid-cols-2 gap-5">
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(248,113,113,.15)', borderRadius: 18, padding: '28px 32px' }}>
            <div className="flex items-center gap-2 mb-6">
              <X size={18} style={{ color: '#f87171' }} />
              <span className="font-bold text-slate-300 text-sm">Without Substrack</span>
            </div>
            <div className="flex flex-col gap-3">
              {BEFORE_AFTER.map(ba => (
                <div key={ba.before} className="ba-before">
                  <X size={14} style={{ color: '#f87171', flexShrink: 0 }} />
                  <span className="text-slate-400 text-sm">{ba.before}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(79,70,229,.3)', borderRadius: 18, padding: '28px 32px', boxShadow: '0 0 40px rgba(79,70,229,.08)' }}>
            <div className="flex items-center gap-2 mb-6">
              <Check size={18} style={{ color: '#818cf8' }} />
              <span className="font-bold text-white text-sm">With Substrack</span>
            </div>
            <div className="flex flex-col gap-3">
              {BEFORE_AFTER.map(ba => (
                <div key={ba.after} className="ba-after">
                  <Check size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
                  <span className="text-slate-300 text-sm">{ba.after}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* BENTO FEATURES                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section id="features" style={{ maxWidth: 1060, margin: '0 auto', padding: '0 1.5rem 96px' }}>
        <div className="sr text-center mb-14">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3 block">Platform</span>
          <h2 className="font-extrabold text-white leading-tight" style={{ fontSize: 'clamp(28px,5vw,50px)', letterSpacing: '-1.5px', maxWidth: 640, margin: '0 auto' }}>
            Everything your subscription business needs, nothing it doesn&apos;t.
          </h2>
        </div>

        <div ref={bentoRef} className="sr grid gap-3 bento-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'auto auto auto' }}>

          {/* LARGE: Smart Billing */}
          <div className="bcard p-7" style={{ gridColumn: '1', gridRow: '1 / 3' }}>
            <div className="f-icon mb-5"><Zap size={22} className="text-indigo-400" /></div>
            <h3 className="font-bold text-white text-lg mb-2 leading-tight">Smart Recurring Billing</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">GST-compliant invoices generated and sent automatically — every cycle, every subscriber, in INR. Never touch another invoice manually.</p>
            {/* Mini invoice preview */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Invoice #0012</div>
                  <div className="text-sm font-bold text-white">Priya Sharma</div>
                </div>
                <div className="text-xs px-2 py-1 rounded-md font-semibold" style={{ background: 'rgba(74,222,128,.12)', color: '#4ade80' }}>Paid</div>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <span className="text-xs text-slate-500">Pro Monthly Plan</span>
                <span className="text-sm font-bold text-white">₹2,499</span>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <span className="text-xs text-slate-500">GST (18%)</span>
                <span className="text-sm text-slate-400">₹449.82</span>
              </div>
              <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <span className="text-xs font-semibold text-slate-400">Total</span>
                <span className="text-base font-bold" style={{ color: '#818cf8' }}>₹2,948.82</span>
              </div>
            </div>
            <span className="inline-block mt-4 text-xs font-semibold px-2.5 py-1 rounded-md" style={{ background: 'var(--idim)', color: '#818cf8', border: '1px solid rgba(99,102,241,.2)' }}>Core</span>
          </div>

          {/* Failed Payment Recovery */}
          <div className="bcard p-6 d1" style={{ gridColumn: '2', gridRow: '1' }}>
            <div className="f-icon mb-4"><RefreshCw size={20} className="text-indigo-400" /></div>
            <h3 className="font-bold text-white text-base mb-2">Failed Payment Recovery</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">Automated email sequence brings back payments you&apos;d otherwise lose — without any manual follow-up.</p>
            <div className="flex flex-col gap-2">
              {[
                { day: 'Day 1', label: 'Recovery email sent' },
                { day: 'Day 3', label: 'Follow-up reminder' },
                { day: 'Day 7', label: 'Final notice' },
                { day: 'Day 8', label: 'Auto-cancelled' },
              ].map(step => (
                <div key={step.day} className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                    style={{ background: 'var(--idim)', color: '#818cf8', border: '1px solid rgba(99,102,241,.2)', minWidth: 44, textAlign: 'center' as const }}>
                    {step.day}
                  </span>
                  <span className="text-xs text-slate-400">{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GIWI */}
          <div className="bcard p-6 d2" style={{ gridColumn: '3', gridRow: '1' }}>
            <div className="f-icon mb-4" style={{ background: 'rgba(124,58,237,.15)', borderColor: 'rgba(124,58,237,.25)' }}>
              <Sparkles size={20} style={{ color: '#a78bfa' }} />
            </div>
            <h3 className="font-bold text-white text-base mb-2">GIWI AI Intelligence</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">Ask anything about your revenue, churn, or subscribers. Get answers in seconds — in English or Hinglish.</p>
            <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.2)', color: '#c4b5fd' }}>
              &ldquo;Aapka churn 2.1% hai — 3 subscribers ne price increase ke baad cancel kiya.&rdquo;
            </div>
          </div>

          {/* Multi-gateway — spans 2 cols */}
          <div className="bcard p-6 d3" style={{ gridColumn: '2 / 4', gridRow: '2' }}>
            <div className="flex items-start gap-6">
              <div>
                <div className="f-icon mb-4"><CreditCard size={20} className="text-indigo-400" /></div>
                <h3 className="font-bold text-white text-base mb-2">Multi-Gateway Payments</h3>
                <p className="text-slate-500 text-sm leading-relaxed">Stripe for international cards and wallets. Cashfree for India — UPI, net banking, cards. One dashboard, all paise accounted for.</p>
              </div>
              <div className="flex-shrink-0 flex flex-col gap-2 mt-1">
                {[['Stripe', '#635bff', '⚡'], ['Cashfree', '#11d8a1', '₹']].map(([n, c, ic]) => (
                  <div key={n} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: `${c}18`, border: `1px solid ${c}30`, color: c }}>
                    <span>{ic}</span>{n}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Analytics */}
          <div className="bcard p-6 d2" style={{ gridColumn: '1 / 3', gridRow: '3' }}>
            <div className="f-icon mb-4"><BarChart3 size={20} className="text-indigo-400" /></div>
            <h3 className="font-bold text-white text-base mb-2">Real-time Analytics</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">MRR, ARR, churn, AR — live the moment a payment lands. No spreadsheets. No lag.</p>
            <div className="grid grid-cols-4 gap-2">
              {[['MRR', '₹2.4L'], ['ARR', '₹28.8L'], ['Churn', '2.1%'], ['AR', '₹8.2K']].map(([l, v]) => (
                <div key={l} className="text-center rounded-xl py-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                  <div className="text-[10px] text-slate-500 mb-1">{l}</div>
                  <div className="text-sm font-bold" style={{ color: '#818cf8' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Developer Integrations */}
          <div className="bcard p-6 d4" style={{ gridColumn: '3', gridRow: '3' }}>
            <div className="f-icon mb-4"><Code2 size={20} className="text-indigo-400" /></div>
            <h3 className="font-bold text-white text-base mb-2">Developer Integrations</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">REST API, Frontend SDK, WordPress plugin. Integrate in your stack in minutes.</p>
            <div className="text-xs font-mono px-3 py-2.5 rounded-lg leading-relaxed" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', color: '#94a3b8' }}>
              <span style={{ color: '#818cf8' }}>GET</span> /v1/subscribers<br />
              <span style={{ color: '#475569' }}>Authorization: sub_live_•••</span>
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DEMO SECTION                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section id="demo" style={{ maxWidth: 1060, margin: '0 auto', padding: '0 1.5rem 96px' }}>
        <div className="sr text-center mb-14">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3 block">Product demo</span>
          <h2 className="font-extrabold text-white leading-tight" style={{ fontSize: 'clamp(28px,5vw,48px)', letterSpacing: '-1.5px' }}>
            Your entire billing business,<br /><span className="gt">in one dashboard.</span>
          </h2>
        </div>
        <div className="sr grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tab buttons */}
          <div className="flex flex-col gap-3">
            {([
              { key: 'plans', label: 'Create Plans', desc: 'Build packages with flexible pricing, billing cycles, and trial periods in INR.' },
              { key: 'subscribers', label: 'Manage Subscribers', desc: 'Every customer, plan, status, and payment history in one clean view.' },
              { key: 'analytics', label: 'Live Analytics', desc: 'MRR, churn, AR — updating the moment a payment lands.' },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="text-left w-full rounded-xl border-0 cursor-pointer transition-all"
                style={{
                  padding: '18px 22px',
                  background: activeTab === tab.key ? 'rgba(79,70,229,.12)' : 'transparent',
                  border: `1px solid ${activeTab === tab.key ? 'rgba(79,70,229,.35)' : 'var(--bdr)'}`,
                  color: activeTab === tab.key ? 'white' : '#64748b',
                }}>
                <div className="font-semibold text-sm mb-0.5" style={{ color: activeTab === tab.key ? 'white' : '#94a3b8' }}>{tab.label}</div>
                <div className="text-xs leading-snug text-slate-500">{tab.desc}</div>
              </button>
            ))}
          </div>

          {/* Pane */}
          <div className="col-span-2 rounded-2xl overflow-hidden" style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', boxShadow: '0 32px 80px rgba(0,0,0,.4)' }}>
            <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              {['#ff5f57', '#febc2e', '#28c840'].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: .7 }} />)}
            </div>
            <div className="p-6">
              {activeTab === 'plans' && (
                <div key="plans">
                  <div className="flex items-center justify-between mb-5">
                    <div><h4 className="font-bold text-white text-sm">Subscription Plans</h4><p className="text-xs text-slate-500 mt-0.5">3 active</p></div>
                    <button className="text-xs font-bold text-white px-3 py-1.5 rounded-lg border-0 cursor-pointer" style={{ background: 'linear-gradient(135deg,#4F46E5,#7c3aed)' }}>+ New Plan</button>
                  </div>
                  {[['Basic Monthly', '₹999/mo', '124 subscribers', 'active'], ['Pro Quarterly', '₹2,499/qtr', '89 subscribers', 'active'], ['Annual Elite', '₹7,999/yr', '34 subscribers', 'active']].map(([n, p, s, st]) => (
                    <div key={n} className="flex items-center justify-between p-4 rounded-xl mb-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <div><div className="text-sm font-semibold text-white">{n}</div><div className="text-xs text-slate-500 mt-0.5">{s}</div></div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white">{p}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,.2)' }}>{st.toUpperCase()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'subscribers' && (
                <div key="subs">
                  <div className="flex items-center justify-between mb-5">
                    <div><h4 className="font-bold text-white text-sm">Subscribers</h4><p className="text-xs text-slate-500 mt-0.5">247 total · 4 past due</p></div>
                    <button className="text-xs font-medium text-slate-300 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>Export CSV</button>
                  </div>
                  {[['Priya Sharma', 'Pro Quarterly', '₹2,499', 'active'], ['Rahul Gupta', 'Basic Monthly', '₹999', 'past_due'], ['Anita Joshi', 'Annual Elite', '₹7,999', 'active'], ['Vikram Das', 'Basic Monthly', '₹999', 'active']].map(([n, pl, am, st]) => (
                    <div key={n} className="flex items-center justify-between p-3 rounded-lg mb-2" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(79,70,229,.2)', color: '#818cf8' }}>{n[0]}</div>
                        <div><div className="text-xs font-semibold text-white">{n}</div><div className="text-[10px] text-slate-500">{pl}</div></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-white">{am}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={st === 'active' ? { background: 'rgba(74,222,128,.12)', color: '#4ade80' } : { background: 'rgba(251,191,36,.12)', color: '#fbbf24' }}>{st === 'active' ? 'ACTIVE' : 'PAST DUE'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'analytics' && (
                <div key="analytics">
                  <h4 className="font-bold text-white text-sm mb-1">Analytics</h4>
                  <p className="text-xs text-slate-500 mb-5">All plans · All time</p>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[['MRR', '₹2,40,000', '+18% ↑'], ['Churn', '2.1%', '↓ 0.3% better'], ['Avg AR', '₹8,200', '+₹480 ↑'], ['ARR', '₹28.8L', '+22% ↑']].map(([l, v, c]) => (
                      <div key={l} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                        <p className="text-[10px] text-slate-500 mb-1.5">{l}</p>
                        <p className="text-lg font-bold text-white leading-none">{v}</p>
                        <p className="text-[10px] mt-1.5" style={{ color: '#4ade80' }}>{c} this month</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-3 flex items-end gap-1.5" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', height: 72 }}>
                    {[40, 52, 46, 64, 60, 73, 78, 75, 88, 93, 97, 100].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: `rgba(99,102,241,${.2 + (i / 12) * .55})` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* GIWI SECTION                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '88px 1.5rem', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg,var(--bg) 0%,var(--bg2) 50%,var(--bg) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 55% 60% at 50% 50%,rgba(124,58,237,.07) 0%,transparent 70%)' }} />
        <div className="giwi-grid" style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div className="sr">
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3 block">AI-powered intelligence</span>
            <h2 className="font-extrabold text-white leading-tight mb-5" style={{ fontSize: 'clamp(28px,5vw,46px)', letterSpacing: '-1.5px' }}>
              Meet GIWI — your business never sleeps,<br /><span className="gt">neither does it.</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed mb-8" style={{ maxWidth: 440 }}>
              Ask GIWI anything about your revenue, subscribers, or churn — and get clear, actionable answers. Hinglish or English, your call.
            </p>
            <ul className="flex flex-col gap-4">
              {['Flags revenue risks before they become churn', 'Explains metric changes in plain language', 'Recommends pricing and plan optimizations', 'Responds naturally in Hinglish or English'].map(item => (
                <li key={item} className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check size={16} style={{ color: '#a78bfa', marginTop: 2, flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Chat UI */}
          <div className="sr d2 rounded-2xl overflow-hidden" style={{ background: 'rgba(15,13,35,.95)', border: '1px solid rgba(124,58,237,.25)', boxShadow: '0 0 80px rgba(124,58,237,.12)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'rgba(124,58,237,.08)', borderBottom: '1px solid rgba(124,58,237,.15)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#7c3aed,#4F46E5)' }}>G</div>
              <div>
                <div className="text-sm font-bold text-white">GIWI</div>
                <div className="text-xs flex items-center gap-1.5" style={{ color: '#a78bfa' }}>
                  <span className="dp w-1.5 h-1.5 rounded-full bg-violet-400 block flex-shrink-0" />
                  AI Business Assistant
                </div>
              </div>
            </div>
            {/* Messages */}
            <div className="p-5 flex flex-col gap-4">
              {/* GIWI message */}
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0 mt-0.5" style={{ background: 'rgba(124,58,237,.2)' }}>G</div>
                <div className="text-sm text-slate-300 leading-relaxed rounded-2xl rounded-tl-sm p-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', maxWidth: '85%' }}>
                  Namaste! Aapka MRR is mahine <span style={{ color: '#a78bfa', fontWeight: 600 }}>₹2,40,000</span> hai — <span style={{ color: '#4ade80', fontWeight: 600 }}>18% up</span> last month se. 4 subscribers past-due hain, approximately <span style={{ color: '#fbbf24', fontWeight: 600 }}>₹9,400</span> at risk.
                </div>
              </div>
              {/* User message */}
              <div className="flex gap-3 justify-end">
                <div className="text-sm text-white leading-relaxed rounded-2xl rounded-tr-sm p-3" style={{ background: 'rgba(124,58,237,.18)', border: '1px solid rgba(124,58,237,.25)', maxWidth: '80%' }}>
                  Inhe recover kaise karoon?
                </div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8' }}>Y</div>
              </div>
              {/* GIWI response */}
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0 mt-0.5" style={{ background: 'rgba(124,58,237,.2)' }}>G</div>
                <div className="text-sm text-slate-300 leading-relaxed rounded-2xl rounded-tl-sm p-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', maxWidth: '85%' }}>
                  Recovery emails already chal rahe hain — <span style={{ color: '#a78bfa', fontWeight: 600 }}>Day 1, Day 3, aur Day 7</span> pe automatically jayenge. Day 8 tak payment nahi aaya toh subscription cancel ho jayega. Aapko kuch manually nahi karna.
                </div>
              </div>
            </div>
            {/* Input */}
            <div className="flex gap-3 items-center px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <div className="flex-1 text-xs text-slate-600 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>Ask GIWI anything about your business...</div>
              <button className="w-8 h-8 rounded-xl flex items-center justify-center border-0 cursor-pointer flex-shrink-0" style={{ background: 'linear-gradient(135deg,#7c3aed,#4F46E5)' }}>
                <ArrowRight size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PRICING                                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" style={{ padding: '88px 1.5rem', background: 'linear-gradient(180deg,transparent 0%,rgba(79,70,229,.025) 50%,transparent 100%)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div className="sr text-center mb-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3 block">Pricing</span>
            <h2 className="font-extrabold text-white leading-tight mb-3" style={{ fontSize: 'clamp(28px,5vw,50px)', letterSpacing: '-1.5px' }}>Simple, transparent pricing</h2>
            <p className="text-slate-400 text-base">No hidden fees. No per-transaction cuts. Start free, upgrade when you&apos;re ready.</p>
          </div>

          <div className="sr flex items-center justify-center gap-3 mb-10">
            <span className="text-sm font-medium" style={{ color: !isYearly ? 'white' : '#475569' }}>Monthly</span>
            <button onClick={() => setIsYearly(v => !v)} className="relative w-11 h-6 rounded-full border-0 cursor-pointer transition-colors" style={{ background: isYearly ? 'var(--ind)' : 'rgba(255,255,255,.12)' }}>
              <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full block transition-transform" style={{ transform: isYearly ? 'translateX(20px)' : 'none' }} />
            </button>
            <span className="text-sm font-medium" style={{ color: isYearly ? 'white' : '#475569' }}>Yearly</span>
            {isYearly && <span className="text-xs font-bold px-2.5 py-1 rounded-md" style={{ background: 'rgba(79,70,229,.15)', border: '1px solid rgba(79,70,229,.3)', color: '#818cf8' }}>Save ~25%</span>}
          </div>

          <div className="sr grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRICING.map(plan => (
              <div key={plan.name} className={`price-card ${plan.featured ? 'feat' : ''}`} style={{ position: 'relative' }}>
                {plan.featured && <div className="text-xs font-bold px-2.5 py-1 rounded-md inline-block mb-4" style={{ background: 'rgba(79,70,229,.15)', border: '1px solid rgba(79,70,229,.3)', color: '#818cf8', letterSpacing: '.06em', textTransform: 'uppercase' }}>Most Popular</div>}
                <h3 className="font-bold text-white text-lg mb-1">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-7">{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  {plan.priceM === 0
                    ? <span className="font-extrabold text-white" style={{ fontSize: 52, letterSpacing: '-2px' }}>Free</span>
                    : <><span className="text-lg font-semibold text-slate-400">₹</span><span className="font-extrabold text-white" style={{ fontSize: 52, letterSpacing: '-2px' }}>{fmt(isYearly ? plan.priceY : plan.priceM)}</span><span className="text-slate-500 text-sm ml-1">/mo</span></>}
                </div>
                <p className="text-xs text-slate-600 mb-7">{plan.priceM === 0 ? 'No card required' : isYearly ? 'Billed annually' : 'Billed monthly'}</p>
                <button
                  onClick={plan.name === 'Scale' ? () => { window.location.href = 'mailto:hello@substrack.in' } : goSignup}
                  className="w-full py-3 rounded-xl font-bold text-sm mb-7 border-0 cursor-pointer transition-all"
                  style={plan.featured ? { background: 'linear-gradient(135deg,#4F46E5,#7c3aed)', color: 'white', boxShadow: '0 8px 24px rgba(79,70,229,.35)' } : { background: 'rgba(255,255,255,.06)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,.1)' }}>
                  {plan.cta}
                </button>
                <ul className="flex flex-col gap-3">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400">
                      <Check size={14} style={{ color: '#818cf8', marginTop: 2, flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded?.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <X size={14} style={{ color: '#475569', marginTop: 2, flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FAQ                                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '0 1.5rem 88px' }}>
        <div className="sr text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3 block">FAQ</span>
          <h2 className="font-extrabold text-white" style={{ fontSize: 'clamp(24px,4vw,40px)', letterSpacing: '-1px' }}>Common questions</h2>
        </div>
        <div className="sr">
          {FAQ.map((item, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--bdr)' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left py-5 flex items-center justify-between gap-4 text-white font-semibold text-base bg-transparent border-0 cursor-pointer transition-colors hover:text-indigo-300"
                style={{ fontSize: 15 }}>
                {item.q}
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-lg leading-none flex-shrink-0 transition-all"
                  style={{ border: '1px solid', borderColor: openFaq === i ? 'rgba(99,102,241,.4)' : 'rgba(255,255,255,.15)', color: openFaq === i ? '#818cf8' : '#475569', background: openFaq === i ? 'rgba(79,70,229,.12)' : 'transparent', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>
                  +
                </span>
              </button>
              <div className={`fq-a ${openFaq === i ? 'open' : ''}`}>{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CTA                                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ maxWidth: 1060, margin: '0 auto', padding: '0 1.5rem 112px' }}>
        <div className="sr cta-card">
          <div className="absolute inset-0 grid-bg pointer-events-none opacity-50" style={{ borderRadius: 28 }} />
          <div className="relative z-10">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4 block">Get started today</span>
            <h2 className="font-extrabold text-white leading-tight mb-5 mx-auto" style={{ fontSize: 'clamp(32px,6vw,58px)', letterSpacing: '-2px', maxWidth: 660 }}>
              Stop chasing payments.<br />
              <span className="gt">Start compounding revenue.</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed mb-10 mx-auto" style={{ maxWidth: 480, fontSize: 17 }}>
              Built for Indian businesses that want to automate their entire subscription lifecycle. Free to start. No credit card required.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={goSignup}
                className="beam-btn flex items-center gap-2 font-bold text-white rounded-xl border-0 cursor-pointer transition-all"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7c3aed)', padding: '16px 32px', fontSize: 16, boxShadow: '0 12px 40px rgba(79,70,229,.45)' }}>
                Start for free — no credit card
                <ArrowRight size={18} />
              </button>
              <button onClick={goLogin}
                className="flex items-center gap-2 font-medium text-slate-300 rounded-xl cursor-pointer transition-all"
                style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', padding: '16px 28px', fontSize: 16 }}>
                Sign into existing account
              </button>
            </div>
            <p className="text-slate-600 text-sm mt-5">50 subscribers free · No transaction fees · Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FOOTER                                                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <footer style={{ borderTop: '1px solid var(--bdr)', padding: '64px 1.5rem 40px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-14">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-lg font-bold text-white">Substrack</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">Subscription management built for India&apos;s growing businesses. Simple, powerful, and actually affordable.</p>
              <div className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg inline-flex" style={{ background: 'rgba(79,70,229,.1)', border: '1px solid rgba(99,102,241,.2)', color: '#818cf8' }}>
                <span className="dp w-1.5 h-1.5 rounded-full bg-indigo-400 block flex-shrink-0" />
                All systems operational
              </div>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Integrations', 'Changelog'] },
              { title: 'Developers', links: ['REST API', 'Frontend SDK', 'WordPress Plugin', 'Documentation'] },
              { title: 'Company', links: ['About', 'Contact', 'Privacy Policy', 'Terms of Service'] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{col.title}</h4>
                <ul className="flex flex-col gap-3">
                  {col.links.map(link => (
                    <li key={link}><a href="#" className="text-sm text-slate-500 hover:text-white transition-colors no-underline">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600" style={{ borderTop: '1px solid var(--bdr)', paddingTop: 32 }}>
            <p>&copy; {new Date().getFullYear()} Substrack. All rights reserved.</p>
            <p className="flex items-center gap-1.5">Built with <span style={{ color: '#818cf8' }}>♥</span> for India&apos;s builders · Indore, MP</p>
          </div>
        </div>
      </footer>
    </>
  )
}
