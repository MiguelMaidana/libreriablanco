import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ShopProduct } from "@/lib/shop/products";

interface ProductCardProps {
  product: ShopProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/productos/${product.slug}`}
      className="flex flex-col gap-2 rounded-lg border p-3 transition hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden rounded bg-muted">
        {product.imageUrl && (
          <Image src={product.imageUrl} alt={product.name ?? ""} fill className="object-cover" />
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {product.is_new && <Badge>Nuevo</Badge>}
          {product.is_featured && <Badge variant="secondary">Destacado</Badge>}
        </div>
      </div>
      <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
      <p className="text-lg font-semibold text-primary">{`$${product.price}`}</p>
    </Link>
  );
}
