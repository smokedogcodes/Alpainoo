import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Blog",
  description: "Skincare routines, serum guides, and haircare tips from Elorakart.",
};

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <h1 className="font-display text-4xl">Journal</h1>
      <p className="mt-2 text-muted">Routines and guides for botanical beauty.</p>
      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`} className="group block">
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-blush-soft">
              <Image
                src={post.coverImage || "/blog/am-routine.jpg"}
                alt={post.title}
                fill
                sizes="(max-width:768px) 100vw, 33vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            </div>
            <h2 className="mt-3 font-display text-2xl group-hover:underline">{post.title}</h2>
            <p className="mt-1 text-sm text-muted line-clamp-2">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
