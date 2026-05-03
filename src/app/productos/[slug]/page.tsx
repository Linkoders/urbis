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
  user?: {
    id: string;
    name: string;
  };
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-300">
      {"â˜…".repeat(Math.max(0, Math.min(5, value)))}
      <span className="text-zinc-600">{"â˜…".repeat(Math.max(0, 5 - value))}</span>
    </span>
  );
}
function toWhatsappEcuador(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("593")) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `593${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `593${digits}`;
  }

  return digits;
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
  const [favorite, setFavorite] = useState(false);
  const [interested, setInterested] = useState(false);
  const [preferenceLoading, setPreferenceLoading] = useState(false);

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

  useEffect(() => {
    async function loadPreferences() {
      if (!session.authenticated || !product) {
        setFavorite(false);
        setInterested(false);
        return;
      }

      const response = await fetch(
        `/api/user/product-preferences?productId=${encodeURIComponent(product.id)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        favorite?: boolean;
        interested?: boolean;
      };
      setFavorite(Boolean(data.favorite));
      setInterested(Boolean(data.interested));
    }

    void loadPreferences();
  }, [product, session.authenticated]);

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
      setMessage(data.error ?? "No se pudo guardar la reseÃ±a.");
      return;
    }

    setMessage(data.message ?? "ReseÃ±a agregada.");
    setReviewComment("");
    await loadDetail();
  }

  async function setProductPreference(action: "favorite" | "unfavorite" | "interest") {
    if (!product || !session.authenticated) {
      setMessage("Inicia sesiÃ³n para guardar preferencias.");
      return;
    }

    setPreferenceLoading(true);
    setMessage("");

    const response = await fetch("/api/user/product-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        action,
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar la preferencia.");
      setPreferenceLoading(false);
      return;
    }

    if (action === "favorite") {
      setFavorite(true);
      setMessage("Producto agregado a favoritos.");
    } else if (action === "unfavorite") {
      setFavorite(false);
      setMessage("Producto eliminado de favoritos.");
    } else {
      setInterested(true);
      setMessage("Marcado como me interesa.");
    }

    setPreferenceLoading(false);
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
                <Stars value={Math.round(product.rating.average)} /> - {product.rating.total} reseÃ±as
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
                      ? "Visible pÃºblicamente"
                      : "Visible solo en el conjunto"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-zinc-300">
                Contacto: {product.emprendimiento.contactEmail || "No definido"}
              </p>
              <p className="text-sm text-zinc-300">
                TelÃ©fono: {product.emprendimiento.contactPhone || "No definido"}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.emprendimiento.contactPhone ? (
                  <a
                    href={`https://wa.me/${toWhatsappEcuador(product.emprendimiento.contactPhone)}?text=${encodeURIComponent(`Hola, me interesa ${product.name}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-emerald-300/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 hover:border-emerald-300"
                  >
                    Contactar por WhatsApp
                  </a>
                ) : null}
                {product.emprendimiento.contactEmail ? (
                  <a
                    href={`mailto:${product.emprendimiento.contactEmail}?subject=${encodeURIComponent(`Consulta: ${product.name}`)}`}
                    className="border border-cyan-300/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200 hover:border-cyan-300"
                  >
                    Enviar correo
                  </a>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void setProductPreference(favorite ? "unfavorite" : "favorite")}
                  disabled={preferenceLoading}
                  className={`border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-60 ${favorite ? "border-amber-300 text-amber-200" : "border-white/30 text-zinc-100 hover:border-white"}`}
                >
                  {favorite ? "Quitar favorito" : "Agregar favorito"}
                </button>
                <button
                  type="button"
                  onClick={() => void setProductPreference("interest")}
                  disabled={preferenceLoading || interested}
                  className={`border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-60 ${interested ? "border-emerald-300 text-emerald-200" : "border-white/30 text-zinc-100 hover:border-white"}`}
                >
                  {interested ? "Te interesa" : "Me interesa"}
                </button>
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          {session.authenticated ? (
            <form className="space-y-3 border border-white/10 bg-black/25 p-5" onSubmit={submitReview}>
              <h2 className="text-2xl font-semibold text-white">Escribe tu reseÃ±a</h2>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className={`text-2xl ${reviewRating >= value ? "text-amber-300" : "text-zinc-500"}`}
                  >
                    â˜…
                  </button>
                ))}
                <span className="text-sm text-zinc-300">{reviewRating}/5</span>
              </div>
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
                Publicar reseÃ±a
              </button>
              {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
            </form>
          ) : (
            <div className="border border-white/10 bg-black/25 p-5">
              <h2 className="text-2xl font-semibold text-white">Participa con reseÃ±as</h2>
              <p className="mt-3 text-zinc-300">
                Inicia sesiÃ³n para valorar este producto y ayudar a otros vecinos.
              </p>
              <Link
                href="/auth/login"
                className="mt-4 inline-block border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
              >
                Iniciar sesiÃ³n
              </Link>
            </div>
          )}

          <div className="space-y-4 border border-white/10 bg-black/25 p-5">
            <h2 className="text-2xl font-semibold text-white">ReseÃ±as del producto</h2>
            {product.reviews.length === 0 ? (
              <p className="text-zinc-400">Este producto todavÃ­a no tiene reseÃ±as.</p>
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

