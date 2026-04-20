"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { FullScreenSpinner } from "@/components/spinner";

interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  specialPrice: number | null;
  finalPrice: number;
  onSale: boolean;
  discountPercent: number;
  imageUrls: string[];
  stock: number | null;
  viewCount: number;
  emprendimiento: {
    id: string;
    name: string;
    logoUrl: string | null;
    visibility: "public" | "internal";
    contactEmail: string | null;
    contactPhone: string | null;
  };
  conjunto: { id: string; name: string; slug: string };
  rating: { average: number; total: number };
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    author: string;
  }>;
}

interface SessionData {
  authenticated: boolean;
}

function Stars({ value }: { value: number }) {
  return <span className="font-semibold text-amber-300">{`${value}/5`}</span>;
}

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug ?? "");

  const [session, setSession] = useState<SessionData>({ authenticated: false });
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [message, setMessage] = useState("");

  const loadDetail = useCallback(async () => {
    if (!slug) {
      setError("Producto no valido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const response = await fetch(`/api/catalog/detail?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "No se pudo cargar el producto.");
      setProduct(null);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as { product: ProductDetail };
    setProduct(data.product);
    setActiveImage(0);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    async function loadSession() {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        setSession({ authenticated: false });
        return;
      }

      const data = (await response.json()) as SessionData;
      setSession(data);
    }

    void loadSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDetail();
  }, [loadDetail]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) {
      return;
    }

    setMessage("");
    const response = await fetch("/api/platform/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_resena",
        data: {
          productId: product.id,
          rating: reviewRating,
          comment: reviewComment,
        },
      }),
    });

    const data = (await response.json()) as { message?: string; error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo guardar la reseña.");
      return;
    }

    setMessage(data.message ?? "Reseña agregada.");
    setReviewComment("");
    await loadDetail();
  }

  if (loading) {
    return <FullScreenSpinner label="Cargando producto" />;
  }

  if (error || !product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-2xl border border-white/10 bg-black/30 p-8">
          <p className="text-red-300">{error || "Producto no disponible."}</p>
          <Link href="/productos" className="mt-4 inline-block text-emerald-300 hover:text-emerald-200">
            Volver a productos
          </Link>
        </div>
      </main>
    );
  }

  const currentImage = product.imageUrls[activeImage] ?? "/images/hero-market.jpg";

  return (
    <main className="min-h-screen bg-[#070b10] text-zinc-100">
      <section className="mx-auto max-w-[1320px] px-6 py-12 lg:px-12">
        <div className="mb-8 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.14em] text-zinc-300">
          <Link href="/productos" className="hover:text-white">
            Productos
          </Link>
          <span>/</span>
          <Link href={`/productos?conjunto=${product.conjunto.slug}`} className="hover:text-white">
            {product.conjunto.name}
          </Link>
          <span>/</span>
          <span className="text-zinc-400">{product.name}</span>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="relative overflow-hidden border border-white/10 bg-black/35">
              <Image
                src={currentImage}
                alt={product.name}
                width={1300}
                height={860}
                className="h-[420px] w-full object-cover md:h-[560px]"
              />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {product.imageUrls.map((imageUrl, index) => (
                <button
                  key={`${imageUrl}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`relative overflow-hidden border ${index === activeImage ? "border-emerald-300" : "border-white/10"}`}
                >
                  <Image
                    src={imageUrl}
                    alt={`${product.name} ${index + 1}`}
                    width={280}
                    height={180}
                    className="h-20 w-full object-cover md:h-24"
                  />
                </button>
              ))}
            </div>
          </div>

          <aside className="space-y-5 border border-white/10 bg-black/30 p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">
              {product.conjunto.name}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold text-white">
              {product.name}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-emerald-300">${product.finalPrice.toFixed(2)}</p>
              {product.onSale ? (
                <>
                  <p className="text-lg text-zinc-500 line-through">${product.price.toFixed(2)}</p>
                  <span className="bg-amber-300 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] text-black">
                    -{product.discountPercent}%
                  </span>
                </>
              ) : null}
            </div>
            <p className="text-sm text-zinc-300">
              {product.stock === null ? "Stock no especificado" : `Stock disponible: ${product.stock}`}
            </p>
            <p className="text-sm leading-relaxed text-zinc-300">{product.description}</p>
            <div className="flex items-center justify-between border-y border-white/10 py-3 text-sm text-zinc-300">
              <span>{product.viewCount} vistas</span>
              <span>
                <Stars value={Math.round(product.rating.average)} /> - {product.rating.total} reseñas
              </span>
            </div>

            <div className="space-y-3 border border-white/10 bg-black/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Emprendimiento
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-full border border-white/20 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${product.emprendimiento.logoUrl || "/images/market-woman.jpg"})`,
                  }}
                />
                <div>
                  <p className="font-semibold text-white">{product.emprendimiento.name}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">
                    {product.emprendimiento.visibility === "public"
                      ? "Visible públicamente"
                      : "Visible solo en el conjunto"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-zinc-300">
                Contacto: {product.emprendimiento.contactEmail || "No definido"}
              </p>
              <p className="text-sm text-zinc-300">
                Teléfono: {product.emprendimiento.contactPhone || "No definido"}
              </p>
            </div>
          </aside>
        </div>

        <section className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          {session.authenticated ? (
            <form className="space-y-3 border border-white/10 bg-black/25 p-5" onSubmit={submitReview}>
              <h2 className="text-2xl font-semibold text-white">Escribe tu reseña</h2>
              <select
                value={reviewRating}
                onChange={(event) => setReviewRating(Number(event.target.value))}
                className="w-full border border-white/20 bg-black/40 px-4 py-3 text-sm"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} estrellas
                  </option>
                ))}
              </select>
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={4}
                placeholder="Comparte tu experiencia"
                className="w-full border border-white/20 bg-black/40 px-4 py-3 text-sm"
              />
              <button
                type="submit"
                className="w-full bg-zinc-100 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black hover:bg-white"
              >
                Publicar reseña
              </button>
              {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
            </form>
          ) : (
            <div className="border border-white/10 bg-black/25 p-5">
              <h2 className="text-2xl font-semibold text-white">Participa con reseñas</h2>
              <p className="mt-3 text-zinc-300">
                Inicia sesión para valorar este producto y ayudar a otros vecinos.
              </p>
              <Link
                href="/auth/login"
                className="mt-4 inline-block border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
              >
                Iniciar sesión
              </Link>
            </div>
          )}

          <div className="space-y-4 border border-white/10 bg-black/25 p-5">
            <h2 className="text-2xl font-semibold text-white">Reseñas del producto</h2>
            {product.reviews.length === 0 ? (
              <p className="text-zinc-400">Este producto todavía no tiene reseñas.</p>
            ) : (
              product.reviews.map((review) => (
                <article key={review.id} className="border border-white/10 bg-black/35 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-zinc-200">{review.author}</p>
                    <Stars value={review.rating} />
                  </div>
                  <p className="mt-2 text-zinc-300">{review.comment || "Sin comentario"}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
