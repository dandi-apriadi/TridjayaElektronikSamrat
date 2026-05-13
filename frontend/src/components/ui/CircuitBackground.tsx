import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * CircuitBackground — animated SVG circuit grid for public pages.
 *
 * Performance optimizations:
 * - Detect mobile/low-power devices and reduce animations
 * - Use CSS containment for better rendering performance
 * - Disable complex framer-motion animations on mobile
 */
const CircuitBackground: React.FC = () => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Detect mobile/low-power devices
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      const isSmallScreen = window.innerWidth < 768;
      const isLowPower = Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
      setIsMobile(isSmallScreen || isLowPower);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const shouldReduceAnimations = prefersReducedMotion || isMobile;

  const containerRef = useRef<HTMLDivElement>(null);

  // Restart CSS animations when the tab becomes visible again
  // (browsers throttle/pause animations in background tabs)
  useEffect(() => {
    if (shouldReduceAnimations) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && containerRef.current) {
        // Force-restart all CSS animations by briefly toggling animation-name
        const animated = containerRef.current.querySelectorAll<SVGElement>(
          '.electric-line, .electric-line-alt, .node-pulse'
        );
        animated.forEach(el => {
          el.style.animationPlayState = 'paused';
          // Trigger reflow to reset animation
          void el.getBoundingClientRect();
          el.style.animationPlayState = 'running';
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [shouldReduceAnimations]);

  if (isMobile) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none select-none opacity-[0.4] dark:opacity-[0.25] will-change-transform"
    >
      <style>
        {`
          @keyframes circuitFlow {
            0% { stroke-dashoffset: 20; opacity: 0.15; }
            50% { opacity: 0.4; }
            100% { stroke-dashoffset: 0; opacity: 0.15; }
          }
          @keyframes nodePulse {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.2); }
          }
          .electric-line {
            stroke-dasharray: 4;
            animation: circuitFlow 4s linear infinite;
            animation-play-state: running;
            will-change: stroke-dashoffset, opacity;
          }
          .electric-line-alt {
            stroke-dasharray: 6;
            animation: circuitFlow 6s linear infinite reverse;
            animation-play-state: running;
            will-change: stroke-dashoffset, opacity;
          }
          .node-pulse {
            animation: nodePulse 3s ease-in-out infinite;
            animation-play-state: running;
            transform-origin: center;
            will-change: transform, opacity;
          }
        `}
      </style>
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="circuit-grid-optimized"
            x="0"
            y="0"
            width="25"
            height="25"
            patternUnits="userSpaceOnUse"
          >
            {/* Background Grid - Static */}
            <path
              d="M 5 0 V 10 H 0 M 15 25 V 15 H 25 M 0 12 H 8 V 18 H 15 V 25 M 25 5 H 20 V 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.1"
              className="text-primary/10 dark:text-sky-300/20"
            />

            {/* Animated Living Traces - disabled on mobile */}
            {!shouldReduceAnimations && (
              <path
                d="M 12 0 V 12 H 25 M 0 20 H 10 V 25"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.15"
                className="text-primary dark:text-sky-300 electric-line"
              />
            )}
            {!shouldReduceAnimations && (
              <path
                d="M 10 0 V 5 H 20 V 12 M 5 25 V 20 H 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.12"
                className="text-primary/60 dark:text-blue-400/80 electric-line-alt"
              />
            )}

            {/* Connection Nodes - static on mobile */}
            <circle
              cx="5"
              cy="10"
              r="0.3"
              className={`text-primary/40 dark:text-sky-300/70 fill-current${!shouldReduceAnimations ? ' node-pulse' : ''}`}
            />
            <circle
              cx="20"
              cy="12"
              r="0.3"
              className={`text-secondary/40 dark:text-blue-400/70 fill-current${!shouldReduceAnimations ? ' node-pulse' : ''}`}
              style={!shouldReduceAnimations ? { animationDelay: '1s' } : undefined}
            />
          </pattern>

          <linearGradient id="surge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="currentColor" className="text-primary" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="surge-gradient-dark" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Global Grid */}
        <rect width="100" height="100" fill="url(#circuit-grid-optimized)" />

        {/* Surge Pulses - disabled on mobile for performance */}
        {!shouldReduceAnimations && (
          <SurgePulse d="M 0 40 H 20 V 60 H 40 V 10 H 70 V 90 H 100" delay={0} className="dark:hidden" />
        )}
        {!shouldReduceAnimations && (
          <SurgePulse d="M 100 20 H 80 V 50 H 50 V 80 H 0" delay={5} className="dark:hidden" />
        )}
        {!shouldReduceAnimations && (
          <SurgePulse d="M 0 40 H 20 V 60 H 40 V 10 H 70 V 90 H 100" delay={0} className="hidden dark:block" gradient="url(#surge-gradient-dark)" />
        )}
        {!shouldReduceAnimations && (
          <SurgePulse d="M 100 20 H 80 V 50 H 50 V 80 H 0" delay={5} className="hidden dark:block" gradient="url(#surge-gradient-dark)" />
        )}
      </svg>
    </div>
  );
};

const SurgePulse: React.FC<{ d: string; delay: number; className?: string; gradient?: string }> = ({
  d,
  delay,
  className,
  gradient = 'url(#surge-gradient)',
}) => (
  <motion.path
    d={d}
    className={className}
    fill="none"
    stroke={gradient}
    strokeWidth="0.3"
    strokeLinecap="round"
    initial={{ pathLength: 0, opacity: 0 }}
    animate={{
      pathLength: [0, 0.4, 0.4, 0],
      pathOffset: [0, 0, 1, 1],
      opacity: [0, 0.8, 0.8, 0],
    }}
    transition={{
      duration: 12,
      repeat: Infinity,
      delay,
      ease: 'linear',
      // Prevent Framer Motion from pausing when tab is hidden
      repeatType: 'loop',
    }}
  />
);

export default CircuitBackground;
