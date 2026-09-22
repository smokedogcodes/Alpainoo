"use client";

import { motion } from "framer-motion";
import { useCardTilt } from "@/hooks/use-storefront-motion";
import { cn } from "@/lib/utils";

export function TiltRow({ children, className }: { children: React.ReactNode; className?: string }) {
  const tilt = useCardTilt();
  return <motion.li {...tilt} className={cn("storefront-tilt", className)}>{children}</motion.li>;
}
