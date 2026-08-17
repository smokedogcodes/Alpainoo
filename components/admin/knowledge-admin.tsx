"use client";

import { useTransition } from "react";
import {
  upsertKnowledgeArticle,
  deleteKnowledgeArticle,
  toggleKnowledgeArticle,
} from "@/lib/actions/tickets";
import { Button } from "@/components/ui/button";

type Article = {
  id: string;
  slug: string;
  title: string;
  question: string;
  answer: string;
  keywords: string;
  category: string;
  active: boolean;
};

function keywordsDisplay(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    /* ignore */
  }
  return raw;
}

export function KnowledgeAdmin({ articles }: { articles: Article[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-8">
      <form
        className="space-y-3 rounded-lg border border-border bg-white p-4"
        action={(fd) => {
          start(async () => {
            await upsertKnowledgeArticle({
              slug: String(fd.get("slug") || ""),
              title: String(fd.get("title") || ""),
              question: String(fd.get("question") || ""),
              answer: String(fd.get("answer") || ""),
              keywords: String(fd.get("keywords") || ""),
              category: String(fd.get("category") || "GENERAL"),
              active: fd.get("active") === "on",
            });
          });
        }}
      >
        <h2 className="font-display text-xl">Add FAQ</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input name="slug" placeholder="slug-url-key" required className="h-10 rounded border px-3 text-sm" />
          <input name="title" placeholder="Title" required className="h-10 rounded border px-3 text-sm" />
          <input name="category" placeholder="Category" defaultValue="GENERAL" className="h-10 rounded border px-3 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input name="active" type="checkbox" defaultChecked /> Active
          </label>
        </div>
        <input name="question" placeholder="Question" required className="h-10 w-full rounded border px-3 text-sm" />
        <textarea name="answer" placeholder="Answer" required rows={3} className="w-full rounded border px-3 py-2 text-sm" />
        <input
          name="keywords"
          placeholder="keywords, comma, separated"
          className="h-10 w-full rounded border px-3 text-sm"
        />
        <Button type="submit" disabled={pending}>
          Create article
        </Button>
      </form>

      <div className="space-y-4">
        {articles.map((a) => (
          <div key={a.id} className="rounded-lg border border-border bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {a.title}{" "}
                  <span className="text-xs text-muted">({a.slug})</span>
                </p>
                <p className="text-sm text-muted">{a.category} · {a.active ? "Active" : "Inactive"}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => start(() => toggleKnowledgeArticle(a.id, !a.active))}
                >
                  {a.active ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => start(() => deleteKnowledgeArticle(a.id))}
                >
                  Delete
                </Button>
              </div>
            </div>
            <form
              className="space-y-2"
              action={(fd) => {
                start(async () => {
                  await upsertKnowledgeArticle({
                    id: a.id,
                    slug: String(fd.get("slug") || a.slug),
                    title: String(fd.get("title") || a.title),
                    question: String(fd.get("question") || a.question),
                    answer: String(fd.get("answer") || a.answer),
                    keywords: String(fd.get("keywords") || ""),
                    category: String(fd.get("category") || a.category),
                    active: fd.get("active") === "on",
                  });
                });
              }}
            >
              <input name="slug" defaultValue={a.slug} className="h-9 w-full rounded border px-2 text-sm" />
              <input name="title" defaultValue={a.title} className="h-9 w-full rounded border px-2 text-sm" />
              <input name="category" defaultValue={a.category} className="h-9 w-full rounded border px-2 text-sm" />
              <input name="question" defaultValue={a.question} className="h-9 w-full rounded border px-2 text-sm" />
              <textarea name="answer" defaultValue={a.answer} rows={3} className="w-full rounded border px-2 py-1 text-sm" />
              <input
                name="keywords"
                defaultValue={keywordsDisplay(a.keywords)}
                className="h-9 w-full rounded border px-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input name="active" type="checkbox" defaultChecked={a.active} /> Active
              </label>
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
