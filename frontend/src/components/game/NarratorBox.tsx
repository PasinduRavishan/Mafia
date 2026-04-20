import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { typewriterWords } from '../../animations/typewriterAnimation'

interface Props {
  text: string
  phaseLabel?: string
}

export default function NarratorBox({ text, phaseLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!textRef.current || !text) return
    // Animate box entrance
    gsap.fromTo(containerRef.current,
      { y: 20, opacity: 0 },
      { y: 0,  opacity: 1, duration: 0.5, ease: 'power2.out' }
    )
    // Typewriter the narrator text
    typewriterWords(textRef.current, text, 2)
  }, [text])

  if (!text) return null

  return (
    <div
      ref={containerRef}
      className="glass-panel rounded-2xl px-5 py-4 max-w-xl mx-auto"
      style={{ borderColor: 'rgba(232,168,56,0.3)' }}
    >
      {phaseLabel && (
        <p className="font-inter text-xs text-accent/60 uppercase tracking-widest mb-2">
          {phaseLabel}
        </p>
      )}
      <div className="flex gap-3 items-start">
        {/* Narrator eye icon */}
        <div className="text-accent opacity-70 text-lg mt-0.5 shrink-0">👁</div>
        <div
          ref={textRef}
          className="font-lora text-sm md:text-base text-white/85 leading-relaxed italic typewriter-cursor"
        />
      </div>
    </div>
  )
}
