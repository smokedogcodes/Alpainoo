import { notFound } from "next/navigation";
import { getPostById } from "@/lib/db/blog";
import { BlogForm } from "@/components/admin/blog-form";
import { requireScreenView } from "@/lib/auth/require-screen";

export default async function EditBlogPage({ params }: { params: { id: string } }) {
  await requireScreenView("blog");
  const post = await getPostById(params.id);
  if (!post) notFound();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Edit post</h1>
      <BlogForm post={post} />
    </div>
  );
}
