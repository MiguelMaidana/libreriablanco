"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleCategoryActive } from "@/app/admin/(protected)/categorias/actions";
import { toast } from "sonner";

interface CategoryActiveToggleProps {
  categoryId: string;
  isActive: boolean;
}

export function CategoryActiveToggle({ categoryId, isActive }: CategoryActiveToggleProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Switch
      checked={isActive}
      disabled={isPending}
      onCheckedChange={(checked) => {
        startTransition(async () => {
          const result = await toggleCategoryActive(categoryId, checked);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success(checked ? "Categoría activada." : "Categoría desactivada.");
          }
        });
      }}
    />
  );
}
