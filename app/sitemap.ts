import type { MetadataRoute } from "next";
import { listProducts } from "@/lib/db/products";
import { listPublishedPosts } from "@/lib/db/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://alpainoo.com").replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/sale`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];

  let products: MetadataRoute.Sitemap = [];
  let posts: MetadataRoute.Sitemap = [];

  try {
    const [productRows, postRows] = await Promise.all([
      listProducts({ take: 500 }),
      listPublishedPosts(),
    ]);
    products = productRows.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
    posts = postRows.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.warn("[sitemap] failed to load dynamic URLs:", err);
  }

  return [...staticRoutes, ...products, ...posts];
}
