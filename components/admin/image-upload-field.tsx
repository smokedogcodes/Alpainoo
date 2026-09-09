"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { FieldLabel } from "@/components/admin/field-label";
import { Button } from "@/components/ui/button";
import { compressImageForUpload } from "@/lib/images/compress-client";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  id?: string;
  /** Uncontrolled initial URL(s). Ignored when `value` is set. */
  defaultValue?: string;
  /** Controlled URL value (single URL, or one-per-line when `multiple`). */
  value?: string;
  onChange?: (value: string) => void;
  /** Product-style multi-image list vs single cover/hero URL. */
  multiple?: boolean;
  uploadLabel?: string;
  onUploadingChange?: (uploading: boolean) => void;
};

function parseUrls(raw: string) {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Image upload with thumbnail previews, add more, and delete.
 * Compresses → POST /api/upload → stores returned paths (hidden for form submit).
 */
export function ImageUploadField({
  name,
  id,
  defaultValue = "",
  value,
  onChange,
  multiple = false,
  uploadLabel,
  onUploadingChange,
}: Props) {
  const fieldId = id || name;
  const fileId = `${fieldId}-file`;
  const controlled = value !== undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);

  const raw = controlled ? value : uncontrolled;
  const urls = multiple ? parseUrls(raw) : raw.trim() ? [raw.trim()] : [];

  function commit(nextList: string[]) {
    const next = multiple ? nextList.join("\n") : nextList[0] || "";
    if (!controlled) setUncontrolled(next);
    onChange?.(next);
  }

  function removeAt(index: number) {
    commit(urls.filter((_, i) => i !== index));
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const body = new FormData();
      const list = multiple ? Array.from(files) : [files[0]];
      for (const rawFile of list) {
        const compressed = await compressImageForUpload(rawFile);
        body.append("files", compressed);
      }
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const uploaded = (data.urls as string[]).filter(Boolean);
      if (!uploaded.length) throw new Error("Upload returned no images");
      if (multiple) {
        commit([...urls, ...uploaded]);
      } else {
        commit([uploaded[0]]);
      }
      toast.success(`Uploaded ${uploaded.length} image(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel htmlFor={fileId}>
          {uploadLabel || (multiple ? "Product images" : "Cover image")}
        </FieldLabel>
        <p className="mt-0.5 text-xs text-muted">
          Optional. Images are resized to WebP (~500 KB) and stored in D1.
          {uploading ? " — compressing & uploading…" : ""}
        </p>
      </div>

      {/* Persist URLs for native form posts (collections, blog, etc.) */}
      <input type="hidden" name={name} id={fieldId} value={raw} readOnly />

      {urls.length > 0 ? (
        <ul
          className={cn(
            "grid gap-3",
            multiple ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" : "max-w-[11rem] grid-cols-1"
          )}
        >
          {urls.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-off-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of /api/media and static paths */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {index === 0 && multiple ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                  Cover
                </span>
              ) : null}
              <button
                type="button"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-white text-foreground shadow-md transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage disabled:opacity-50"
                aria-label={multiple ? `Remove image ${index + 1}` : "Remove image"}
                disabled={uploading}
                onClick={() => removeAt(index)}
              >
                <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              </button>
            </li>
          ))}

          {multiple ? (
            <li>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-white text-sm text-muted transition-colors hover:border-sage hover:bg-off-white hover:text-foreground disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
                <span>Add more</span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          id={fileId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple={multiple}
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            void onUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {uploading
            ? "Uploading…"
            : urls.length === 0
              ? multiple
                ? "Add images"
                : "Add image"
              : multiple
                ? "Add more"
                : "Replace image"}
        </Button>
        {urls.length > 0 && !multiple ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => commit([])}
          >
            <X className="mr-1.5 h-4 w-4" strokeWidth={2.5} />
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
