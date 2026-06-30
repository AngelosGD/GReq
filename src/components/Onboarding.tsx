import { useState, useEffect, useCallback } from 'react'
import type { Slide } from '../types'

const slides: Slide[] = [
  {
    number: '01',
    title: 'Visual API Builder',
    description: 'Construye peticiones HTTP arrastrando nodos visuales. Conecta URL, método, cabeceras y cuerpo en un canvas interactivo.',
    icon: 'nodes',
  },
  {
    number: '02',
    title: 'Conecta & Ejecuta',
    description: 'Encadena múltiples solicitudes, pasa datos entre nodos y ejecuta tu flujo completo de API con un solo clic.',
    icon: 'flow',
  },
  {
    number: '03',
    title: 'Inspecciona & Depura',
    description: 'Visualiza respuestas con resaltado de sintaxis. Revisa cabeceras, códigos de estado y tiempos de respuesta.',
    icon: 'inspect',
  },
]

function NodesIllustration() {
  return (
    <svg viewBox="0 0 400 280" className="w-full h-full" fill="none">
      <defs>
        <linearGradient id="nodeUrl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.05"/>
        </linearGradient>
        <linearGradient id="nodeGet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05"/>
        </linearGradient>
        <linearGradient id="nodeResp" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.05"/>
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.1"/>
        </filter>
      </defs>

      <rect x="20" y="95" width="100" height="70" rx="14" fill="url(#nodeUrl)" className="stroke-emerald-400" strokeWidth="1.5" filter="url(#shadow)"/>
      <circle cx="35" cy="100" r="3" fill="#10b981"/>
      <text x="70" y="137" textAnchor="middle" className="fill-emerald-400 text-sm font-mono font-bold">URL</text>
      <line x1="120" y1="130" x2="155" y2="130" className="stroke-emerald-400/60" strokeWidth="2" strokeDasharray="6 3"/>
      <polygon points="155,125 165,130 155,135" className="fill-emerald-400/60"/>

      <rect x="165" y="95" width="100" height="70" rx="14" fill="url(#nodeGet)" className="stroke-blue-400" strokeWidth="1.5" filter="url(#shadow)"/>
      <circle cx="180" cy="100" r="3" fill="#3b82f6"/>
      <rect x="200" y="115" width="30" height="18" rx="4" className="fill-blue-400/20"/>
      <text x="215" y="128" textAnchor="middle" className="fill-blue-400 text-[10px] font-mono font-bold">GET</text>
      <line x1="265" y1="130" x2="300" y2="130" className="stroke-blue-400/60" strokeWidth="2" strokeDasharray="6 3"/>
      <polygon points="300,125 310,130 300,135" className="fill-blue-400/60"/>

      <rect x="310" y="95" width="80" height="70" rx="14" fill="url(#nodeResp)" className="stroke-violet-400" strokeWidth="1.5" filter="url(#shadow)"/>
      <circle cx="325" cy="100" r="3" fill="#8b5cf6"/>
      <text x="350" y="137" textAnchor="middle" className="fill-violet-400 text-sm font-mono font-bold">Resp</text>

      <circle cx="50" cy="60" r="5" className="fill-emerald-400 animate-glow" />
      <circle cx="200" cy="55" r="5" className="fill-blue-400 animate-glow stagger-2" />
      <circle cx="345" cy="60" r="5" className="fill-violet-400 animate-glow stagger-4" />

      <circle cx="50" cy="230" r="5" className="fill-emerald-400/40" />
      <circle cx="200" cy="235" r="5" className="fill-blue-400/40" />
      <circle cx="345" cy="230" r="5" className="fill-violet-400/40" />
    </svg>
  )
}

function FlowIllustration() {
  return (
    <svg viewBox="0 0 400 280" className="w-full h-full" fill="none">
      <defs>
        <filter id="shadow2">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.1"/>
        </filter>
      </defs>

      <rect x="30" y="55" width="130" height="70" rx="14" className="fill-emerald-500/10 stroke-emerald-400" strokeWidth="1.5" filter="url(#shadow2)"/>
      <rect x="45" y="70" width="24" height="16" rx="4" className="fill-emerald-400/20"/>
      <text x="57" y="82" textAnchor="middle" className="fill-emerald-400 text-[9px] font-bold font-mono">AUTH</text>
      <text x="95" y="97" className="fill-emerald-400 text-xs font-mono font-bold">Auth API</text>

      <line x1="160" y1="90" x2="195" y2="90" className="stroke-zinc-400/50" strokeWidth="2" strokeDasharray="6 3"/>
      <polygon points="195,85 205,90 195,95" className="fill-zinc-400/50"/>

      <rect x="205" y="55" width="130" height="70" rx="14" className="fill-blue-500/10 stroke-blue-400" strokeWidth="1.5" filter="url(#shadow2)"/>
      <rect x="220" y="70" width="24" height="16" rx="4" className="fill-blue-400/20"/>
      <text x="232" y="82" textAnchor="middle" className="fill-blue-400 text-[9px] font-bold font-mono">GET</text>
      <text x="270" y="97" className="fill-blue-400 text-xs font-mono font-bold">/users</text>

      <line x1="270" y1="55" x2="270" y2="30" className="stroke-zinc-400/50" strokeWidth="2"/>
      <polygon points="265,30 270,23 275,30" className="fill-zinc-400/50"/>

      <rect x="220" y="15" width="100" height="40" rx="10" className="fill-violet-500/10 stroke-violet-400" strokeWidth="1.5" filter="url(#shadow2)"/>
      <text x="270" y="34" textAnchor="middle" className="fill-violet-400 text-xs font-mono font-bold">200 OK</text>

      <circle cx="95" cy="195" r="26" className="fill-emerald-500/15 stroke-emerald-400/60" strokeWidth="1.5"/>
      <circle cx="95" cy="195" r="18" className="fill-emerald-500/10 stroke-emerald-400/40" strokeWidth="1"/>
      <polygon points="88,187 105,195 88,203" className="fill-emerald-400"/>

      <text x="280" y="205" textAnchor="middle" className="fill-zinc-400 text-sm font-mono">→ flujo completo</text>
    </svg>
  )
}

function InspectIllustration() {
  return (
    <svg viewBox="0 0 400 280" className="w-full h-full" fill="none">
      <defs>
        <filter id="shadow3">
          <feDropShadow dx="0" dy="2" stdDeviation="6" floodOpacity="0.08"/>
        </filter>
        <linearGradient id="editorBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1e2e" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#181825" stopOpacity="0.95"/>
        </linearGradient>
      </defs>

      <rect x="25" y="25" width="350" height="230" rx="12" fill="url(#editorBg)" stroke="#313244" strokeWidth="1.5" filter="url(#shadow3)"/>
      <rect x="25" y="25" width="350" height="38" rx="12" fill="#181825" stroke="#313244" strokeWidth="1.5"/>
      <circle cx="48" cy="44" r="5" fill="#f38ba8"/>
      <circle cx="65" cy="44" r="5" fill="#fab387"/>
      <circle cx="82" cy="44" r="5" fill="#a6e3a1"/>

      <text x="108" y="49" fill="#6c7086" className="text-[11px] font-mono">response.json — GReq</text>

      <text x="42" y="92" className="fill-#cba6f7 text-sm font-mono" fill="#cba6f7">{'{'}</text>
      <text x="55" y="115" className="fill-#89b4fa text-sm font-mono" fill="#89b4fa">"status"</text>
      <text x="130" y="115" className="fill-#a6adc8 text-sm font-mono" fill="#a6adc8">:</text>
      <text x="145" y="115" className="fill-#a6e3a1 text-sm font-mono" fill="#a6e3a1">"ok"</text>
      <text x="55" y="138" className="fill-#89b4fa text-sm font-mono" fill="#89b4fa">"data"</text>
      <text x="115" y="138" className="fill-#a6adc8 text-sm font-mono" fill="#a6adc8">:</text>
      <text x="128" y="138" className="fill-#cba6f7 text-sm font-mono" fill="#cba6f7">{'{'}</text>
      <text x="68" y="161" className="fill-#89b4fa text-sm font-mono" fill="#89b4fa">"id"</text>
      <text x="100" y="161" className="fill-#a6adc8 text-sm font-mono" fill="#a6adc8">:</text>
      <text x="115" y="161" className="fill-#f9e2af text-sm font-mono" fill="#f9e2af">42</text>
      <text x="68" y="184" className="fill-#89b4fa text-sm font-mono" fill="#89b4fa">"name"</text>
      <text x="128" y="184" className="fill-#a6adc8 text-sm font-mono" fill="#a6adc8">:</text>
      <text x="143" y="184" className="fill-#a6e3a1 text-sm font-mono" fill="#a6e3a1">"API Flow"</text>
      <text x="55" y="207" className="fill-#cba6f7 text-sm font-mono" fill="#cba6f7">{'}'}</text>
      <text x="42" y="230" className="fill-#cba6f7 text-sm font-mono" fill="#cba6f7">{'}'}</text>

      <rect x="275" y="100" width="80" height="55" rx="8" className="fill-emerald-500/10 stroke-emerald-400/40" strokeWidth="1"/>
      <text x="315" y="122" textAnchor="middle" className="fill-emerald-400 text-[10px] font-mono font-bold">200</text>
      <text x="315" y="140" textAnchor="middle" className="fill-emerald-400/60 text-[9px] font-mono">OK</text>
    </svg>
  )
}

const illustrations = [NodesIllustration, FlowIllustration, InspectIllustration]

interface Props {
  onDone: () => void
}

export function Onboarding({ onDone }: Props) {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const slide = slides[current]
  const isLast = current === slides.length - 1
  const Illustration = illustrations[current]

  const goTo = useCallback((index: number) => {
    setAnimating(true)
    requestAnimationFrame(() => {
      setCurrent(index)
      requestAnimationFrame(() => {
        setAnimating(false)
      })
    })
  }, [])

  const next = useCallback(() => {
    if (isLast) {
      onDone()
    } else {
      goTo(current + 1)
    }
  }, [isLast, current, goTo, onDone])

  const prev = useCallback(() => {
    if (current > 0) goTo(current - 1)
  }, [current, goTo])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [next, prev])

  const animClass = animating
    ? `opacity-0 scale-95`
    : `opacity-100 scale-100`

  return (
    <div className="relative w-full min-h-[100dvh] flex flex-col bg-white overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 md:px-12 lg:px-24 gap-8 lg:gap-16">
        <div className="w-full max-w-md lg:max-w-lg flex-shrink-0">
          <div className={`aspect-[4/3] w-full transition-all duration-500 ease-out ${animClass}`} key={`ill-${current}`}>
            <Illustration />
          </div>
        </div>

        <div className="w-full max-w-lg text-center lg:text-left" key={`text-${current}`}>
          <div className={`transition-all duration-500 ease-out delay-75 ${animClass}`}>
            <span className="inline-block text-sm font-mono font-semibold text-emerald-500 mb-3 tracking-wider">
              {slide.number}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 mb-4 leading-tight">
              {slide.title}
            </h2>
            <p className="text-base md:text-lg text-zinc-600 leading-relaxed max-w-md lg:max-w-none">
              {slide.description}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-6 md:px-12 lg:px-24 py-8 border-t border-zinc-200">
        <div className="flex items-center justify-between max-w-3xl mx-auto lg:ml-0">
          <button
            onClick={prev}
            disabled={current === 0}
            className="px-5 py-2.5 text-sm font-medium rounded-xl
                       text-zinc-600
                       hover:bg-zinc-100
                       disabled:opacity-0 disabled:pointer-events-none
                       transition-all duration-200"
          >
            ← Anterior
          </button>

          <div className="flex items-center gap-3">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all duration-500 ease-out ${
                  i === current
                    ? 'w-8 bg-emerald-500'
                    : 'w-2 bg-zinc-300 hover:bg-zinc-400'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {!isLast && (
              <button
                onClick={onDone}
                className="px-4 py-2.5 text-sm font-medium rounded-xl
                           text-zinc-500
                           hover:text-zinc-700
                           transition-colors"
              >
                Saltar
              </button>
            )}
            <button
              onClick={next}
              className="px-6 py-2.5 text-sm font-semibold rounded-xl
                         bg-zinc-900 text-white
                         hover:bg-zinc-800
                         active:scale-95 transition-all duration-200
                         shadow-sm"
            >
              {isLast ? 'Comenzar' : 'Siguiente →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
