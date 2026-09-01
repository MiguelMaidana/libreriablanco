"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { calculateMargin } from "@/lib/pricing";
import { PriceWarningDialog } from "./price-warning-dialog";
import {
  createProduct,
  updateProduct,
  type ProductActionState,
} from "@/app/admin/(protected)/productos/actions";

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductFormValues {
  id?: string;
  name?: string;
  categoryId?: string;
  shortDescription?: string;
  cost?: number;
  price?: number;
  available?: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  sku?: string;
  isbn?: string;
  barcode?: string;
  brand?: string;
  author?: string;
  publisher?: string;
  tags?: string[];
}

interface ProductFormProps {
  mode: "create" | "edit";
  categories: CategoryOption[];
  initialValues?: ProductFormValues;
}

const initialState: ProductActionState = { error: null, productId: null };

export function ProductForm({ mode, categories, initialValues }: ProductFormProps) {
  const router = useRouter();
  const [cost, setCost] = useState(String(initialValues?.cost ?? ""));
  const [price, setPrice] = useState(String(initialValues?.price ?? ""));
  const [pendingSubmit, setPendingSubmit] = useState<FormData | null>(null);
  const submittedRef = useRef(false);

  const action = mode === "edit" ? updateProduct.bind(null, initialValues!.id!) : createProduct;
  const [state, formAction, pending] = useActionState(action, initialState);

  const margin = useMemo(() => {
    const costNumber = Number(cost) || 0;
    const priceNumber = Number(price) || 0;
    return calculateMargin(costNumber, priceNumber);
  }, [cost, price]);

  const showsPriceWarning = pendingSubmit !== null;

  useEffect(() => {
    if (!submittedRef.current || pending || state.error !== null || !state.productId) {
      return;
    }
    submittedRef.current = false;
    if (mode === "create") {
      router.push(`/admin/productos/${state.productId}?created=1`);
    } else {
      toast.success("Producto guardado.");
    }
  }, [state, pending, mode, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    submittedRef.current = true;
    if (margin.profit < 0 && pendingSubmit === null) {
      event.preventDefault();
      submittedRef.current = false;
      setPendingSubmit(new FormData(event.currentTarget));
    }
  }

  async function confirmSubmit() {
    if (!pendingSubmit) return;
    submittedRef.current = true;
    await formAction(pendingSubmit);
    setPendingSubmit(null);
  }

  return (
    <>
      <form action={formAction} onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre del producto</Label>
            <Input id="name" name="name" defaultValue={initialValues?.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoryId">Categoría</Label>
            <Select name="categoryId" defaultValue={initialValues?.categoryId}>
              <SelectTrigger id="categoryId">
                <SelectValue placeholder="Elegí una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="shortDescription">Descripción</Label>
            <Textarea
              id="shortDescription"
              name="shortDescription"
              defaultValue={initialValues?.shortDescription}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded border p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cost">¿Cuánto te cuesta?</Label>
            <Input
              id="cost"
              name="cost"
              type="number"
              step="0.01"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">¿A cuánto lo vendés?</Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Ganás por unidad:{" "}
            <span className="font-medium text-foreground">{`$${margin.profit}`}</span>
            {" — "}Eso representa:{" "}
            <span className="font-medium text-foreground">{`${margin.marginPercent}%`}</span> del precio
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="available">Disponible en la tienda</Label>
            <Switch id="available" name="available" defaultChecked={initialValues?.available ?? true} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isPublished">Mostrar en la tienda</Label>
            <Switch
              id="isPublished"
              name="isPublished"
              defaultChecked={initialValues?.isPublished ?? false}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isFeatured">Destacar en la página principal</Label>
            <Switch
              id="isFeatured"
              name="isFeatured"
              defaultChecked={initialValues?.isFeatured ?? false}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isNew">Mostrar como novedad</Label>
            <Switch id="isNew" name="isNew" defaultChecked={initialValues?.isNew ?? false} />
          </div>
        </section>

        <Accordion type="single" collapsible>
          <AccordionItem value="mas-datos">
            <AccordionTrigger>Más datos</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" name="sku" defaultValue={initialValues?.sku} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="isbn">ISBN</Label>
                <Input id="isbn" name="isbn" defaultValue={initialValues?.isbn} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="barcode">Código de barras</Label>
                <Input id="barcode" name="barcode" defaultValue={initialValues?.barcode} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="brand">Marca</Label>
                <Input id="brand" name="brand" defaultValue={initialValues?.brand} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="author">Autor</Label>
                <Input id="author" name="author" defaultValue={initialValues?.author} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="publisher">Editorial</Label>
                <Input id="publisher" name="publisher" defaultValue={initialValues?.publisher} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tags">Tags (separados por coma)</Label>
                <Input id="tags" name="tags" defaultValue={initialValues?.tags?.join(", ")} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar producto"}
        </Button>
      </form>

      <PriceWarningDialog
        open={showsPriceWarning}
        lossPerUnit={margin.profit}
        onConfirm={confirmSubmit}
        onCancel={() => setPendingSubmit(null)}
      />
    </>
  );
}
