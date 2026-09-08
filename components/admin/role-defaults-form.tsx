"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PermissionMatrixEditor } from "@/components/admin/permission-matrix-editor";
import {
  resetRoleTemplatesAction,
  saveRoleTemplatesAction,
} from "@/lib/actions/roles";
import type { PermissionMatrix, RoleTemplates } from "@/lib/auth/permissions";

export function RoleDefaultsForm({ initial }: { initial: RoleTemplates }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [staff, setStaff] = useState<PermissionMatrix>(() =>
    structuredClone(initial.STAFF)
  );
  const [temp, setTemp] = useState<PermissionMatrix>(() =>
    structuredClone(initial.TEMP)
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-xl">Staff defaults</h2>
        <p className="text-sm text-muted">
          Applied when a Staff user has “Use role defaults” enabled.
        </p>
        <PermissionMatrixEditor
          value={staff}
          onChange={setStaff}
          hideAdminOnlyScreens
          disabled={pending}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Temp defaults</h2>
        <p className="text-sm text-muted">
          Applied when a Temp user has “Use role defaults” enabled. Temp accounts also need an
          expiry date.
        </p>
        <PermissionMatrixEditor
          value={temp}
          onChange={setTemp}
          hideAdminOnlyScreens
          disabled={pending}
        />
      </section>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setOk(false);
            startTransition(async () => {
              try {
                await saveRoleTemplatesAction({ STAFF: staff, TEMP: temp });
                setOk(true);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            });
          }}
        >
          {pending ? "Saving…" : "Save templates"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setError(null);
            setOk(false);
            startTransition(async () => {
              try {
                await resetRoleTemplatesAction();
                setOk(true);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            });
          }}
        >
          Reset to built-in defaults
        </Button>
        {error && <p className="w-full text-sm text-red-700">{error}</p>}
        {ok && !error && <p className="w-full text-sm text-sage">Saved</p>}
      </div>
    </div>
  );
}
