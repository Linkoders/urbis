"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface ReportSummary {
  totalProducts: number;
  publishedProducts: number;
  onSaleProducts: number;
  totalViews: number;
  totalReviews: number;
  averageRating: number;
}

interface TopProduct {
  id: string;
  name: string;
  category: string;
  views: number;
  reviews: number;
  rating: number;
  finalPrice: number;
  onSale: boolean;
}

interface ProductComparison {
  productId: string;
  productName: string;
  category: string;
  views: number;
  rating: number;
  finalPrice: number;
  urbisSimilarCount: number;
  avgUrbisViews: number;
  avgUrbisRating: number;
  avgUrbisPrice: number;
  viewsDeltaVsUrbisPct: number;
  ratingDeltaVsUrbis: number;
  priceDeltaVsUrbisPct: number;
  suggestion: string;
  suggestionSource: "rules" | "gemini";
}

interface ReportsPayload {
  generatedAt: string;
  scope: "mis_productos" | "mi_conjunto" | "plataforma";
  marketSources?: {
    urbis: boolean;
    geminiEnabled: boolean;
  };
  summary: ReportSummary;
  topProducts: TopProduct[];
  comparisons: ProductComparison[];
}

function scopeLabel(scope: ReportsPayload["scope"]): string {
  if (scope === "mis_productos") return "Mis productos";
  if (scope === "mi_conjunto") return "Mi conjunto";
  return "Toda la plataforma";
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReportsPayload | null>(null);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      setError("");

      const response = await fetch("/api/platform/reports", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "No se pudo cargar el reporte.");
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as ReportsPayload;
      setData(payload);
      setLoading(false);
    }

    void loadReport();
  }, []);

  const csvRows = useMemo(() => {
    if (!data) return [];

    const rows = [
      [
        "Producto",
        "Categoría",
        "Vistas",
        "Rating",
        "Precio final",
        "Promedio precio URBIS",
        "Delta precio URBIS (%)",
        "Consejo",
        "Fuente consejo",
      ],
    ];

    for (const item of data.comparisons) {
      rows.push([
        item.productName,
        item.category,
        String(item.views),
        String(item.rating),
        String(item.finalPrice),
        String(item.avgUrbisPrice),
        String(item.priceDeltaVsUrbisPct),
        item.suggestion,
        item.suggestionSource,
      ]);
    }

    return rows;
  }, [data]);

  function downloadCsv() {
    if (csvRows.length === 0) return;
    const csvContent = csvRows
      .map((row) => row.map((cell) => `"${cell.replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reporte-urbis.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] text-zinc-100">
        <p className="text-zinc-300">Cargando reportes...</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-2xl border border-white/10 bg-black/30 p-8">
          <p className="text-red-300">{error || "No autorizado."}</p>
          <Link href="/panel" className="mt-4 inline-block text-emerald-300 hover:text-emerald-200">
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="urbis-watermark min-h-screen bg-[#070b10] px-6 py-10 text-zinc-100 lg:px-12">
      <section className="mx-auto max-w-[1320px] space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Reportes</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
              Rendimiento comercial
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Alcance: {scopeLabel(data.scope)} · Generado: {new Date(data.generatedAt).toLocaleString("es-EC")}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
              Fuentes: URBIS {data.marketSources?.geminiEnabled ? "+ Gemini" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="border border-emerald-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/10"
            >
              Descargar CSV
            </button>
            <Link
              href="/panel"
              className="border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
            >
              Volver
            </Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <article className="border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Productos</p>
            <p className="mt-2 text-3xl font-bold text-white">{data.summary.totalProducts}</p>
          </article>
          <article className="border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Publicados</p>
            <p className="mt-2 text-3xl font-bold text-white">{data.summary.publishedProducts}</p>
          </article>
          <article className="border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">En oferta</p>
            <p className="mt-2 text-3xl font-bold text-white">{data.summary.onSaleProducts}</p>
          </article>
          <article className="border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Vistas</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{data.summary.totalViews.toLocaleString("es-EC")}</p>
          </article>
          <article className="border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Reseñas</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{data.summary.totalReviews.toLocaleString("es-EC")}</p>
          </article>
          <article className="border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Rating promedio</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{data.summary.averageRating}</p>
          </article>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Productos más vistos</h2>
          <div className="overflow-x-auto border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.12em] text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Vistas</th>
                  <th className="px-4 py-3">Reseñas</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Precio final</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-4 py-3 text-zinc-100">{item.name}</td>
                    <td className="px-4 py-3 text-zinc-300">{item.category}</td>
                    <td className="px-4 py-3 text-zinc-300">{item.views}</td>
                    <td className="px-4 py-3 text-zinc-300">{item.reviews}</td>
                    <td className="px-4 py-3 text-zinc-300">{item.rating}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      ${item.finalPrice.toFixed(2)} {item.onSale ? "· oferta" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Comparación contra productos similares en URBIS</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.comparisons.map((item) => (
              <article key={item.productId} className="border border-white/10 bg-black/25 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">{item.category}</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">{item.productName}</h3>
                  </div>
                  <span
                    className={`border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${
                      item.suggestionSource === "gemini"
                        ? "border-cyan-300 text-cyan-200"
                        : "border-zinc-500 text-zinc-300"
                    }`}
                  >
                    {item.suggestionSource === "gemini" ? "Consejo IA" : "Consejo base"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-zinc-300">
                  <p>Vistas: {item.views}</p>
                  <p>Rating: {item.rating}</p>
                  <p>Precio: ${item.finalPrice.toFixed(2)}</p>
                  <p>Similares URBIS: {item.urbisSimilarCount}</p>
                  <p>Promedio vistas URBIS: {item.avgUrbisViews}</p>
                  <p>Promedio precio URBIS: ${item.avgUrbisPrice.toFixed(2)}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em]">
                  <span
                    className={`border px-2 py-1 ${
                      item.viewsDeltaVsUrbisPct >= 0
                        ? "border-emerald-300 text-emerald-200"
                        : "border-red-300 text-red-200"
                    }`}
                  >
                    Vistas vs URBIS {item.viewsDeltaVsUrbisPct >= 0 ? "+" : ""}
                    {item.viewsDeltaVsUrbisPct}%
                  </span>
                  <span
                    className={`border px-2 py-1 ${
                      item.ratingDeltaVsUrbis >= 0
                        ? "border-emerald-300 text-emerald-200"
                        : "border-red-300 text-red-200"
                    }`}
                  >
                    Rating vs URBIS {item.ratingDeltaVsUrbis >= 0 ? "+" : ""}
                    {item.ratingDeltaVsUrbis}
                  </span>
                  <span
                    className={`border px-2 py-1 ${
                      item.priceDeltaVsUrbisPct <= 0
                        ? "border-emerald-300 text-emerald-200"
                        : "border-amber-300 text-amber-200"
                    }`}
                  >
                    Precio vs URBIS {item.priceDeltaVsUrbisPct >= 0 ? "+" : ""}
                    {item.priceDeltaVsUrbisPct}%
                  </span>
                </div>

                <p className="mt-3 text-sm text-zinc-200">{item.suggestion}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
