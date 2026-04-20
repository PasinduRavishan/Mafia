import gsap from 'gsap'

/**
 * Word-by-word typewriter animation on a container element.
 * Splits text into <span> per word, then stagger-fades them in.
 */
export function typewriterWords(
  container: HTMLElement,
  text: string,
  wordsPerSecond = 2,
  onComplete?: () => void,
): gsap.core.Timeline {
  // Build word spans
  container.innerHTML = text
    .split(' ')
    .map(w => `<span class="tw-word" style="opacity:0;display:inline-block;margin-right:0.28em">${w}</span>`)
    .join('')

  const words = container.querySelectorAll('.tw-word')
  const stagger = 1 / wordsPerSecond

  return gsap.timeline({ onComplete })
    .to(words, {
      opacity: 1,
      y: 0,
      duration: 0.25,
      stagger,
      ease: 'power1.out',
    })
}

/**
 * Simple char-by-char reveal — slower, more dramatic (for short key lines).
 */
export function typewriterChars(
  container: HTMLElement,
  text: string,
  charsPerSecond = 20,
  onComplete?: () => void,
): gsap.core.Timeline {
  container.innerHTML = text
    .split('')
    .map(c => `<span style="opacity:0">${c === ' ' ? '&nbsp;' : c}</span>`)
    .join('')

  const chars = container.querySelectorAll('span')
  return gsap.timeline({ onComplete })
    .to(chars, {
      opacity: 1,
      duration: 0.05,
      stagger: 1 / charsPerSecond,
      ease: 'none',
    })
}
