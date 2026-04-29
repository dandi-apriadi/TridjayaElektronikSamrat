/**
 * useAnimation.ts
 * Centralized, performance-safe animation configurations for Framer Motion.
 *
 * RULES:
 * - NEVER use whileHover on cards — use CSS :hover instead
 * - NEVER use stagger > 0.4s total
 * - ALWAYS use viewport={{ once: true }} on whileInView
 * - ALWAYS clamp stagger: Math.min(i * 0.06, 0.4)
 */

/** Safe fade + slide up for section children. Use with viewport={{ once: true }} */
export const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.35, delay: Math.min(delay, 0.4), ease: [0.22, 1, 0.36, 1] },
});

/** Safe stagger for lists. Index-based with a hard 400ms cap. */
export const staggerFadeUp = (index: number) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: {
    duration: 0.3,
    delay: Math.min(index * 0.06, 0.4),
    ease: [0.22, 1, 0.36, 1],
  },
});

/** Simple opacity fade only - cheapest possible animation */
export const fadein = (delay = 0) => ({
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true },
  transition: { duration: 0.3, delay: Math.min(delay, 0.4) },
});

/** Entry animation for hero elements - runs once on mount */
export const heroEntry = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
});

/** Slide in from left */
export const slideInLeft = (delay = 0) => ({
  initial: { opacity: 0, x: -24 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.4, delay: Math.min(delay, 0.4), ease: [0.22, 1, 0.36, 1] },
});

/** Slide in from right */
export const slideInRight = (delay = 0) => ({
  initial: { opacity: 0, x: 24 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.4, delay: Math.min(delay, 0.4), ease: [0.22, 1, 0.36, 1] },
});

/** Scale in - for icons and small elements */
export const scaleIn = (delay = 0) => ({
  initial: { opacity: 0, scale: 0.92 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: { once: true },
  transition: { duration: 0.3, delay: Math.min(delay, 0.4), ease: [0.34, 1.56, 0.64, 1] },
});
