"use client";

import { useState } from "react";
import Image from "next/image";

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return <div className="aspect-square rounded bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square overflow-hidden rounded bg-muted">
        <Image src={images[selected]!} alt={alt} fill className="object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setSelected(index)}
              className={`relative size-16 overflow-hidden rounded border ${
                index === selected ? "border-primary" : "border-transparent"
              }`}
            >
              <Image src={url} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
