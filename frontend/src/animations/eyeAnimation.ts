import gsap from 'gsap'

/**
 * Animate eyelids CLOSING — night falls.
 * Slides .eyelid-top down and .eyelid-bottom up until they meet.
 */
export function closeEyes(
  topEl: HTMLElement,
  bottomEl: HTMLElement,
  tintEl: HTMLElement | null,
  onComplete?: () => void,
): gsap.core.Timeline {
  return gsap.timeline({ onComplete })
    .to(topEl,    { y: '0%', duration: 1.4, ease: 'power2.inOut' })
    .to(bottomEl, { y: '0%', duration: 1.4, ease: 'power2.inOut' }, '<')
    .to(tintEl,   { opacity: 1, duration: 0.3 }, '-=0.3')
}

/**
 * Open eyelids to a SLIT (partial — Mafia/Detective/Medic peek).
 * tintColor sets the color wash: red / blue / green
 */
export function openEyesSlit(
  topEl: HTMLElement,
  bottomEl: HTMLElement,
  tintEl: HTMLElement | null,
  slitPct = 85,             // how much stays covered (85% = narrow slit)
  onComplete?: () => void,
): gsap.core.Timeline {
  return gsap.timeline({ onComplete })
    .to(topEl,    { y: `-${slitPct}%`, duration: 1.2, ease: 'power2.inOut' })
    .to(bottomEl, { y: `${slitPct}%`, duration: 1.2, ease: 'power2.inOut' }, '<')
    .to(tintEl,   { opacity: 0.6, duration: 0.5 }, '-=0.5')
}

/**
 * Open eyelids FULLY — morning arrives / human role turn.
 */
export function openEyesFull(
  topEl: HTMLElement,
  bottomEl: HTMLElement,
  tintEl: HTMLElement | null,
  onComplete?: () => void,
): gsap.core.Timeline {
  return gsap.timeline({ onComplete })
    .to(topEl,    { y: '-100%', duration: 1.6, ease: 'power2.inOut' })
    .to(bottomEl, { y: '100%',  duration: 1.6, ease: 'power2.inOut' }, '<')
    .to(tintEl,   { opacity: 0, duration: 0.4 }, '-=0.4')
}
