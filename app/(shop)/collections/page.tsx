import Link from "next/link";
import { listPublicCollections } from "@/lib/actions/collections";

export default async function CollectionsIndexPage() {
  const collections = await listPublicCollections();

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <h1 className="font-display text-4xl">Collections</h1>
      <p className="mt-2 text-muted">Curated picks from Alpainoo.</p>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => (
          <li key={c.id}>
            <Link
              href={`/collections/${c.slug}`}
              className="block rounded-lg border border-border bg-white p-5 transition hover:border-sage"
            >
              <h2 className="font-display text-2xl">{c.name}</h2>
              {c.description ? (
                <p className="mt-2 text-sm text-muted line-clamp-3">{c.description}</p>
              ) : null}
            </Link>
          </li>
        ))}
        {!collections.length && (
          <li className="text-sm text-muted">Collections coming soon.</li>
        )}
      </ul>
    </div>
  );
}
