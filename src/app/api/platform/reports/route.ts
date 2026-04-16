import { NextRequest, NextResponse } from "next/server";
import { computeRating, getSessionUser, readDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || "";

type SuggestionSource = "rules" | "gemini";

interface ReportProduct {
  id: string;
  name: string;
  category: string;
  views: number;
  reviews: number;
  rating: number;
  price: number;
  finalPrice: number;
  onSale: boolean;
  status: string;
}

interface ComparableProduct {
  id: string;
  category: string;
  views: number;
  rating: number;
  price: number;
  conjuntoId: string;
}

interface DraftComparison {
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
  suggestionSource: SuggestionSource;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((acc, value) => acc + value, 0);
  return Number((total / values.length).toFixed(2));
}

function toPercentDelta(base: number, current: number): number {
  if (base <= 0) return 0;
  return Number((((current - base) / base) * 100).toFixed(1));
}

async function buildGeminiSuggestions(drafts: DraftComparison[]): Promise<Map<string, string>> {
  if (!GEMINI_API_KEY || drafts.length === 0) {
    return new Map();
  }

  const input = drafts.slice(0, 14).map((entry) => ({
    productId: entry.productId,
    productName: entry.productName,
    category: entry.category,
    views: entry.views,
    rating: entry.rating,
    finalPrice: entry.finalPrice,
    urbisSimilarCount: entry.urbisSimilarCount,
    avgUrbisViews: entry.avgUrbisViews,
    avgUrbisRating: entry.avgUrbisRating,
    avgUrbisPrice: entry.avgUrbisPrice,
    viewsDeltaVsUrbisPct: entry.viewsDeltaVsUrbisPct,
    ratingDeltaVsUrbis: entry.ratingDeltaVsUrbis,
    priceDeltaVsUrbisPct: entry.priceDeltaVsUrbisPct,
    baseSuggestion: entry.suggestion,
  }));

  const prompt = [
    "Eres asesor comercial senior para pequeños emprendimientos locales.",
    "Analiza cada producto con enfoque en conversión, precio y reputación.",
    "Devuelve SOLO JSON válido como array.",
    "Cada elemento debe tener: productId y suggestion.",
    "suggestion debe estar en español, máximo 220 caracteres.",
    "La sugerencia debe incluir: 1 acción concreta + 1 razón basada en datos + 1 meta de corto plazo.",
    "No uses texto genérico. No repitas frases entre productos.",
    "No incluyas markdown, cabeceras ni explicaciones fuera del JSON.",
    `Datos: ${JSON.stringify(input)}`,
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        GEMINI_API_KEY,
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.05,
            topP: 0.4,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      return new Map();
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!rawText) {
      return new Map();
    }

    const cleanText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanText) as
      | Array<{ productId?: string; suggestion?: string }>
      | { suggestions?: Array<{ productId?: string; suggestion?: string }> };

    const items = Array.isArray(parsed) ? parsed : parsed.suggestions ?? [];
    const map = new Map<string, string>();

    for (const item of items) {
      const productId = String(item.productId ?? "").trim();
      const suggestion = String(item.suggestion ?? "").trim();
      if (!productId || !suggestion) continue;
      map.set(productId, suggestion.slice(0, 220));
    }

    return map;
  } catch {
    return new Map();
  }
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const db = await readDb();
  const emprendimientoById = new Map(db.emprendimientos.map((entry) => [entry.id, entry]));
  const conjuntoById = new Map(db.conjuntos.map((entry) => [entry.id, entry]));

  const comparablePool: ComparableProduct[] = db.products.flatMap((product) => {
    const emprendimiento = emprendimientoById.get(product.emprendimientoId);
    if (!emprendimiento || product.status !== "published") return [];

    const conjunto = conjuntoById.get(emprendimiento.conjuntoId);
    if (!conjunto || conjunto.status !== "approved" || emprendimiento.status !== "approved") return [];

    const rating = computeRating(product.id, db);

    return [
      {
        id: product.id,
        category: product.category,
        views: product.viewCount,
        rating: rating.average,
        price: product.specialPrice && product.specialPrice > 0 ? product.specialPrice : product.price,
        conjuntoId: emprendimiento.conjuntoId,
      },
    ];
  });

  const zoneConjuntoId = user.conjuntoId;
  const zonePool = zoneConjuntoId
    ? comparablePool.filter((entry) => entry.conjuntoId === zoneConjuntoId)
    : comparablePool;

  const scopedProducts = db.products.filter((product) => {
    const emprendimiento = emprendimientoById.get(product.emprendimientoId);
    if (!emprendimiento) return false;

    if (user.role === "resident") {
      return product.ownerId === user.id;
    }

    if (user.role === "admin_conjunto") {
      return emprendimiento.conjuntoId === user.conjuntoId;
    }

    return true;
  });

  const reportProducts: ReportProduct[] = scopedProducts.map((product) => {
    const rating = computeRating(product.id, db);
    const specialPrice =
      typeof product.specialPrice === "number" && product.specialPrice < product.price
        ? product.specialPrice
        : null;
    const finalPrice = specialPrice ?? product.price;

    return {
      id: product.id,
      name: product.name,
      category: product.category,
      views: product.viewCount,
      reviews: rating.total,
      rating: rating.average,
      price: product.price,
      finalPrice,
      onSale: specialPrice !== null,
      status: product.status,
    };
  });

  const totalViews = reportProducts.reduce((acc, entry) => acc + entry.views, 0);
  const totalReviews = reportProducts.reduce((acc, entry) => acc + entry.reviews, 0);
  const weightedRatingBase = reportProducts.reduce((acc, entry) => acc + entry.rating * entry.reviews, 0);
  const averageRating = totalReviews > 0 ? Number((weightedRatingBase / totalReviews).toFixed(2)) : 0;

  const draftComparisons: DraftComparison[] = reportProducts
    .filter((entry) => entry.views > 0 || entry.reviews > 0)
    .slice(0, 18)
    .map((entry) => {
      const urbisSimilarLocal = zonePool.filter(
        (poolEntry) => poolEntry.id !== entry.id && poolEntry.category === entry.category,
      );
      const urbisSimilarGlobal = comparablePool.filter(
        (poolEntry) => poolEntry.id !== entry.id && poolEntry.category === entry.category,
      );
      const urbisComparable = urbisSimilarLocal.length > 0 ? urbisSimilarLocal : urbisSimilarGlobal;

      const avgUrbisViews = avg(urbisComparable.map((item) => item.views));
      const avgUrbisRating = avg(urbisComparable.map((item) => item.rating));
      const avgUrbisPrice = avg(urbisComparable.map((item) => item.price));

      const viewsDeltaVsUrbisPct = toPercentDelta(avgUrbisViews, entry.views);
      const ratingDeltaVsUrbis = Number((entry.rating - avgUrbisRating).toFixed(2));
      const priceDeltaVsUrbisPct = toPercentDelta(avgUrbisPrice, entry.finalPrice);

      let suggestion = "Mantén constancia en publicaciones, fotos claras y respuesta rápida a mensajes.";
      if (urbisComparable.length > 0 && entry.views < avgUrbisViews) {
        suggestion = "Mejora portada y título para aumentar clics frente a productos similares en URBIS.";
      } else if (urbisComparable.length > 0 && entry.rating < avgUrbisRating) {
        suggestion = "Refuerza calidad y seguimiento posventa para subir reseñas y reputación.";
      } else if (urbisComparable.length > 0 && entry.finalPrice > avgUrbisPrice * 1.12) {
        suggestion = "Tu precio está alto frente a productos similares: ajusta precio o agrega más valor.";
      } else if (!entry.onSale) {
        suggestion = "Activa una oferta temporal de 48 horas para mejorar tracción y visibilidad.";
      }

      return {
        productId: entry.id,
        productName: entry.name,
        category: entry.category,
        views: entry.views,
        rating: entry.rating,
        finalPrice: entry.finalPrice,
        urbisSimilarCount: urbisComparable.length,
        avgUrbisViews,
        avgUrbisRating,
        avgUrbisPrice,
        viewsDeltaVsUrbisPct,
        ratingDeltaVsUrbis,
        priceDeltaVsUrbisPct,
        suggestion,
        suggestionSource: "rules",
      };
    });

  const geminiSuggestions = await buildGeminiSuggestions(draftComparisons);
  const comparisons = draftComparisons.map((entry) => {
    const aiSuggestion = geminiSuggestions.get(entry.productId);
    if (!aiSuggestion) {
      return entry;
    }

    return {
      ...entry,
      suggestion: aiSuggestion,
      suggestionSource: "gemini" as const,
    };
  });

  const topProducts = [...reportProducts].sort((a, b) => b.views - a.views).slice(0, 10);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    scope: user.role === "resident" ? "mis_productos" : user.role === "admin_conjunto" ? "mi_conjunto" : "plataforma",
    marketSources: {
      urbis: true,
      geminiEnabled: Boolean(GEMINI_API_KEY),
    },
    summary: {
      totalProducts: reportProducts.length,
      publishedProducts: scopedProducts.filter((entry) => entry.status === "published").length,
      onSaleProducts: reportProducts.filter((entry) => entry.onSale).length,
      totalViews,
      totalReviews,
      averageRating,
    },
    topProducts,
    comparisons,
  });
}
