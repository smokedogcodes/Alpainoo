"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type NavProgressContextValue = {
  start: () => void;
};

const NavProgressContext = createContext<NavProgressContextValue>({ start: () => {} });

export function useNavProgress() {
  return useContext(NavProgressContext);
}

/** Instant click feedback + progress bar so navigations never feel “dead” */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);

  const start = useCallback(() => {
    setActive(true);
    setWidth(12);
    window.requestAnimationFrame(() => setWidth(42));
  }, []);

  // Finish when the route actually changes
  useEffect(() => {
    if (!active) {
      setWidth(0);
      return;
    }
    setWidth(100);
    const t = window.setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 220);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only complete on route change
  }, [pathname, searchParams]);

  // Safety: never leave the bar stuck
  useEffect(() => {
    if (!active) return;
    const safety = window.setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 4000);
    return () => window.clearTimeout(safety);
  }, [active]);

  // Start immediately on internal link clicks (before RSC finishes)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const next = url.pathname + url.search;
        const current = window.location.pathname + window.location.search;
        if (next === current) return;
        start();
      } catch {
        /* ignore */
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  const value = useMemo(() => ({ start }), [start]);

  return (
    <NavProgressContext.Provider value={value}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
      >
        <div
          className="h-full bg-sage transition-[width,opacity] duration-150 ease-out"
          style={{
            width: `${width}%`,
            opacity: active || width > 0 ? 1 : 0,
          }}
        />
      </div>
    </NavProgressContext.Provider>
  );
}
