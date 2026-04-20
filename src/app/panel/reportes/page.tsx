"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FullScreenSpinner } from "@/components/spinner";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReportsPayload | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;

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

  const exportRows = useMemo(() => {
    if (!data) return [];

    return data.comparisons.map((item) => ({
      productName: item.productName,
      category: item.category,
      views: item.views,
      rating: item.rating,
      finalPrice: item.finalPrice,
      avgUrbisPrice: item.avgUrbisPrice,
      priceDeltaVsUrbisPct: item.priceDeltaVsUrbisPct,
      suggestion: item.suggestion,
      suggestionSource: item.suggestionSource,
    }));
  }, [data]);

  function downloadXls() {
    if (!data || exportRows.length === 0) return;

    const logoSvg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='28' viewBox='0 0 120 28'><rect width='120' height='28' rx='6' fill='%230f172a'/><text x='14' y='19' font-family='Segoe UI,Arial,sans-serif' font-size='13' font-weight='700' fill='%2334d399'>URBIS</text><circle cx='94' cy='14' r='4' fill='%23f59e0b'/><circle cx='106' cy='14' r='4' fill='%2334d399'/></svg>";
    const logoUrl = `data:image/svg+xml,${encodeURIComponent(logoSvg)}`;

    const summaryCards = [
      { label: "Productos", value: data.summary.totalProducts.toLocaleString("es-EC") },
      { label: "Publicados", value: data.summary.publishedProducts.toLocaleString("es-EC") },
      { label: "En oferta", value: data.summary.onSaleProducts.toLocaleString("es-EC") },
      { label: "Vistas", value: data.summary.totalViews.toLocaleString("es-EC") },
      { label: "Reseñas", value: data.summary.totalReviews.toLocaleString("es-EC") },
      { label: "Rating promedio", value: String(data.summary.averageRating) },
    ]
      .map(
        (item) =>
          `<td class="card"><div class="card-label">${escapeHtml(item.label)}</div><div class="card-value">${escapeHtml(item.value)}</div></td>`,
      )
      .join("");

    const topRows = data.topProducts
      .map(
        (item, index) => `<tr class="${index % 2 === 0 ? "even" : "odd"}">
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td class="num">${item.views}</td>
          <td class="num">${item.reviews}</td>
          <td class="num">${item.rating}</td>
          <td class="num">$${item.finalPrice.toFixed(2)}</td>
        </tr>`,
      )
      .join("");

    const comparisonRows = exportRows
      .map(
        (item, index) => `<tr class="${index % 2 === 0 ? "even" : "odd"}">
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td class="num">${item.views}</td>
          <td class="num">${item.rating}</td>
          <td class="num">$${item.finalPrice.toFixed(2)}</td>
          <td class="num">$${item.avgUrbisPrice.toFixed(2)}</td>
          <td class="num">${item.priceDeltaVsUrbisPct}%</td>
          <td class="wrap">${escapeHtml(item.suggestion)}</td>
          <td>${item.suggestionSource === "gemini" ? "Consejo IA" : "Consejo base"}</td>
        </tr>`,
      )
      .join("");

    const generatedAt = new Date(data.generatedAt).toLocaleString("es-EC");
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 0; color: #0f172a; }
    .hero { background: linear-gradient(90deg, #0f172a, #1e293b); color: #ffffff; padding: 18px; }
    .hero h1 { margin: 10px 0 4px 0; font-size: 24px; }
    .hero p { margin: 0; font-size: 12px; color: #cbd5e1; }
    .container { padding: 14px 18px 20px 18px; }
    .section-title { margin: 18px 0 8px 0; font-size: 14px; font-weight: 700; color: #19593f; text-transform: uppercase; letter-spacing: .08em; }
    table { border-collapse: collapse; width: 100%; }
    .cards td.card { border: 1px solid #dbe4ea; background: #f8fafc; padding: 10px; width: 16.66%; }
    .card-label { font-size: 11px; color: #475569; text-transform: uppercase; }
    .card-value { margin-top: 4px; font-size: 18px; font-weight: 700; color: #0f172a; }
    .grid th { background: #19593f; color: #ffffff; border: 1px solid #dbe4ea; padding: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .grid td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; vertical-align: top; }
    .grid tr.even td { background: #ffffff; }
    .grid tr.odd td { background: #f8fafc; }
    .grid td.num { text-align: right; }
    .grid td.wrap { white-space: normal; min-width: 280px; line-height: 1.4; }
    .badge { display: inline-block; background: #ecfdf5; border: 1px solid #34d399; color: #065f46; padding: 2px 8px; border-radius: 999px; font-size: 11px; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="hero">
    <img src="${logoUrl}" alt="URBIS" />
    <h1>Reporte Comercial URBIS</h1>
    <p>Alcance: ${escapeHtml(scopeLabel(data.scope))} | Generado: ${escapeHtml(generatedAt)}</p>
    <span class="badge">Fuentes: URBIS ${data.marketSources?.geminiEnabled ? "+ Gemini" : ""}</span>
  </div>
  <div class="container">
    <div class="section-title">Resumen</div>
    <table class="cards"><tr>${summaryCards}</tr></table>

    <div class="section-title">Productos más vistos</div>
    <table class="grid">
      <thead>
        <tr>
          <th>Producto</th><th>Categoría</th><th>Vistas</th><th>Reseñas</th><th>Rating</th><th>Precio final</th>
        </tr>
      </thead>
      <tbody>${topRows}</tbody>
    </table>

    <div class="section-title">Comparación y recomendaciones</div>
    <table class="grid">
      <thead>
        <tr>
          <th>Producto</th><th>Categoría</th><th>Vistas</th><th>Rating</th><th>Precio final</th>
          <th>Prom. precio URBIS</th><th>Delta precio (%)</th><th>Consejo</th><th>Fuente</th>
        </tr>
      </thead>
      <tbody>${comparisonRows}</tbody>
    </table>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reporte-urbis.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <FullScreenSpinner label="Cargando reportes" />;
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
              onClick={downloadXls}
              className="border border-emerald-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/10"
            >
              Descargar XLS
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
            {data.comparisons.map((item, index) => (
              <article
                key={item.productId}
                className="fade-up border border-white/10 bg-black/25 p-5 transition duration-300 hover:border-emerald-300/40 hover:bg-black/35"
                style={{ animationDelay: `${index * 60}ms` }}
              >
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

                <p className="mt-3 text-sm leading-relaxed text-zinc-200">{item.suggestion}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
