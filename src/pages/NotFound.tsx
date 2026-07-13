import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { springSoft, useReducedMotionSafe } from "@/lib/motion";

/**
 * 404 page — shown when a route does not exist. Branded, animated and entirely
 * self-contained (no third-party badges or assets).
 */
export default function NotFound() {
  const reduced = useReducedMotionSafe();
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <motion.h1
          initial={reduced ? false : { scale: 0.8, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={springSoft}
          className="display text-8xl leading-none text-primary sm:text-9xl"
        >
          404
        </motion.h1>
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          className="mt-4 text-muted-foreground"
        >
          Off the pitch. This page doesn't exist.
        </motion.p>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Link
            to="/"
            className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Back to the tournament
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
