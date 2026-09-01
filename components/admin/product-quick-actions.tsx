"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  toggleProductAvailability,
  toggleProductPublished,
  toggleProductFeatured,
} from "@/app/admin/(protected)/productos/actions";

interface ProductQuickActionsProps {
  productId: string;
  available: boolean;
  isPublished: boolean;
  isFeatured: boolean;
}

export function ProductQuickActions({
  productId,
  available,
  isPublished,
  isFeatured,
}: ProductQuickActionsProps) {
  const [isPending, startTransition] = useTransition();

  function run(promise: Promise<{ error: string | null }>, successMessage: string) {
    startTransition(async () => {
      const result = await promise;
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(successMessage);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          aria-label="Disponible"
          checked={available}
          disabled={isPending}
          onCheckedChange={(checked) =>
            run(toggleProductAvailability(productId, checked), "Disponibilidad actualizada.")
          }
        />
        Disponible
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          run(
            toggleProductPublished(productId, !isPublished),
            isPublished ? "Producto despublicado." : "Producto publicado.",
          )
        }
      >
        {isPublished ? "Despublicar" : "Publicar"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          run(
            toggleProductFeatured(productId, !isFeatured),
            isFeatured ? "Producto ya no está destacado." : "Producto destacado.",
          )
        }
      >
        {isFeatured ? "Quitar destacado" : "Destacar"}
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/productos/${productId}`}>Editar</Link>
      </Button>
    </div>
  );
}
