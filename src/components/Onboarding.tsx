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

function Slide1Media() {
  return (
    <img
      src="/slide1.png"
      alt="Visual API Builder"
      className="w-full h-full object-contain rounded-2xl"
    />
  )
}

function Slide2Media() {
  return (
    <video
      src="/video-slide2.mp4"
      className="w-full h-full object-contain rounded-2xl"
      autoPlay
      loop
      muted
      playsInline
    />
  )
}

function Slide3Media() {
  return (
    <div className="w-full h-full">
      <div className="grid grid-cols-5 grid-rows-3 gap-2 h-full">
        <video
          src="/video-slide3.mp4"
          className="col-span-3 row-span-3 w-full h-full object-cover rounded-2xl"
          autoPlay
          loop
          muted
          playsInline
        />
        <img
          src="/slide3.png"
          alt="Inspecciona & Depura"
          className="col-span-2 row-span-2 w-full h-full object-cover rounded-2xl"
        />
        <img
          src="/slide3(2).png"
          alt="Inspecciona & Depura"
          className="col-span-2 row-span-1 w-full h-full object-cover rounded-2xl"
        />
      </div>
    </div>
  )
}

const MediaComponents = [Slide1Media, Slide2Media, Slide3Media]



interface Props {
  onDone: () => void
}

export function Onboarding({ onDone }: Props) {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const slide = slides[current]
  const isLast = current === slides.length - 1
  const Media = MediaComponents[current]

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
          <div className="w-full aspect-[4/3] transition-all duration-500 ease-out" key={`ill-${current}`}>
            <Media />
          </div>
        </div>

        <div className="w-full max-w-lg text-center" key={`text-${current}`}>
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
        <div className="flex items-center gap-4 max-w-lg mx-auto">
          <div className="flex-1 flex justify-start">
            <button
              onClick={prev}
              disabled={current === 0}
              className="px-5 py-2.5 text-sm font-medium rounded-xl
                         text-zinc-600
                         hover:bg-zinc-100
                         disabled:invisible disabled:pointer-events-none
                         transition-all duration-200"
            >
              ← Anterior
            </button>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
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

          <div className="flex-1 flex justify-end items-center gap-3">
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
              className="px-6 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap
                         bg-zinc-900 text-white
                         hover:bg-zinc-800 hover:-translate-y-0.5
                         active:scale-95 transition-all duration-200
                         shadow-sm hover:shadow-md"
            >
              {isLast ? 'Comenzar' : 'Siguiente →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
