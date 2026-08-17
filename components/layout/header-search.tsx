"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDismissOnRouteChange } from "@/hooks/use-dismiss-on-route-change";
import { formatINR } from "@/lib/utils";

type Suggestion = {
  id: string;
  title: string;
  slug: string;
  brand: string;
  category: string;
  sellingPrice: number;
  image: string;
};

export function HeaderSearch() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useDismissOnRouteChange(close);

  const goSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) {
        inputRef.current?.focus();
        return;
      }
      close();
      setOpen(false);
      router.push(`/products?q=${encodeURIComponent(trimmed)}`);
    },
    [close, router]
  );

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    const trimmed = q.trim();
    if (!open || trimmed.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setItems(data.products || []);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setItems([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [q, open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        close();
        router.push(`/products/${items[activeIndex].slug}`);
        return;
      }
      goSearch(q);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Search products">
        <Search className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div ref={rootRef} className="relative z-50 w-[min(70vw,16rem)] sm:w-56 lg:w-64">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goSearch(q);
        }}
        className="flex w-full items-center gap-1"
      >
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search serums, brands…"
            className="h-10 w-full border-border/50 bg-cream pl-8 pr-8"
            aria-label="Search products"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={items.length > 0}
            autoComplete="off"
          />
          <button
            type="button"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
            aria-label="Close search"
            onClick={() => {
              setQ("");
              close();
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </form>

      {(loading || q.trim().length > 0) && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-cream shadow-lg"
        >
          {loading && (
            <p className="px-3 py-3 text-sm text-muted">Searching…</p>
          )}
          {!loading && items.length === 0 && q.trim().length > 0 && (
            <div className="px-3 py-3">
              <p className="text-sm text-muted">No products for “{q.trim()}”</p>
              <button
                type="button"
                className="mt-2 text-sm text-sage underline"
                onClick={() => goSearch(q)}
              >
                Search shop anyway
              </button>
            </div>
          )}
          {!loading &&
            items.map((item, index) => (
              <Link
                key={item.id}
                href={`/products/${item.slug}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-off-white ${
                  index === activeIndex ? "bg-off-white" : ""
                }`}
                onClick={close}
              >
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-blush-soft">
                  <Image src={item.image} alt="" fill sizes="44px" className="object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {item.brand} · {item.category}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-sage">{formatINR(item.sellingPrice)}</span>
              </Link>
            ))}
          {!loading && items.length > 0 && (
            <button
              type="button"
              className="flex w-full items-center justify-between border-t border-border bg-surface-low px-3 py-2.5 text-left text-sm text-sage hover:bg-off-white"
              onClick={() => goSearch(q)}
            >
              <span>View all results for “{q.trim()}”</span>
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
