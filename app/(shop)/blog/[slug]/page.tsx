import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import { ProductCard } from "@/components/product/product-card";

type Props = { params: { slug: string } };

export async function generateStaticParams() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    select: { slug: true },
  });
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await prisma.blogPost.findUnique({ where: { slug: params.slug } });
  if (!post) return { title: "Blog" };
  return { title: post.title, description: post.excerpt };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await prisma.blogPost.findUnique({ where: { slug: params.slug } });
  if (!post || !post.published) notFound();

  const tags = parseJsonArray(post.tags);
  const related = await prisma.product.findMany({
    where: {
      isHidden: false,
      OR: tags.flatMap((t) => [
        { category: { contains: t } },
        { title: { contains: t } },
      ]),
    },
    take: 4,
  });

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-lg bg-blush-soft">
        <Image
          src={post.coverImage || "/blog/am-routine.jpg"}
          alt={post.title}
          fill
          priority
          sizes="(max-width:768px) 100vw, 768px"
          className="object-cover"
        />
      </div>
      <p className="text-sm text-muted">
        {post.createdAt.toLocaleDateString("en-IN", { dateStyle: "long" })}
      </p>
      <h1 className="mt-2 font-display text-4xl md:text-5xl">{post.title}</h1>
      <p className="mt-4 text-lg text-muted">{post.excerpt}</p>
      <div className="prose prose-neutral mt-10 max-w-none whitespace-pre-wrap text-sm leading-7">
        {post.content}
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-10">
          <h2 className="font-display text-3xl">Related products</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
