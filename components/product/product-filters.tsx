"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDismissOnRouteChange } from "@/hooks/use-dismiss-on-route-change";

type Props = {
  brands: string[];
  categories: string[];
  current: Record<string, string | undefined>;
};

function FiltersForm({ brands, categories, current, onDone }: Props & { onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState(current.q || "");
  const [category, setCategory] = useState(current.category || "");
  const [brand, setBrand] = useState(current.brand || "");
  const [min, setMin] = useState(current.min || "");
  const [max, setMax] = useState(current.max || "");
  const [inStock, setInStock] = useState(current.inStock === "1");
  const [sort, setSort] = useState(current.sort || "popular");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (brand) params.set("brand", brand);
    if (min) params.set("min", min);
    if (max) params.set("max", max);
    if (inStock) params.set("inStock", "1");
    if (sort && sort !== "popular") params.set("sort", sort);
    router.push(`/products?${params.toString()}`);
    onDone?.();
  }

  return (
    <form onSubmit={apply} className="space-y-5">
      <div>
        <Label htmlFor="q">Search</Label>
        <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm"
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="brand">Brand</Label>
        <select
          id="brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm"
        >
          <option value="">All</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="min">Min ₹</Label>
          <Input id="min" type="number" value={min} onChange={(e) => setMin(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="max">Max ₹</Label>
          <Input id="max" type="number" value={max} onChange={(e) => setMax(e.target.value)} className="mt-1.5" />
        </div>
      </div>
      <div>
        <Label htmlFor="sort">Sort</Label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm"
        >
          <option value="popular">Popularity</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
        In stock only
      </label>
      <Button type="submit" className="w-full">
        Apply filters
      </Button>
    </form>
  );
}

export function ProductFilters(props: Props) {
  const [open, setOpen] = useState(false);
  useDismissOnRouteChange(() => setOpen(false));
  return (
    <>
      <div className="lg:hidden mb-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <Filter className="h-4 w-4" /> Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto p-6 pt-14">
            <SheetHeader className="p-0 mb-4">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <FiltersForm {...props} onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
      <aside className="hidden lg:block sticky top-28 self-start rounded-lg border border-border bg-white p-4">
        <h2 className="font-display text-xl mb-4">Filters</h2>
        <FiltersForm {...props} />
      </aside>
    </>
  );
}
