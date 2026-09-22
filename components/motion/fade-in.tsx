"use client";

import { motion } from "framer-motion";
import { useDesktopMotion, useStorefrontReducedMotion } from "@/hooks/use-storefront-motion";

export function FadeIn({
  children,
  className,
  delay = 0,
  y = 20,
  depth = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  depth?: boolean;
}) {
  const reduce = useStorefrontReducedMotion();
  const desktop = useDesktopMotion();
  const useDepth = depth && desktop;

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={useDepth ? { transformPerspective: 1200 } : undefined}
      initial={{ opacity: 0, y: depth && !desktop ? 0 : y, rotateX: useDepth ? 8 : 0, scale: useDepth ? 0.96 : 1, z: useDepth ? -35 : 0 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1, z: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: useDepth ? 0.5 : 0.28, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useStorefrontReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.08, delayChildren: delay },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  depth = false,
}: {
  children: React.ReactNode;
  className?: string;
  depth?: boolean;
}) {
  const desktop = useDesktopMotion();
  const reduce = useStorefrontReducedMotion();
  const useDepth = depth && desktop;

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      style={useDepth ? { transformPerspective: 1200 } : undefined}
      variants={{
        hidden: { opacity: 0, y: desktop ? 16 : 0, rotateX: useDepth ? 8 : 0, scale: useDepth ? 0.96 : 1, z: useDepth ? -35 : 0 },
        show: { opacity: 1, y: 0, rotateX: 0, scale: 1, z: 0, transition: { duration: useDepth ? 0.5 : 0.25, ease: "easeOut" } },
      }}
    >
      {children}
    </motion.div>
  );
}
