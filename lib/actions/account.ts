"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import {
  createSavedAddress,
  deleteSavedAddress,
  getDefaultSavedAddress,
  listSavedAddresses,
  setDefaultSavedAddress,
  updateSavedAddress,
  type SavedAddressRow,
} from "@/lib/db/addresses";
import { findUserById, updateUserProfile } from "@/lib/db/users";
import { sanitizePlainText } from "@/lib/security/sanitize-text";

const ProfileSchema = z.object({
  name: z
    .string()
    .transform((v) => sanitizePlainText(v, 120))
    .pipe(z.string().min(2).max(120)),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .transform((v) => (v.length > 10 && v.startsWith("91") ? v.slice(-10) : v))
    .pipe(
      z.union([
        z.literal(""),
        z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
      ])
    ),
});

const AddressSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  label: z
    .string()
    .transform((v) => sanitizePlainText(v, 40))
    .pipe(z.string().max(40))
    .optional(),
  name: z
    .string()
    .transform((v) => sanitizePlainText(v, 120))
    .pipe(z.string().min(2).max(120)),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .transform((v) => (v.length > 10 && v.startsWith("91") ? v.slice(-10) : v))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")),
  address: z
    .string()
    .transform((v) => sanitizePlainText(v, 500))
    .pipe(z.string().min(5).max(500)),
  city: z
    .string()
    .transform((v) => sanitizePlainText(v, 100))
    .pipe(z.string().min(2).max(100)),
  state: z
    .string()
    .transform((v) => sanitizePlainText(v, 100))
    .pipe(z.string().min(2).max(100)),
  pincode: z.string().regex(/^\d{6}$/, "Pin code must be 6 digits"),
  isDefault: z.boolean().optional(),
});

function formBool(fd: FormData, key: string) {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export async function getAccountProfile() {
  const user = await requireUser({ callbackPath: "/account" });
  const full = await findUserById(user.id);
  return {
    id: user.id,
    email: full?.email || user.email || "",
    name: full?.name || user.name || "",
    phone: full?.phone || "",
  };
}

export async function getAccountAddresses(): Promise<SavedAddressRow[]> {
  const user = await requireUser({ callbackPath: "/account" });
  return listSavedAddresses(user.id);
}

/** Checkout autofill — null when signed out or no saved address. */
export async function getCheckoutAddressPrefill(): Promise<{
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
} | null> {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return null;

  const full = await findUserById(session.user.id);
  const saved = await getDefaultSavedAddress(session.user.id);
  return {
    email: full?.email || session.user.email || "",
    name: saved?.name || full?.name || session.user.name || "",
    phone: saved?.phone || full?.phone || "",
    address: saved?.address || "",
    city: saved?.city || "",
    state: saved?.state || "",
    pincode: saved?.pincode || "",
  };
}

export async function saveProfile(formData: FormData) {
  const user = await requireUser({ callbackPath: "/account" });
  const parsed = ProfileSchema.safeParse({
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid profile");
  }

  await updateUserProfile(user.id, {
    name: parsed.data.name,
    phone: parsed.data.phone || null,
  });
  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true as const };
}

export async function saveAddress(formData: FormData) {
  const user = await requireUser({ callbackPath: "/account" });
  const idRaw = String(formData.get("id") || "").trim();
  const parsed = AddressSchema.safeParse({
    id: idRaw || undefined,
    label: String(formData.get("label") || ""),
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    address: String(formData.get("address") || ""),
    city: String(formData.get("city") || ""),
    state: String(formData.get("state") || ""),
    pincode: String(formData.get("pincode") || "").trim(),
    isDefault: formBool(formData, "isDefault"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid address");
  }

  const data = parsed.data;
  if (data.id) {
    await updateSavedAddress({
      id: data.id,
      userId: user.id,
      label: data.label || null,
      name: data.name,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      isDefault: data.isDefault,
    });
  } else {
    await createSavedAddress({
      userId: user.id,
      label: data.label || null,
      name: data.name,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      isDefault: data.isDefault,
    });
  }

  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true as const };
}

export async function removeAddress(formData: FormData) {
  const user = await requireUser({ callbackPath: "/account" });
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Invalid address");
  await deleteSavedAddress(id, user.id);
  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true as const };
}

export async function makeDefaultAddress(formData: FormData) {
  const user = await requireUser({ callbackPath: "/account" });
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Invalid address");
  await setDefaultSavedAddress(id, user.id);
  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true as const };
}
