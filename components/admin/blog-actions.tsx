"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteBlog } from "@/lib/actions/admin";

export function BlogAdminActions({ id }: { id: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/blog/${id}`}>Edit</Link>
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={async () => {
          if (!confirm("Delete this post?")) return;
          await deleteBlog(id);
          toast.success("Post deleted");
          router.refresh();
        }}
      >
        Delete
      </Button>
    </div>
  );
}
