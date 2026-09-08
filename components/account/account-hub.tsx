"use client";

import { AdminForm } from "@/components/admin/admin-form";
import { FieldLabel, RequiredHint } from "@/components/admin/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  makeDefaultAddress,
  removeAddress,
  saveAddress,
  saveProfile,
} from "@/lib/actions/account";
import type { SavedAddressRow } from "@/lib/db/addresses";

type Profile = {
  id: string;
  email: string;
  name: string;
  phone: string;
};

export function AccountHub({
  profile,
  addresses,
}: {
  profile: Profile;
  addresses: SavedAddressRow[];
  userId: string;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section className="space-y-4">
        <h2 className="font-display text-2xl">Profile</h2>
        <AdminForm
          action={saveProfile}
          successMessage="Profile saved"
          errorMessage="Could not save profile"
          className="space-y-3 rounded-lg border border-border bg-cream p-4"
        >
          <RequiredHint />
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              className="mt-1.5"
              value={profile.email}
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-muted">Email comes from your Google sign-in.</p>
          </div>
          <div>
            <FieldLabel htmlFor="name" required>
              Name
            </FieldLabel>
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              className="mt-1.5"
              defaultValue={profile.name}
            />
          </div>
          <div>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              maxLength={13}
              placeholder="10-digit mobile"
              className="mt-1.5"
              defaultValue={profile.phone}
            />
          </div>
          <Button type="submit">Save profile</Button>
        </AdminForm>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Saved addresses</h2>

        <AdminForm
          action={saveAddress}
          successMessage="Address saved"
          errorMessage="Could not save address"
          resetOnSuccess
          className="space-y-3 rounded-lg border border-border bg-cream p-4"
        >
          <h3 className="text-sm font-medium">Add address</h3>
          <RequiredHint />
          <div>
            <FieldLabel htmlFor="label">Label</FieldLabel>
            <Input id="label" name="label" placeholder="Home / Work" className="mt-1.5" />
          </div>
          <div>
            <FieldLabel htmlFor="addr-name" required>
              Full name
            </FieldLabel>
            <Input id="addr-name" name="name" required minLength={2} className="mt-1.5" />
          </div>
          <div>
            <FieldLabel htmlFor="addr-phone" required>
              Phone
            </FieldLabel>
            <Input
              id="addr-phone"
              name="phone"
              type="tel"
              required
              inputMode="numeric"
              maxLength={13}
              className="mt-1.5"
            />
          </div>
          <div>
            <FieldLabel htmlFor="addr-line" required>
              Address
            </FieldLabel>
            <Input id="addr-line" name="address" required minLength={5} className="mt-1.5" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="city" required>
                City
              </FieldLabel>
              <Input id="city" name="city" required className="mt-1.5" />
            </div>
            <div>
              <FieldLabel htmlFor="state" required>
                State
              </FieldLabel>
              <Input id="state" name="state" required className="mt-1.5" />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="pincode" required>
              Pin code
            </FieldLabel>
            <Input
              id="pincode"
              name="pincode"
              required
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              className="mt-1.5"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDefault" className="h-4 w-4 accent-[var(--sage)]" />
            Set as default for checkout
          </label>
          <Button type="submit">Add address</Button>
        </AdminForm>

        <ul className="space-y-3">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-border bg-cream p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {a.label || "Address"}
                    {a.isDefault ? (
                      <span className="ml-2 text-xs font-normal text-sage">Default</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-muted">
                    {a.name} · {a.phone}
                  </p>
                  <p className="mt-1">
                    {a.address}, {a.city}, {a.state} — {a.pincode}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!a.isDefault ? (
                    <AdminForm
                      action={makeDefaultAddress}
                      successMessage="Default address updated"
                      errorMessage="Could not update default"
                      className="inline"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Make default
                      </Button>
                    </AdminForm>
                  ) : null}
                  <AdminForm
                    action={removeAddress}
                    successMessage="Address removed"
                    errorMessage="Could not remove address"
                    className="inline"
                  >
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Delete
                    </Button>
                  </AdminForm>
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-sage">Edit</summary>
                <AdminForm
                  action={saveAddress}
                  successMessage="Address updated"
                  errorMessage="Could not update address"
                  className="mt-3 space-y-2"
                >
                  <input type="hidden" name="id" value={a.id} />
                  <Input name="label" defaultValue={a.label || ""} placeholder="Label" />
                  <Input name="name" defaultValue={a.name} required />
                  <Input name="phone" defaultValue={a.phone} required />
                  <Input name="address" defaultValue={a.address} required />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input name="city" defaultValue={a.city} required />
                    <Input name="state" defaultValue={a.state} required />
                  </div>
                  <Input name="pincode" defaultValue={a.pincode} required maxLength={6} />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="isDefault"
                      defaultChecked={a.isDefault}
                      className="h-4 w-4 accent-[var(--sage)]"
                    />
                    Default for checkout
                  </label>
                  <Button type="submit" size="sm">
                    Update
                  </Button>
                </AdminForm>
              </details>
            </li>
          ))}
          {addresses.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border p-6 text-center text-muted">
              No saved addresses yet.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
