"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteCategoryAction,
  updateCategoryAction,
} from "@/lib/actions/categories";
import { AdminForm, AdminFormActions } from "@/components/admin/admin-form";
import { FieldLabel } from "@/components/admin/field-label";
import { Can, useCan } from "@/components/admin/admin-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export function CategoryListItem({ category }: { category: Category }) {
  const canEdit = useCan("categories", "edit");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <li className="space-y-3 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{category.name}</p>
          <p className="text-xs text-muted">/{category.slug}</p>
          {category.description ? (
            <p className="mt-0.5 text-xs text-muted">{category.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted">#{category.sortOrder}</span>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Cancel" : "Edit"}
            </Button>
          )}
          <Can screen="categories" action="delete">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete category “${category.name}”? Products keep their category label but lose the master link.`
                  )
                ) {
                  return;
                }
                start(async () => {
                  try {
                    const fd = new FormData();
                    fd.set("id", category.id);
                    await deleteCategoryAction(fd);
                    toast.success("Category deleted");
                    router.refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Delete failed");
                  }
                });
              }}
            >
              Delete
            </Button>
          </Can>
        </div>
      </div>

      {editing && canEdit ? (
        <AdminForm
          action={async (fd) => {
            await updateCategoryAction(fd);
            setEditing(false);
          }}
          successMessage="Category updated"
          errorMessage="Could not update category"
          className="space-y-3 rounded-md border border-border bg-off-white p-3"
        >
          <input type="hidden" name="id" value={category.id} />
          <div>
            <FieldLabel htmlFor={`name-${category.id}`} required>
              Name
            </FieldLabel>
            <Input
              id={`name-${category.id}`}
              name="name"
              required
              defaultValue={category.name}
              className="mt-1.5"
            />
          </div>
          <div>
            <FieldLabel htmlFor={`description-${category.id}`}>Description</FieldLabel>
            <Input
              id={`description-${category.id}`}
              name="description"
              defaultValue={category.description || ""}
              className="mt-1.5"
            />
          </div>
          <div>
            <FieldLabel htmlFor={`sortOrder-${category.id}`}>Sort order</FieldLabel>
            <Input
              id={`sortOrder-${category.id}`}
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={category.sortOrder}
              className="mt-1.5"
            />
          </div>
          <AdminFormActions>
            <Button type="submit" size="sm">
              Save changes
            </Button>
          </AdminFormActions>
        </AdminForm>
      ) : null}
    </li>
  );
}
