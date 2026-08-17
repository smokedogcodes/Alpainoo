import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/admin";
import { KnowledgeAdmin } from "@/components/admin/knowledge-admin";

export default async function AdminKnowledgePage() {
  await requireAdmin();
  const articles = await prisma.knowledgeArticle.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tickets" className="text-sm text-sage underline">
          ← Tickets
        </Link>
        <h1 className="mt-2 font-display text-3xl">Knowledge base</h1>
        <p className="text-sm text-muted">
          FAQ answers matched before calling Gemini to save tokens.
        </p>
      </div>
      <KnowledgeAdmin articles={articles} />
    </div>
  );
}
