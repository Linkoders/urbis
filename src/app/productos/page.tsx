"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  finalPrice: number;
  onSale: boolean;
  discountPercent: number;
  category: string;
  image: string;
  viewCount: number;
  rating: { average: number; total: number };
  conjunto: { name: string };
  emprendimiento: { name: string };
}

interface Viewer {
  id: string;
  role: "resident" | "admin_conjunto" | "superadmin";
  conjuntoId: string | null;
}

interface ProductsResponse {
  products: CatalogProduct[];
  categories: string[];
  conjuntos: Array<{ slug: string; name: string }>;
  viewer: Viewer | null;
  hasMore: boolean;
}

const PAGE_SIZE = 12;

function tileClass(index: number): string {
  const pattern = index % 8;

  if (pattern === 0) {
    return "sm:col-span-2";
  }

  if (pattern === 3 || pattern === 6) {
    return "md:translate-y-6";
  }

  return "";
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [conjuntos, setConjuntos] = useState<Array<{ slug: string; name: string }>>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [category, setCategory] = useState("all");
  const [conjunto, setConjunto] = useState(searchParams.get("conjunto") ?? "all");
  const [sort, setSort] = useState("recent");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [onSaleOnly, setOnSaleOnly] = useState(searchParams.get("onSale") === "1");
  const [scope, setScope] = useState(searchParams.get("scope") ?? "all");

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (nextOffset: number, replace: boolean) => {
      const params = new URLSearchParams({
        search,
        category,
        conjunto,
        sort,
        minPrice,
        maxPrice,
        scope,
        onSale: onSaleOnly ? "1" : "0",
        offset: String(nextOffset),
        limit: String(PAGE_SIZE),
      });

      const response = await fetch(`/api/catalog?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        if (replace) {
          setProducts([]);
        }
        setHasMore(false);
        return;
      }

      const data = (await response.json()) as ProductsResponse;
      setCategories(data.categories ?? []);
      setConjuntos(data.conjuntos ?? []);
      setViewer(data.viewer ?? null);
      setHasMore(Boolean(data.hasMore));

      setProducts((prev) => {
        if (replace) {
          return data.products ?? [];
        }

        return [...prev, ...(data.products ?? [])];
      });
    },
    [search, category, conjunto, sort, minPrice, maxPrice, scope, onSaleOnly],
  );

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoadingInitial(true);
      setOffset(0);
      await fetchPage(0, true);
      setLoadingInitial(false);
    }, 220);

    return () => clearTimeout(timeout);
  }, [fetchPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loadingInitial) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || !hasMore || loadingMore) {
          return;
        }

        const nextOffset = offset + PAGE_SIZE;
        setLoadingMore(true);
        void fetchPage(nextOffset, false).finally(() => {
          setOffset(nextOffset);
          setLoadingMore(false);
        });
      },
      { rootMargin: "300px 0px 300px 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loadingInitial, loadingMore, offset]);

  const hasFilters = useMemo(
    () =>
      Boolean(
        search ||
          category !== "all" ||
          conjunto !== "all" ||
          minPrice ||
          maxPrice ||
          sort !== "recent" ||
          onSaleOnly ||
          scope !== "all",
      ),
    [search, category, conjunto, minPrice, maxPrice, sort, onSaleOnly, scope],
  );

  return (
    <main className="min-h-screen bg-[#070b10] text-zinc-100">
      <section className="mx-auto max-w-[1320px] px-6 py-12 lg:px-12">
        <div className="fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Productos URBIS
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold text-white sm:text-6xl">
            Productos de tu comunidad
          </h1>
          <p className="mt-4 max-w-3xl text-zinc-300">
            Explora productos en mosaico, activa filtros en tiempo real y navega
            por ofertas activas o por tu propio conjunto.
          </p>
        </div>

        <div
          className="mt-10 grid gap-4 border border-white/10 bg-black/25 p-4 sm:grid-cols-2 lg:grid-cols-8 fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto o emprendimiento"
            className="border border-white/20 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300 lg:col-span-2"
          />

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="border border-white/20 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>

          <select
            value={conjunto}
            onChange={(event) => setConjunto(event.target.value)}
            className="border border-white/20 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300"
          >
            <option value="all">Todos los conjuntos</option>
            {conjuntos.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="border border-white/20 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300"
          >
            <option value="recent">Más recientes</option>
            <option value="popular">Más vistos</option>
            <option value="rating">Mejor valorados</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
          </select>

          <input
            type="number"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="Precio mínimo"
            className="border border-white/20 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300"
          />

          <input
            type="number"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="Precio máximo"
            className="border border-white/20 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300"
          />

          <label className="flex items-center gap-2 border border-white/20 bg-black/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-200">
            <input
              type="checkbox"
              checked={onSaleOnly}
              onChange={(event) => setOnSaleOnly(event.target.checked)}
              className="h-4 w-4 accent-emerald-400"
            />
            Ofertas activas
          </label>
        </div>

        {viewer?.conjuntoId ? (
          <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.14em] text-zinc-200 fade-up">
            <button
              type="button"
              onClick={() => setScope("my_conjunto")}
              className={`border px-4 py-2 ${
                scope === "my_conjunto"
                  ? "border-emerald-300 bg-emerald-300/10 text-emerald-200"
                  : "border-white/25 hover:border-white/60"
              }`}
            >
              Ver productos de mi conjunto
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`border px-4 py-2 ${
                scope === "all"
                  ? "border-emerald-300 bg-emerald-300/10 text-emerald-200"
                  : "border-white/25 hover:border-white/60"
              }`}
            >
              Ver todos los productos visibles
            </button>
          </div>
        ) : null}

        {hasFilters ? (
          <p className="mt-4 text-sm text-zinc-400">
            Filtros activos. El listado se actualiza automáticamente.
          </p>
        ) : null}

        <div className="mt-10">
          {loadingInitial ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="h-80 animate-pulse border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="border border-white/10 bg-black/25 p-8 text-zinc-300">
              No se encontraron productos con los filtros actuales.
            </div>
          ) : (
            <div className="grid auto-rows-[140px] gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product, index) => (
                <Link
                  key={product.id}
                  href={`/productos/${product.slug}`}
                  className={`group relative overflow-hidden border border-white/10 bg-black/35 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/70 ${tileClass(index)}`}
                >
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">
                      {product.conjunto.name} - {product.category}
                    </p>
                    <h2 className="line-clamp-2 text-xl font-semibold text-white">
                      {product.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-emerald-300">
                        ${product.finalPrice.toFixed(2)}
                      </p>
                      {product.onSale ? (
                        <>
                          <p className="text-sm text-zinc-300 line-through">
                            ${product.price.toFixed(2)}
                          </p>
                          <span className="bg-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-black">
                            -{product.discountPercent}%
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div ref={sentinelRef} className="h-12" />
        {loadingMore ? (
          <p className="text-sm text-zinc-400">Cargando más productos...</p>
        ) : null}
      </section>
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#070b10] text-zinc-100">
          <p className="text-zinc-300">Cargando productos...</p>
        </main>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
