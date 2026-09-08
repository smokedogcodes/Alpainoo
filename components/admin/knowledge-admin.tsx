"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  upsertKnowledgeArticle,
  deleteKnowledgeArticle,
  toggleKnowledgeArticle,
} from "@/lib/actions/tickets";
import { FieldLabel, RequiredHint } from "@/components/admin/field-label";
import { AdminFormActions } from "@/components/admin/admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const form = e.currentTarget;
          start(async () => {
            try {
              await upsertKnowledgeArticle({
                slug: String(fd.get("slug") || ""),
                title: String(fd.get("title") || ""),
                question: String(fd.get("question") || ""),
                answer: String(fd.get("answer") || ""),
                keywords: String(fd.get("keywords") || ""),
                category: String(fd.get("category") || "GENERAL"),
                active: fd.get("active") === "on",
              });
              toast.success("FAQ article created successfully");
              form.reset();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not create article");
            }
          });
        }}
      >
        <h2 className="font-display text-xl">Add FAQ</h2>
        <RequiredHint />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="slug" required>
              Slug
            </FieldLabel>
            <Input id="slug" name="slug" placeholder="slug-url-key" required className="mt-1.5" />
          </div>
          <div>
            <FieldLabel htmlFor="title" required>
              Title
            </FieldLabel>
            <Input id="title" name="title" placeholder="Title" required className="mt-1.5" />
          </div>
          <div>
            <FieldLabel htmlFor="category">Category</FieldLabel>
            <Input id="category" name="category" placeholder="Category" defaultValue="GENERAL" className="mt-1.5" />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input name="active" type="checkbox" defaultChecked /> Active
          </label>
        </div>
        <div>
          <FieldLabel htmlFor="question" required>
            Question
          </FieldLabel>
          <Input id="question" name="question" placeholder="Question" required className="mt-1.5" />
        </div>
        <div>
          <FieldLabel htmlFor="answer" required>
            Answer
          </FieldLabel>
          <Textarea id="answer" name="answer" placeholder="Answer" required rows={3} className="mt-1.5" />
        </div>
        <div>
          <FieldLabel htmlFor="keywords">Keywords</FieldLabel>
          <Input
            id="keywords"
            name="keywords"
            placeholder="keywords, comma, separated"
            className="mt-1.5"
          />
        </div>
        <AdminFormActions>
          <Button type="submit" disabled={pending}>
            Create article
          </Button>
        </AdminFormActions>
      </form>

      <div className="space-y-4">
        {articles.map((a) => (
          <div key={a.id} className="space-y-3 rounded-lg border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {a.title}{" "}
                  <span className="text-xs text-muted">({a.slug})</span>
                </p>
                <p className="text-sm text-muted">
                  {a.category} · {a.active ? "Active" : "Inactive"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      try {
                        await toggleKnowledgeArticle(a.id, !a.active);
                        toast.success(a.active ? "Article disabled" : "Article enabled");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Update failed");
                      }
                    })
                  }
                >
                  {a.active ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      if (!confirm("Delete this article?")) return;
                      try {
                        await deleteKnowledgeArticle(a.id);
                        toast.success("Article deleted");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Delete failed");
                      }
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            </div>
            <p className="text-sm">
              <span className="font-medium">Q:</span> {a.question}
            </p>
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">A:</span> {a.answer}
            </p>
            {keywordsDisplay(a.keywords) ? (
              <p className="text-xs text-muted">Keywords: {keywordsDisplay(a.keywords)}</p>
            ) : null}
          </div>
        ))}
        {!articles.length && <p className="text-sm text-muted">No knowledge articles yet.</p>}
      </div>
    </div>
  );
}
