import { requireScreenView } from "@/lib/auth/require-screen";
import Link from "next/link";
import { listAdminPosts } from "@/lib/db/blog";
import { Button } from "@/components/ui/button";
import { BlogAdminActions } from "@/components/admin/blog-actions";

export default async function AdminBlogPage() {
  await requireScreenView("blog");
  const posts = await listAdminPosts();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl">Blog</h1>
        <Button asChild>
          <Link href="/admin/blog/new">New post</Link>
        </Button>
      </div>
      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-muted line-clamp-2">{p.excerpt}</p>
                <p className="mt-1 text-xs text-muted">{p.published ? "Published" : "Draft"}</p>
              </div>
              <BlogAdminActions id={p.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
