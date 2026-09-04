"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      action={async (fd) => {
        await upsertBlog(fd);
        toast.success("Post saved");
        router.push("/admin/blog");
        router.refresh();
      }}
    >
      {post?.id && <input type="hidden" name="id" value={post.id} />}
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={post?.title} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea id="excerpt" name="excerpt" required defaultValue={post?.excerpt} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="content">Content (Markdown supported as plain text)</Label>
        <Textarea id="content" name="content" required defaultValue={post?.content} className="mt-1.5 min-h-[240px]" />
      </div>
      <div>
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          name="tags"
          defaultValue={parseJsonArray(post?.tags).join(", ")}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="coverImage">Cover image URL</Label>
        <Input id="coverImage" name="coverImage" defaultValue={post?.coverImage || ""} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="scheduledAt">Schedule publish (optional)</Label>
        <Input
          id="scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          defaultValue={toDatetimeLocal(post?.scheduledAt)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="metaTitle">SEO title</Label>
        <Input
          id="metaTitle"
          name="metaTitle"
          maxLength={120}
          defaultValue={post?.metaTitle || ""}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="metaDescription">SEO description</Label>
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
      <Button type="submit">Save post</Button>
    </form>
  );
}
