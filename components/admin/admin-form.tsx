"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  action: (formData: FormData) => Promise<unknown>;
  successMessage: string;
  errorMessage?: string;
  className?: string;
  children: ReactNode;
  /** When set, navigate here after success */
  redirectTo?: string;
  resetOnSuccess?: boolean;
};

/**
 * Wraps a server action form with success/error toasts and refresh.
 */
export function AdminForm({
  action,
  successMessage,
  errorMessage = "Something went wrong. Please try again.",
  className,
  children,
  redirectTo,
  resetOnSuccess,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setPending(true);
        try {
          await action(fd);
          toast.success(successMessage);
          if (resetOnSuccess) form.reset();
          if (redirectTo) {
            router.push(redirectTo);
          }
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : errorMessage);
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending ? (
        <p className="mt-2 text-xs text-muted" aria-live="polite">
          Saving…
        </p>
      ) : null}
    </form>
  );
}

/**
 * Extra vertical gap before Create / Save / Submit controls so the primary
 * action does not hug the last field. Use on all admin create/edit forms.
 */
export function AdminFormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("pt-3", className)}>{children}</div>;
}
