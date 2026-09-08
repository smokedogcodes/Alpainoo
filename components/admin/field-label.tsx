import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Admin form label with optional required asterisk. */
export function FieldLabel({
  htmlFor,
  children,
  required,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <Label htmlFor={htmlFor} className={cn(className)}>
      {children}
      {required ? <span className="text-price-sale"> *</span> : null}
    </Label>
  );
}

export function RequiredHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted", className)}>
      Fields marked <span className="text-price-sale">*</span> are required.
    </p>
  );
}
