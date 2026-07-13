import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Defines the structure for a single tab in the bottom navigation.
 */
export interface TabItem {
  to: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  featured?: boolean;
}

interface BottomTabsProps {
  tabs: TabItem[];
  accentColor?: string;
}

/**
 * A bottom navigation bar component for mobile layouts.
 * Features a spring-animated active indicator and gesture-based interaction.
 *
 * @param props.tabs - Array of tab configurations.
 * @param props.accentColor - The color used for the active indicator and highlights.
 */
export function BottomTabs({ tabs, accentColor = "#e6b800" }: BottomTabsProps) {
  const location = useLocation();
  const { pathname, search } = location;
  const fromState = (location.state as { from?: string } | null)?.from;
  const effectivePath =
    pathname === "/auth" && typeof fromState === "string" ? fromState : pathname;
  const effectiveFull =
    pathname === "/auth" && typeof fromState === "string" ? fromState : `${pathname}${search}`;
  const navigate = useNavigate();

  // Determine which tab is currently active based on the URL path (and query,
  // when the tab explicitly targets one — e.g. "/fixtures?view=knockout").
  let activeIndex = -1;
  let bestScore = -1;
  tabs.forEach((t, i) => {
    const [tPath, tQuery] = t.to.split("?");
    let match = false;
    let score = tPath.length;
    if (tQuery) {
      match = effectiveFull === t.to;
      score += 1000; // prefer query-specific matches over generic path matches
    } else if (tPath === "/") {
      match = effectivePath === "/";
    } else {
      // Generic path tab shouldn't win when a query-specific sibling matches.
      const someSiblingQueryMatches = tabs.some((o) => {
        const [oP, oQ] = o.to.split("?");
        return oQ && oP === tPath && effectiveFull === o.to;
      });
      match =
        !someSiblingQueryMatches &&
        (effectivePath === tPath || effectivePath.startsWith(tPath + "/"));
    }
    if (match && score > bestScore) {
      bestScore = score;
      activeIndex = i;
    }
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cellW, setCellW] = useState(0);
  const [pressing, setPressing] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const pressingRef = useRef(false);
  const pointerOwnerRef = useRef<HTMLElement | null>(null);
  const previewIndexRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  // Measure and track the width of each tab cell for animation positioning.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setCellW(el.getBoundingClientRect().width / tabs.length);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);

  const getRelativeX = (clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(rect.width, clientX - rect.left));
  };

  const getTouchingIndex = (relativeX: number) => {
    if (cellW === 0) return activeIndex;
    return Math.max(0, Math.min(tabs.length - 1, Math.floor(relativeX / cellW)));
  };

  useEffect(() => {
    pressingRef.current = pressing;
  }, [pressing]);
  useEffect(() => {
    previewIndexRef.current = previewIndex;
  }, [previewIndex]);

  const baseCenter = (i: number) => i * cellW + cellW / 2;
  const rawCenter =
    pressing && dragX != null ? dragX : baseCenter(activeIndex >= 0 ? activeIndex : 0);
  const totalW = cellW * tabs.length;
  const halfW = (pressing ? Math.min(cellW - 18, 64) : cellW - 12) / 2;
  const indicatorCenter = Math.max(halfW, Math.min(totalW - halfW, rawCenter));
  const hoverIndex = pressing ? (previewIndex ?? activeIndex) : activeIndex;

  /**
   * Handles pointer capture to start a "swipe" or drag interaction across the tabs.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLAnchorElement>, i: number) => {
    pointerOwnerRef.current = e.currentTarget;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPressing(true);
    const rx = getRelativeX(e.clientX);
    setDragX(rx);
    const idx = getTouchingIndex(rx);
    previewIndexRef.current = idx;
    setPreviewIndex(idx);
    suppressClickRef.current = false;
  };

  /**
   * Updates the preview indicator position as the user drags across the tabs.
   */
  const onPointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (!pressingRef.current) return;
    const rx = getRelativeX(e.clientX);
    setDragX(rx);
    const idx = getTouchingIndex(rx);
    previewIndexRef.current = idx;
    suppressClickRef.current = true;
    setPreviewIndex((prev) => (prev !== idx ? idx : prev));
  };

  /**
   * Finalizes the navigation based on the position where the pointer was released.
   */
  const onPointerFinish = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (pointerOwnerRef.current?.hasPointerCapture?.(e.pointerId)) {
      pointerOwnerRef.current.releasePointerCapture?.(e.pointerId);
    }
    const targetIndex = previewIndexRef.current ?? activeIndex;
    setPressing(false);
    setPreviewIndex(null);
    previewIndexRef.current = null;
    setDragX(null);
    if (targetIndex !== activeIndex && targetIndex >= 0) {
      navigate(tabs[targetIndex].to);
    }
  };

  const idleW = cellW - 12;
  const dragW = Math.min(cellW - 18, 64);
  const indicatorW = pressing ? dragW : idleW;

  const safeActive = activeIndex >= 0 ? activeIndex : 0;

  return (
    <nav
      data-bottom-tabs-root="true"
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-50 px-3 lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      <div
        ref={containerRef}
        className="relative mx-auto grid h-16 max-w-md rounded-3xl border"
        style={{
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          background: "rgba(20, 30, 25, 0.55)",
          borderColor: "var(--glass-border)",
          backdropFilter: "blur(28px) saturate(200%)",
          WebkitBackdropFilter: "blur(28px) saturate(200%)",
          boxShadow: `0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.28), 0 -4px 24px -6px ${accentColor}33`,
        }}
      >
        {cellW > 0 && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute top-1.5 bottom-1.5 overflow-hidden rounded-2xl"
            initial={false}
            animate={{
              x: indicatorCenter - indicatorW / 2,
              y: pressing ? -5 : 0,
              width: indicatorW,
              scale: pressing ? 1.08 : 1,
            }}
            transition={
              pressing
                ? { type: "spring", stiffness: 900, damping: 42, mass: 0.5 }
                : { type: "spring", stiffness: 760, damping: 52, mass: 0.78 }
            }
            style={{
              left: 0,
              background: pressing ? `${accentColor}47` : `${accentColor}24`,
              border: `1px solid ${accentColor}52`,
              backdropFilter: "blur(18px) saturate(170%)",
              WebkitBackdropFilter: "blur(18px) saturate(170%)",
              boxShadow: pressing
                ? `0 12px 32px -10px ${accentColor}99, inset 0 1px 0 rgba(255,255,255,0.45)`
                : "inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            {pressing && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.18) 100%)",
                  mixBlendMode: "overlay",
                }}
              />
            )}
          </motion.div>
        )}

        {tabs.map((t, i) => {
          const Icon = t.icon;
          const active = i === safeActive;
          const hovered = i === hoverIndex;
          const featured = !!t.featured;
          return (
            <Link
              key={t.to}
              to={t.to}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                if (i !== safeActive) navigate(t.to);
              }}
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerFinish}
              onPointerCancel={onPointerFinish}
              style={
                {
                  WebkitTouchCallout: "none",
                  WebkitUserSelect: "none",
                  userSelect: "none",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "none",
                  color: featured && !active ? accentColor : undefined,
                } as React.CSSProperties
              }
              className={`relative z-10 flex select-none flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                featured ? "text-foreground" : "text-foreground/70"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {featured && !active && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-3 h-1.5 w-1.5 rounded-full"
                  style={{ background: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
                />
              )}
              <motion.div
                animate={{
                  scale: featured
                    ? hovered && pressing
                      ? 1.35
                      : 1.15
                    : hovered && pressing
                      ? 1.28
                      : hovered
                        ? 1.06
                        : 1,
                  y: hovered && pressing ? -2 : 0,
                }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                className={hovered ? "text-foreground" : ""}
              >
                <Icon
                  size={featured ? 24 : 20}
                  strokeWidth={hovered ? 2.4 : featured ? 2.2 : 1.8}
                />
              </motion.div>
              <motion.span
                animate={{
                  scale: hovered && pressing ? 1.1 : 1,
                  y: hovered && pressing ? -1 : 0,
                }}
                transition={{ type: "spring", stiffness: 360, damping: 26 }}
                className={hovered ? "font-bold text-foreground" : featured ? "font-bold" : ""}
              >
                {t.label}
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
