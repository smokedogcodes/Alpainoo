"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FieldLabel } from "@/components/admin/field-label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { compressImageForUpload } from "@/lib/images/compress-client";

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
  urlLabel?: string;
  urlPlaceholder?: string;
  onUploadingChange?: (uploading: boolean) => void;
};

/**
 * Same upload UX as the Products admin form: compress → POST /api/upload →
 * fill the URL field(s). Keeps a visible URL input so existing paths remain editable.
 */
export function ImageUploadField({
  name,
  id,
  defaultValue = "",
  value,
  onChange,
  multiple = false,
  uploadLabel,
  urlLabel,
  urlPlaceholder,
  onUploadingChange,
}: Props) {
  const fieldId = id || name;
  const fileId = `${fieldId}-file`;
  const controlled = value !== undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);

  function readUrls() {
    if (controlled) return value;
    if (multiple) return textareaRef.current?.value ?? defaultValue;
    return inputRef.current?.value ?? defaultValue;
  }

  function writeUrls(next: string) {
    if (controlled) {
      onChange?.(next);
      return;
    }
    if (multiple && textareaRef.current) {
      textareaRef.current.value = next;
    } else if (inputRef.current) {
      inputRef.current.value = next;
    }
    onChange?.(next);
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const body = new FormData();
      const list = multiple ? Array.from(files) : [files[0]];
      for (const raw of list) {
        const compressed = await compressImageForUpload(raw);
        body.append("files", compressed);
      }
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const uploaded = data.urls as string[];
      if (multiple) {
        const existing = readUrls()
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        writeUrls([...existing, ...uploaded].join("\n"));
      } else {
        writeUrls(uploaded[0] || "");
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
    <>
      <div>
        <FieldLabel htmlFor={fileId}>
          {uploadLabel || (multiple ? "Upload product images" : "Upload cover image")}
        </FieldLabel>
        <Input
          id={fileId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple={multiple}
          className="mt-1.5"
          disabled={uploading}
          onChange={(e) => {
            void onUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-1 text-xs text-muted">
          Optional. Images are resized to WebP (~500 KB) and stored in D1.
          {uploading ? " — compressing & uploading…" : ""}
        </p>
      </div>

      <div>
        <FieldLabel htmlFor={fieldId}>
          {urlLabel || (multiple ? "Image URLs (one per line)" : "Cover image URL")}
        </FieldLabel>
        {multiple ? (
          <Textarea
            ref={textareaRef}
            id={fieldId}
            name={name}
            {...(controlled
              ? { value, onChange: (e) => onChange?.(e.target.value) }
              : { defaultValue })}
            placeholder={urlPlaceholder || "/api/media/… or /products/….jpg"}
            className="mt-1.5"
          />
        ) : (
          <Input
            ref={inputRef}
            id={fieldId}
            name={name}
            {...(controlled
              ? { value, onChange: (e) => onChange?.(e.target.value) }
              : { defaultValue })}
            placeholder={urlPlaceholder || "/api/media/…"}
            className="mt-1.5"
          />
        )}
      </div>
    </>
  );
}
