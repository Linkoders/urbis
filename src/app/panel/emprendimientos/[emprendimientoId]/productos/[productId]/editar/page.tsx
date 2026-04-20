"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PRODUCT_CATEGORIES } from "@/config/product-categories";
import { uploadImageFiles } from "@/lib/upload-client";
import { FullScreenSpinner, Spinner } from "@/components/spinner";

interface SessionUser {
  id: string;
  role: "resident" | "admin_conjunto" | "superadmin";
}

interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;
  specialPrice: number | null;
  category: string;
  stock: number | null;
  imageUrls: string[];
  status: "draft" | "published" | "paused" | "archived";
}

interface HierarchyResponse {
  user: SessionUser;
  emprendimiento: {
    id: string;
    name: string;
  };
  products: ProductData[];
}

const MAX_PRODUCT_IMAGES = 5;

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function mergeProductImages(current: File[], incoming: File[]): File[] {
  const byKey = new Map<string, File>();

  for (const file of current) {
    byKey.set(fileKey(file), file);
  }

  for (const file of incoming) {
    byKey.set(fileKey(file), file);
  }

  return Array.from(byKey.values()).slice(0, MAX_PRODUCT_IMAGES);
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ emprendimientoId: string; productId: string }>();
  const emprendimientoId = String(params?.emprendimientoId ?? "");
  const productId = String(params?.productId ?? "");

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [emprendimientoName, setEmprendimientoName] = useState("");
  const loadedRef = useRef(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [specialPrice, setSpecialPrice] = useState("");
  const [category, setCategory] = useState("General");
  const [stock, setStock] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "paused" | "archived">("draft");
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const allCategories = useMemo(
    () => [...new Set([...PRODUCT_CATEGORIES, category].filter(Boolean))],
    [category],
  );

  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;

    async function loadData() {
      const response = await fetch(
        `/api/platform/hierarchy?emprendimientoId=${emprendimientoId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "No se pudo cargar el producto.");
        setLoadingData(false);
        return;
      }

      const data = (await response.json()) as HierarchyResponse;
      const product = (data.products ?? []).find((entry) => entry.id === productId);

      if (!product) {
        setError("Producto no encontrado en este emprendimiento.");
        setLoadingData(false);
        return;
      }

      setUser(data.user);
      setEmprendimientoName(data.emprendimiento.name);
      setName(product.name);
      setDescription(product.description);
      setPrice(String(product.price));
      setSpecialPrice(product.specialPrice === null ? "" : String(product.specialPrice));
      setCategory(product.category || "General");
      setStock(product.stock === null ? "" : String(product.stock));
      setStatus(product.status);
      setExistingImageUrls(product.imageUrls);
      setImagePreviews(product.imageUrls);
      setLoadingData(false);
    }

    void loadData();
  }, [emprendimientoId, productId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    let imageUrls = existingImageUrls;
    if (imageFiles.length > 0) {
      if (imageFiles.length > MAX_PRODUCT_IMAGES) {
        setError(`Puedes subir hasta ${MAX_PRODUCT_IMAGES} imágenes por producto.`);
        setSaving(false);
        return;
      }

      try {
        imageUrls = await uploadImageFiles(imageFiles);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "No se pudieron subir las imágenes.");
        setSaving(false);
        return;
      }
    }

    const response = await fetch("/api/platform/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_producto",
        data: {
          productId,
          name,
          description,
          price: Number(price),
          specialPrice,
          category,
          stock,
          status,
          imageUrls,
        },
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "No se pudo actualizar el producto.");
      setSaving(false);
      return;
    }

    router.push(`/panel/emprendimientos/${emprendimientoId}`);
    router.refresh();
  }

  if (loadingData) {
    return <FullScreenSpinner label="Cargando formulario" />;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-xl border border-white/10 bg-black/30 p-8">
          <p className="text-zinc-300">{error || "No autorizado."}</p>
          <Link
            href={`/panel/emprendimientos/${emprendimientoId}`}
            className="mt-4 inline-block text-emerald-300 hover:text-emerald-200"
          >
            Volver a productos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b10] px-6 py-10 text-zinc-100 lg:px-12 urbis-watermark">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Editar producto</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
            Actualizar producto de {emprendimientoName}
          </h1>
        </header>

        <form onSubmit={submit} className="space-y-4 border border-white/10 bg-black/25 p-6">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del producto"
            className="w-full border border-white/20 bg-black/40 px-4 py-3"
            required
          />

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descripción"
            rows={3}
            className="w-full border border-white/20 bg-black/40 px-4 py-3"
            required
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="number"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Precio"
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
              required
            />
            <input
              type="number"
              value={specialPrice}
              onChange={(event) => setSpecialPrice(event.target.value)}
              placeholder="Precio en oferta (opcional)"
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            >
              {allCategories.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              placeholder="Stock opcional"
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            />
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "draft" | "published" | "paused" | "archived")
              }
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="paused">Pausado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>

          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                const incoming = Array.from(event.target.files ?? []);
                if (incoming.length === 0) {
                  return;
                }

                const merged = mergeProductImages(imageFiles, incoming);
                if (merged.length < imageFiles.length + incoming.length) {
                  setError(`Solo se guardan ${MAX_PRODUCT_IMAGES} imágenes máximo.`);
                } else {
                  setError("");
                }

                setImageFiles(merged);
                setImagePreviews(merged.map((file) => URL.createObjectURL(file)));
                event.currentTarget.value = "";
              }}
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            />
            <p className="text-xs text-zinc-400">Máximo {MAX_PRODUCT_IMAGES} imágenes. Puedes seleccionar varias veces.</p>
            <div className="grid grid-cols-4 gap-2">
              {(imagePreviews.length > 0 ? imagePreviews : ["/images/hero-market.jpg"]).map(
                (preview, index) => (
                  <div
                    key={`${preview}-${index}`}
                    className="h-20 border border-white/20 bg-cover bg-center"
                    style={{ backgroundImage: `url(${preview})` }}
                  />
                ),
              )}
            </div>
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-zinc-100 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black hover:bg-white disabled:opacity-60"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="sm" className="text-black" />
                  Guardando...
                </span>
              ) : (
                "Guardar cambios"
              )}
            </button>
            <Link
              href={`/panel/emprendimientos/${emprendimientoId}`}
              className="border border-white/30 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] hover:border-white"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
