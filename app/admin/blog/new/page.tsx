import { BlogForm } from "@/components/admin/blog-form";

export default function NewBlogPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">New blog post</h1>
      <BlogForm />
    </div>
  );
}
