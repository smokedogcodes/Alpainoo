"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitReview } from "@/lib/actions/reviews";

export function ReviewForm({
  productId,
  defaultAuthor,
}: {
  productId: string;
  defaultAuthor?: string;
}) {
  const [author, setAuthor] = useState(defaultAuthor || "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await submitReview({ productId, author, title: title || undefined, body, rating });
        toast.success("Review submitted — pending approval");
        setTitle("");
        setBody("");
        setRating(5);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not submit review");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-lg space-y-3 rounded-lg border border-border bg-cream p-4">
      <h3 className="font-display text-lg text-sage">Write a review</h3>
      <div>
        <Label htmlFor="review-author">Name</Label>
        <Input
          id="review-author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          required
          maxLength={100}
        />
      </div>
      <div>
        <Label htmlFor="review-rating">Rating</Label>
        <select
          id="review-rating"
          className="flex h-11 w-full rounded-md border border-border bg-white px-3 text-sm"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </div>
      <div>
        <Label htmlFor="review-body">Review</Label>
        <Textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          maxLength={5000}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
