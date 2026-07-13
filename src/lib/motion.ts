import { useEffect, useRef, useState } from "react";
import type { Transition, Variants } from "framer-motion";

/**
 * Central motion vocabulary for Pitch26. Keeping easings, springs and variants
 * in one place makes transitions feel consistent across pages instead of each
 * screen hand-rolling its own numbers.
 *
 * Everything here degrades gracefully: when the user has "reduce motion" turned
 * on at the OS level, the `useReducedMotionSafe` hook lets components fall back
 * to instant, movement-free states — which is what a polished, accessible app
 * should do.
 */

// Signature spring — snappy but settled, used for cards, pills and hero blocks.
export const spring: Transition = { type: "spring", stiffness: 320, damping: 26 };

// A softer spring for larger surfaces (scoreboards, modals).
export const springSoft: Transition = { type: "spring", stiffness: 220, damping: 28 };

// Standard eased tween for opacity/position fades.
export const ease: Transition = { duration: 0.4, ease: [0.22, 1, 0.36, 1] };

/** Page-level enter/exit — a gentle rise + fade on route change. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
};

/** Container that staggers its children on mount. */
export const staggerParent: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

/** Child item to pair with `staggerParent`. */
export const staggerChild: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: spring },
};

/**
 * Reduced-motion-aware flag. Returns true when the user asked the OS to
 * minimise animation; components should then skip movement and just render.
 */
export function useReducedMotionSafe(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/**
 * Animates a number from 0 → `value` over `duration` ms using rAF and an
 * ease-out curve. Returns the current display value. Respects reduced motion
 * (snaps straight to the target). Perfect for scorelines and stat counters.
 */
export function useCountUp(value: number, duration = 900): number {
  const reduced = useReducedMotionSafe();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || duration <= 0) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, reduced]);

  return display;
}
