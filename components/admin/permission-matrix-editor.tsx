"use client";

import {
  ADMIN_SCREENS,
  SCREEN_LABELS,
  type AdminScreen,
  type PermissionMatrix,
  type ScreenPermission,
} from "@/lib/auth/permissions";

const HIDDEN_FOR_TEMPLATES: AdminScreen[] = ["users", "roles"];

export function PermissionMatrixEditor({
  value,
  onChange,
  hideAdminOnlyScreens = false,
  disabled = false,
}: {
  value: PermissionMatrix;
  onChange: (next: PermissionMatrix) => void;
  hideAdminOnlyScreens?: boolean;
  disabled?: boolean;
}) {
  const screens = ADMIN_SCREENS.filter(
    (s) => !hideAdminOnlyScreens || !HIDDEN_FOR_TEMPLATES.includes(s)
  );

  function setFlag(screen: AdminScreen, key: keyof ScreenPermission, checked: boolean) {
    const next = structuredClone(value);
    const row = { ...next[screen] };
    row[key] = checked;
    if (key === "view" && !checked) {
      row.edit = false;
      row.delete = false;
    }
    if ((key === "edit" || key === "delete") && checked) {
      row.view = true;
    }
    next[screen] = row;
    onChange(next);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-border bg-off-white text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Screen</th>
            <th className="px-3 py-2 font-medium">View</th>
            <th className="px-3 py-2 font-medium">Edit</th>
            <th className="px-3 py-2 font-medium">Delete</th>
          </tr>
        </thead>
        <tbody>
          {screens.map((screen) => (
            <tr key={screen} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{SCREEN_LABELS[screen]}</td>
              {(["view", "edit", "delete"] as const).map((key) => (
                <td key={key} className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sage"
                    checked={Boolean(value[screen]?.[key])}
                    disabled={disabled}
                    onChange={(e) => setFlag(screen, key, e.target.checked)}
                    aria-label={`${SCREEN_LABELS[screen]} ${key}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
