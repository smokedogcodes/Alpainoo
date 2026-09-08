"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AdminFormActions } from "@/components/admin/admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel, RequiredHint } from "@/components/admin/field-label";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { upsertBlog } from "@/lib/actions/admin";
import { parseJsonArray } from "@/lib/utils";

function toDatetimeLocal(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BlogForm({
  post,
}: {
  post?: {
    id: string;
    title: string;
    excerpt: string;
    content: string;
    coverImage: string | null;
    tags: string;
    published: boolean;
    scheduledAt?: Date | string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const fd = new FormData(e.currentTarget);
          await upsertBlog(fd);
          toast.success(post?.id ? "Post updated successfully" : "Post created successfully");
          router.push("/admin/blog");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save post");
        }
      }}
    >
      {post?.id && <input type="hidden" name="id" value={post.id} />}
      <RequiredHint />
      <div>
        <FieldLabel htmlFor="title" required>
          Title
        </FieldLabel>
        <Input id="title" name="title" required defaultValue={post?.title} className="mt-1.5" />
      </div>
      <div>
        <FieldLabel htmlFor="excerpt" required>
          Excerpt
        </FieldLabel>
        <Textarea id="excerpt" name="excerpt" required defaultValue={post?.excerpt} className="mt-1.5" />
      </div>
      <div>
        <FieldLabel htmlFor="content" required>
          Content
        </FieldLabel>
        <Textarea
          id="content"
          name="content"
          required
          defaultValue={post?.content}
          className="mt-1.5 min-h-[240px]"
        />
      </div>
      <div>
        <FieldLabel htmlFor="tags">Tags (comma separated)</FieldLabel>
        <Input
          id="tags"
          name="tags"
          defaultValue={parseJsonArray(post?.tags).join(", ")}
          className="mt-1.5"
        />
      </div>
      <ImageUploadField
        name="coverImage"
        id="coverImage"
        defaultValue={post?.coverImage || ""}
        onUploadingChange={setUploading}
      />
      <div>
        <FieldLabel htmlFor="scheduledAt">Schedule publish</FieldLabel>
        <Input
          id="scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          defaultValue={toDatetimeLocal(post?.scheduledAt)}
          className="mt-1.5"
        />
      </div>
      <div>
        <FieldLabel htmlFor="metaTitle">SEO title</FieldLabel>
        <Input
          id="metaTitle"
          name="metaTitle"
          maxLength={120}
          defaultValue={post?.metaTitle || ""}
          className="mt-1.5"
        />
      </div>
      <div>
        <FieldLabel htmlFor="metaDescription">SEO description</FieldLabel>
        <Textarea
          id="metaDescription"
          name="metaDescription"
          maxLength={320}
          defaultValue={post?.metaDescription || ""}
          className="mt-1.5"
        />
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={post?.published ?? true} />
        Published
      </label>
      <AdminFormActions>
        <Button type="submit" disabled={uploading}>
          Save post
        </Button>
      </AdminFormActions>
    </form>
  );
}
