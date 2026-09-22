"use client";

import { motion, useTransform } from "framer-motion";
import { useSceneProgress } from "@/components/motion/scroll-scene";

export function HeroOrb({ children }: { children: React.ReactNode }) {
  const { progress, enabled } = useSceneProgress();
  const rotateX = useTransform(progress, [0, 1], [0, 9]);
  const scale = useTransform(progress, [0, 1], [1, 0.94]);
  const z = useTransform(progress, [0, 1], [0, -80]);
  const y = useTransform(progress, [0, 1], [0, 50]);

  return (
    <motion.div
      className="hero-depth-orb"
      style={enabled ? { rotateX, scale, z, y, transformPerspective: 1200, transformStyle: "preserve-3d" } : undefined}
    >
      {children}
    </motion.div>
  );
}
