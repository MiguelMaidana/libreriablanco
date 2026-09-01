"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  uploadProductImage,
  deleteProductImage,
  setPrimaryProductImage,
  reorderProductImage,
} from "@/app/admin/(protected)/productos/[id]/image-actions";

export interface ProductImage {
  id: string;
  url: string;
  position: number;
  isPrimary: boolean;
}

interface ProductImageManagerProps {
  productId: string;
  images: ProductImage[];
}

const MAX_IMAGES = 4;

export function ProductImageManager({ productId, images }: ProductImageManagerProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const sorted = [...images].sort((a, b) => a.position - b.position);

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      const result = await uploadProductImage(productId, { error: null }, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Imagen subida.");
        formRef.current?.reset();
      }
    });
  }

  function handleDelete(imageId: string) {
    startTransition(async () => {
      const result = await deleteProductImage(imageId, productId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Imagen eliminada.");
      }
    });
  }

  function confirmDelete() {
    if (!pendingDeleteId) return;
    handleDelete(pendingDeleteId);
    setPendingDeleteId(null);
  }

  function handleSetPrimary(imageId: string) {
    startTransition(async () => {
      const result = await setPrimaryProductImage(productId, imageId);
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  function handleReorder(imageId: string, direction: "up" | "down") {
    startTransition(async () => {
      const result = await reorderProductImage(productId, imageId, direction);
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Fotos</h2>
      <div className="flex flex-wrap gap-4">
        {sorted.map((image, index) => (
          <div key={image.id} className="flex w-32 flex-col gap-1">
            <Image
              src={image.url}
              alt="Foto del producto"
              width={128}
              height={128}
              className="aspect-square rounded object-cover"
            />
            {image.isPrimary && <span className="text-xs font-medium">Principal</span>}
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Mover la foto una posición antes"
                disabled={isPending || index === 0}
                onClick={() => handleReorder(image.id, "up")}
              >
                ▲
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Mover la foto una posición después"
                disabled={isPending || index === sorted.length - 1}
                onClick={() => handleReorder(image.id, "down")}
              >
                ▼
              </Button>
            </div>
            {!image.isPrimary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => handleSetPrimary(image.id)}
              >
                Marcar principal
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setPendingDeleteId(image.id)}
            >
              Eliminar
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(next) => !next && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta imagen?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sorted.length < MAX_IMAGES ? (
        <form ref={formRef} action={handleUpload} className="flex flex-col gap-2">
          <Label htmlFor="file">Subir imagen</Label>
          <input id="file" name="file" type="file" accept="image/*" required />
          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? "Subiendo..." : "Subir"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Llegaste al máximo de {MAX_IMAGES} imágenes.</p>
      )}
    </section>
  );
}
