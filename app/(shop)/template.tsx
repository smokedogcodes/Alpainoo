"use client";

import { Suspense } from "react";
import { PageTransition } from "@/components/motion/page-transition";
import { NavigationProgress } from "@/components/motion/navigation-progress";

export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <PageTransition>{children}</PageTransition>
    </>
  );
}
