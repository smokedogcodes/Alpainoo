"use client";

import Image from "next/image";
import { createContext, useContext, useRef, type ComponentProps, type ReactNode } from "react";
import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useDesktopMotion } from "@/hooks/use-storefront-motion";

const ScrollProgress = createContext<MotionValue<number> | null>(null);
const MotionImage = motion.create(Image);
type ImageProps = ComponentProps<typeof MotionImage>;

type SceneProps = {
  children: ReactNode;
  className?: string;
  kind: "hero" | "collections";
};

export function ScrollScene(props: SceneProps) {
  const enabled = useDesktopMotion();
  if (!enabled) return <section className={props.className}>{props.children}</section>;
  return <AnimatedScene {...props} />;
}

function AnimatedScene({ children, className, kind }: SceneProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: kind === "hero" ? ["start start", "end start"] : ["start end", "end start"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 28, restDelta: 0.001 });

  return (
    <ScrollProgress.Provider value={progress}>
      <section ref={ref} className={className} style={{ perspective: 1200 }}>
        {children}
      </section>
    </ScrollProgress.Provider>
  );
}

export function useSceneProgress() {
  const progress = useContext(ScrollProgress);
  const fallback = useMotionValue(0);
  return { progress: progress ?? fallback, enabled: progress !== null };
}

export function HeroFoliage(props: ImageProps) {
  const { progress, enabled } = useSceneProgress();
  const y = useTransform(progress, [0, 1], [0, 90]);
  const scale = useTransform(progress, [0, 1], [1, 1.12]);
  const z = useTransform(progress, [0, 1], [0, -35]);
  const rotateX = useTransform(progress, [0, 1], [0, 3]);
  return <MotionImage {...props} style={enabled ? { y, scale, z, rotateX } : undefined} />;
}

export function CollectionLayer({ children, index }: { children: ReactNode; index: number }) {
  const { progress, enabled } = useSceneProgress();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "80px" });
  const speed = [22, -30, 36][index % 3];
  const depth = [-22, 18, -10][index % 3];
  const y = useTransform(progress, [0, 0.5, 1], [speed, 0, -speed]);
  const z = useTransform(progress, [0, 0.5, 1], [depth - 12, depth, depth - 12]);
  const rotateX = useTransform(progress, [0, 0.5, 1], [3, 0, -3]);

  return (
    <motion.div
      ref={ref}
      className="collection-depth-layer"
      style={enabled ? { y, z, rotateX, transformPerspective: 1200, transformStyle: "preserve-3d", willChange: visible ? "transform" : "auto" } : undefined}
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.45, ease: "easeOut" } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function CollectionMedallion({ children, className, index }: { children: ReactNode; className?: string; index: number }) {
  const { progress, enabled } = useSceneProgress();
  const offset = 8 + (index % 3) * 3;
  const boxShadow = useTransform(progress, [0, 0.5, 1], [
    `var(--tw-ring-offset-shadow), var(--tw-ring-shadow), 0 ${offset}px 20px -2px rgba(26, 64, 115, 0.08)`,
    `var(--tw-ring-offset-shadow), var(--tw-ring-shadow), 0 ${offset + 8}px 32px -2px rgba(26, 64, 115, 0.08)`,
    `var(--tw-ring-offset-shadow), var(--tw-ring-shadow), 0 ${offset}px 20px -2px rgba(26, 64, 115, 0.08)`,
  ]);
  return <motion.div className={className} style={enabled ? { boxShadow } : undefined}>{children}</motion.div>;
}

export function CollectionImage({ index, ...props }: ImageProps & { index: number }) {
  const { progress, enabled } = useSceneProgress();
  const speed = [9, -12, 15][index % 3];
  const y = useTransform(progress, [0, 0.5, 1], [speed, 0, -speed]);
  const scale = useTransform(progress, [0, 0.5, 1], [1.16, 1.1, 1.16]);
  const filter = useTransform(progress, [0, 0.5, 1], ["blur(0.35px)", "blur(0px)", "blur(0.35px)"]);
  return <MotionImage {...props} style={enabled ? { y, scale, filter } : undefined} />;
}
