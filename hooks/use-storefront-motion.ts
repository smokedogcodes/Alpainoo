"use client";

import { useSyncExternalStore, type PointerEvent } from "react";
import { useMotionValue, useSpring } from "framer-motion";

const desktopQuery = "(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
const reducedQuery = "(prefers-reduced-motion: reduce)";

function subscribe(query: string, onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const subscribeDesktop = (onChange: () => void) => subscribe(desktopQuery, onChange);
const subscribeReduced = (onChange: () => void) => subscribe(reducedQuery, onChange);
const getDesktop = () => window.matchMedia(desktopQuery).matches;
const getReduced = () => window.matchMedia(reducedQuery).matches;
const serverDesktop = () => false;
const serverReduced = () => true;

export function useDesktopMotion() {
  return useSyncExternalStore(subscribeDesktop, getDesktop, serverDesktop);
}

export function useStorefrontReducedMotion() {
  return useSyncExternalStore(subscribeReduced, getReduced, serverReduced);
}

export function useCardTilt(active = true) {
  const desktop = useDesktopMotion();
  const enabled = desktop && active;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(x, { stiffness: 230, damping: 25, mass: 0.6 });
  const rotateY = useSpring(y, { stiffness: 230, damping: 25, mass: 0.6 });

  function reset() {
    x.set(0);
    y.set(0);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!enabled || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.max(-0.5, Math.min(0.5, (event.clientX - bounds.left) / bounds.width - 0.5));
    const relativeY = Math.max(-0.5, Math.min(0.5, (event.clientY - bounds.top) / bounds.height - 0.5));
    x.set(relativeY * -7);
    y.set(relativeX * 9);
  }

  return {
    style: enabled
      ? { rotateX, rotateY, transformPerspective: 1200, transformStyle: "preserve-3d" as const }
      : undefined,
    onPointerMove: enabled ? onPointerMove : undefined,
    onPointerLeave: reset,
    onPointerCancel: reset,
    onBlur: reset,
  };
}
