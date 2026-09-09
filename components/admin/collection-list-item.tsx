"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  deleteCollectionAction,
  updateCollectionAction,
} from "@/lib/actions/collections";
import { AdminForm, AdminFormActions } from "@/components/admin/admin-form";
import { FieldLabel } from "@/components/admin/field-label";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { CollectionProductPicker } from "@/components/admin/collection-product-picker";
import { Can, useCan } from "@/components/admin/admin-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Collection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
};

export function CollectionListItem({
  collection,
  selectedProductIds,
  productOptions,
}: {
  collection: Collection;
  selectedProductIds: string[];
  productOptions: Array<{ id: string; title: string }>;
}) {
  const canEdit = useCan("collections", "edit");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <li className="rounded-lg border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{collection.name}</p>
          <p className="text-xs text-muted">
            /collections/{collection.slug} · {selectedProductIds.length} product(s)
          </p>
          {collection.description && (
            <p className="mt-1 text-sm text-muted">{collection.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/collections/${collection.slug}`} className="mr-1 text-sm text-sage underline">
            View shop page
          </Link>
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
          <Can screen="collections" action="delete">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete collection “${collection.name}”? This removes it from the shop.`
                  )
                ) {
                  return;
                }
                start(async () => {
                  try {
                    const fd = new FormData();
                    fd.set("id", collection.id);
                    await deleteCollectionAction(fd);
                    toast.success("Collection deleted");
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
            await updateCollectionAction(fd);
            setEditing(false);
          }}
          successMessage="Collection updated"
          errorMessage="Could not update collection"
          className="mt-4 space-y-3 rounded-md border border-border bg-off-white p-3"
        >
          <input type="hidden" name="id" value={collection.id} />
          <div>
            <FieldLabel htmlFor={`name-${collection.id}`} required>
              Name
            </FieldLabel>
            <Input
              id={`name-${collection.id}`}
              name="name"
              required
              defaultValue={collection.name}
              className="mt-1.5"
            />
          </div>
          <div>
            <FieldLabel htmlFor={`description-${collection.id}`}>Description</FieldLabel>
            <Input
              id={`description-${collection.id}`}
              name="description"
              defaultValue={collection.description || ""}
              className="mt-1.5"
            />
          </div>
          <ImageUploadField
            name="coverImage"
            id={`coverImage-${collection.id}`}
            defaultValue={collection.coverImage || ""}
          />
          <AdminFormActions>
            <Button type="submit" size="sm">
              Save changes
            </Button>
          </AdminFormActions>
        </AdminForm>
      ) : null}

      <Can screen="collections" action="edit">
        <CollectionProductPicker
          collectionId={collection.id}
          productOptions={productOptions}
          initialSelectedIds={selectedProductIds}
        />
      </Can>
    </li>
  );
}
