import { ProductForm } from "@/components/admin/product-form";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Add product</h1>
      <ProductForm />
    </div>
  );
}
