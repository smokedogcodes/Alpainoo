"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Closes overlays when the pathname changes (client navigation). */
export function useDismissOnRouteChange(onDismiss: () => void) {
  const pathname = usePathname();

  useEffect(() => {
    onDismiss();
    // Only re-run on pathname changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
