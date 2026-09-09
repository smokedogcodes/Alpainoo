"use client";

import { useState } from "react";
import { createCoupon } from "@/lib/actions/admin-marketing";
import { AdminForm, AdminFormActions } from "@/components/admin/admin-form";
import { FieldLabel, RequiredHint } from "@/components/admin/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KINDS = [
  {
    value: "PERCENT",
    label: "Percentage off",
    help: "e.g. 10% off the merchandise total",
  },
  {
    value: "FIXED",
    label: "Fixed amount off",
    help: "e.g. ₹100 off the merchandise total",
  },
  {
    value: "PERCENT_CAPPED",
    label: "Percentage with max (upto)",
    help: "e.g. 5% off up to ₹100 — the cap is never exceeded",
  },
  {
    value: "FREE_SHIPPING",
    label: "Free shipping",
    help: "Waives shipping fee; merchandise total is unchanged",
  },
] as const;

type Kind = (typeof KINDS)[number]["value"];

export function CouponCreateForm() {
  const [kind, setKind] = useState<Kind>("PERCENT_CAPPED");

  return (
    <AdminForm
      action={createCoupon}
      successMessage="Coupon created successfully"
      errorMessage="Could not create coupon"
      resetOnSuccess
      className="max-w-xl space-y-3 rounded-lg border border-border bg-white p-4"
    >
      <h2 className="font-display text-xl">Create coupon</h2>
      <RequiredHint />

      <div>
        <FieldLabel htmlFor="kind" required>
          Coupon type
        </FieldLabel>
        <select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="mt-1.5 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">{KINDS.find((k) => k.value === kind)?.help}</p>
      </div>

      <div>
        <FieldLabel htmlFor="code" required>
          Code
        </FieldLabel>
        <Input id="code" name="code" required placeholder="SAVE10" className="mt-1.5" />
      </div>
      <div>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Input id="description" name="description" placeholder="Optional note" className="mt-1.5" />
      </div>

      {(kind === "PERCENT" || kind === "PERCENT_CAPPED") && (
        <div>
          <FieldLabel htmlFor="percentOff" required>
            Percent off
          </FieldLabel>
          <Input
            id="percentOff"
            name="percentOff"
            type="number"
            step="0.1"
            min="0.1"
            max="100"
            required
            placeholder="5"
            className="mt-1.5"
          />
        </div>
      )}

      {kind === "FIXED" && (
        <div>
          <FieldLabel htmlFor="amountOff" required>
            Amount off (₹)
          </FieldLabel>
          <Input
            id="amountOff"
            name="amountOff"
            type="number"
            step="1"
            min="1"
            required
            placeholder="100"
            className="mt-1.5"
          />
        </div>
      )}

      {kind === "PERCENT_CAPPED" && (
        <div>
          <FieldLabel htmlFor="amountOff" required>
            Max discount / upto (₹)
          </FieldLabel>
          <Input
            id="amountOff"
            name="amountOff"
            type="number"
            step="1"
            min="1"
            required
            placeholder="100"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted">
            Percent discount will not exceed this amount.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="minOrder">Min order (₹)</FieldLabel>
          <Input
            id="minOrder"
            name="minOrder"
            type="number"
            min="0"
            defaultValue={0}
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel htmlFor="maxUses">Max uses</FieldLabel>
          <Input id="maxUses" name="maxUses" type="number" min="1" className="mt-1.5" />
        </div>
      </div>

      <AdminFormActions>
        <Button type="submit">Create</Button>
      </AdminFormActions>
    </AdminForm>
  );
}
