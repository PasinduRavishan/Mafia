import gsap from 'gsap'

/**
 * Shatter a card element into N shards that fly off the screen.
 * The card element is expected to have position:relative.
 */
export function shatterCard(
  cardEl: HTMLElement,
  numShards = 14,
  onComplete?: () => void,
): gsap.core.Timeline {
  const rect = cardEl.getBoundingClientRect()

  // Create shard divs over the card
  const shards: HTMLElement[] = []
  const clipShapes = [
    'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
    'polygon(25% 0%, 75% 0%, 100% 50%, 50% 100%, 0% 50%)',
    'polygon(0 0, 60% 0, 100% 40%, 40% 100%, 0 60%)',
    'polygon(40% 0, 100% 0, 100% 60%, 60% 100%, 0 40%)',
    'polygon(50% 0, 100% 100%, 0 100%)',
    'polygon(0 0, 100% 0, 60% 100%)',
    'polygon(30% 0, 70% 0, 100% 50%, 70% 100%, 30% 100%, 0 50%)',
  ]

  for (let i = 0; i < numShards; i++) {
    const shard = document.createElement('div')
    const size  = 40 + Math.random() * 60
    shard.className = 'shard'
    shard.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * rect.width}px;
      top: ${Math.random() * rect.height}px;
      clip-path: ${clipShapes[i % clipShapes.length]};
      background: linear-gradient(135deg, #1a1a2e 50%, #e8a838 100%);
      opacity: 1;
      z-index: 999;
    `
    cardEl.appendChild(shard)
    shards.push(shard)
  }

  const tl = gsap.timeline({
    onComplete: () => {
      shards.forEach(s => s.remove())
      onComplete?.()
    },
  })

  // Flash the card red/white before shattering
  tl.to(cardEl, { filter: 'brightness(3) saturate(0)', duration: 0.1 })
    .to(cardEl,  { filter: 'brightness(1) saturate(1)', duration: 0.1 })

  // Explode shards
  tl.to(shards, {
    x: () => (Math.random() - 0.5) * 400,
    y: () => Math.random() * 500 + 100,
    rotation: () => (Math.random() - 0.5) * 360,
    scale: () => 0.3 + Math.random() * 0.8,
    opacity: 0,
    duration: 0.9,
    stagger: 0.03,
    ease: 'power2.out',
  }, '-=0.05')

  // Fade out the original card
  tl.to(cardEl, { opacity: 0, scale: 0.8, duration: 0.4 }, '-=0.6')

  return tl
}
