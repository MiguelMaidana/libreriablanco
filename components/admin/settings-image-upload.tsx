"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ImageActionState } from "@/app/admin/(protected)/configuracion/image-actions";

interface SettingsImageUploadProps {
  label: string;
  currentUrl: string | null;
  uploadAction: (prevState: ImageActionState, formData: FormData) => Promise<ImageActionState>;
}

export function SettingsImageUpload({ label, currentUrl, uploadAction }: SettingsImageUploadProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await uploadAction({ error: null }, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${label} actualizado.`);
        formRef.current?.reset();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {currentUrl && (
        <Image
          src={currentUrl}
          alt={label}
          width={128}
          height={128}
          className="aspect-square rounded object-cover"
        />
      )}
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          name="file"
          type="file"
          accept="image/*"
          required
          aria-label={`Subir ${label.toLowerCase()}`}
        />
        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? "Subiendo..." : "Subir"}
        </Button>
      </form>
    </div>
  );
}
