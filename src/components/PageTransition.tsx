import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { pageVariants, useReducedMotionSafe } from "@/lib/motion";

/**
 * Wraps a route's content so every page enters with the same gentle rise+fade
 * and exits cleanly. When the user prefers reduced motion, it renders a plain
 * container with no transform so nothing moves.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionSafe();
  if (reduced) return <div>{children}</div>;
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}
