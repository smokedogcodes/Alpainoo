import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "sale" | "outline" | "muted";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold",
        variant === "default" && "bg-sage text-white",
        variant === "sale" && "bg-sale text-white",
        variant === "outline" && "border border-border text-foreground",
        variant === "muted" && "bg-off-white text-muted",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
