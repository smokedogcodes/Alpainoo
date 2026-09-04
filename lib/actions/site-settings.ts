"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { saveSiteSettings } from "@/lib/gst/invoice";

const Schema = z.object({
  gstin: z.string().trim().max(20).optional(),
  businessName: z.string().trim().max(200).optional(),
  businessAddress: z.string().trim().max(500).optional(),
  gaMeasurementId: z.string().trim().max(40).optional(),
  metaPixelId: z.string().trim().max(40).optional(),
  lowStockDefault: z.number().int().min(0).max(10_000).optional(),
});

export async function saveSiteSettingsAction(formData: FormData) {
  await requireAdmin();
  const raw = {
    gstin: String(formData.get("gstin") || "").trim() || null,
    businessName: String(formData.get("businessName") || "").trim() || null,
    businessAddress: String(formData.get("businessAddress") || "").trim() || null,
    gaMeasurementId: String(formData.get("gaMeasurementId") || "").trim() || null,
    metaPixelId: String(formData.get("metaPixelId") || "").trim() || null,
    lowStockDefault: Number(formData.get("lowStockDefault") || 5),
  };

  const parsed = Schema.safeParse({
    gstin: raw.gstin || undefined,
    businessName: raw.businessName || undefined,
    businessAddress: raw.businessAddress || undefined,
    gaMeasurementId: raw.gaMeasurementId || undefined,
    metaPixelId: raw.metaPixelId || undefined,
    lowStockDefault: raw.lowStockDefault,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid settings");

  await saveSiteSettings({
    gstin: raw.gstin,
    businessName: raw.businessName,
    businessAddress: raw.businessAddress,
    gaMeasurementId: raw.gaMeasurementId,
    metaPixelId: raw.metaPixelId,
    lowStockDefault: raw.lowStockDefault,
  });
  revalidatePath("/admin/seo");
}
