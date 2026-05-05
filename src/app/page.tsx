"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface LandingStats {
  conjuntos: number;
  emprendimientos: number;
  productos: number;
  resenas: number;
  visitas: number;
}

interface LandingConjunto {
  id: string;
  name: string;
  slug: string;
  location: string;
  mapUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  logoUrl: string | null;
  emprendimientos: number;
  products: number;
  reviews: number;
  averageRating: number;
}

interface SearchProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  image: string;
  price: number;
  finalPrice: number;
  onSale: boolean;
  discountPercent: number;
}

interface OfferProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  category: string;
  regularPrice: number;
  specialPrice: number;
  discountPercent: number;
  rating: { average: number; total: number };
  viewCount: number;
  conjuntoName: string;
}

const initialStats: LandingStats = {
  conjuntos: 0,
  emprendimientos: 0,
  productos: 0,
  resenas: 0,
  visitas: 0,
};

const benefits = [
  {
    title: "Mayor descubrimiento local",
    description:
      "Tus productos aparecen en un listado filtrable por categoría, precio y popularidad dentro de tu comunidad.",
  },
  {
    title: "Confianza con moderación",
    description:
      "Cada emprendimiento pasa por revisión y aprobación, mejorando la calidad del contenido y la seguridad para vecinos.",
  },
  {
    title: "Control de visibilidad",
    description:
      "Define si tu emprendimiento es solo interno del conjunto o visible al público para escalar alcance.",
  },
  {
    title: "Operación simple",
    description:
      "Paneles simples para publicar, aprobar, pausar y analizar actividad sin depender de procesos manuales.",
  },
];

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://urbis.linekoders.com").replace(/\/$/, "");

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "URBIS",
  url: siteUrl,
  logo: `${siteUrl}/images/urbis-mark.svg`,
  sameAs: ["https://linekoders.com/"],
  description:
    "Proyecto social gratuito de Linekoders para impulsar el comercio local en comunidades.",
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "URBIS",
  url: siteUrl,
  inLanguage: "es-EC",
  publisher: {
    "@type": "Organization",
    name: "Linekoders",
  },
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/productos?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  const rootRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  const [heroQuery, setHeroQuery] = useState("");
  const [heroResults, setHeroResults] = useState<SearchProduct[]>([]);
  const [heroSearching, setHeroSearching] = useState(false);

  const [stats, setStats] = useState<LandingStats>(initialStats);
  const [conjuntos, setConjuntos] = useState<LandingConjunto[]>([]);
  const [offers, setOffers] = useState<OfferProduct[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState<"mejora" | "apoyo">("mejora");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [locationPromptVisible, setLocationPromptVisible] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationReady, setLocationReady] = useState(false);

  useEffect(() => {
    async function loadLandingData() {
      const [statsResponse, offersResponse, meResponse] = await Promise.all([
        fetch("/api/public/landing-stats", { cache: "no-store" }),
        fetch("/api/public/ofertas", { cache: "no-store" }),
        fetch("/api/auth/me", { cache: "no-store" }),
      ]);

      if (statsResponse.ok) {
        const statsData = (await statsResponse.json()) as {
          stats: LandingStats & { resenas?: number };
          conjuntos: LandingConjunto[];
        };

        const incomingStats = statsData.stats ?? initialStats;
        setStats({
          conjuntos: incomingStats.conjuntos ?? 0,
          emprendimientos: incomingStats.emprendimientos ?? 0,
          productos: incomingStats.productos ?? 0,
          resenas: incomingStats.resenas ?? 0,
          visitas: incomingStats.visitas ?? 0,
        });
        setConjuntos((statsData.conjuntos ?? []).slice(0, 6));
      }

      if (offersResponse.ok) {
        const offersData = (await offersResponse.json()) as {
          ofertas: OfferProduct[];
        };

        setOffers(offersData.ofertas ?? []);
      }

      setAuthenticated(meResponse.ok);
    }

    void loadLandingData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedAnswer = window.localStorage.getItem("urbis-location-prompt-answer");
    const storedLatitude = window.localStorage.getItem("urbis-user-latitude");
    const storedLongitude = window.localStorage.getItem("urbis-user-longitude");

    if (storedAnswer === "accepted" && storedLatitude && storedLongitude) {
      setLocationReady(true);
      setLocationPromptVisible(false);
      return;
    }

    if (!storedAnswer) {
      setLocationPromptVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!heroQuery.trim()) {
      return;
    }

    const timeout = setTimeout(async () => {
      setHeroSearching(true);
      const params = new URLSearchParams({
        search: heroQuery,
        sort: "popular",
      });

      const response = await fetch(`/api/catalog?${params.toString()}`, {
        cache: "no-store",
      });

      if (response.ok) {
        const data = (await response.json()) as { products: SearchProduct[] };
        setHeroResults((data.products ?? []).slice(0, 5));
      }

      setHeroSearching(false);
    }, 220);

    return () => clearTimeout(timeout);
  }, [heroQuery]);

  useLayoutEffect(() => {
    if (!rootRef.current) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-hero]",
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.95,
          ease: "power3.out",
          stagger: 0.12,
        },
      );

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: 26 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.82,
            ease: "power2.out",
            scrollTrigger: {
              trigger: element,
              start: "top 88%",
              once: true,
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((element) => {
        gsap.to(element, {
          yPercent: -9,
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-mosaic-card]").forEach((element, index) => {
        gsap.to(element, {
          y: index % 2 === 0 ? -8 : 8,
          x: index % 3 === 0 ? 4 : -4,
          rotation: index % 2 === 0 ? -0.6 : 0.6,
          duration: 4.8 + index * 0.24,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((element) => {
        const target = Number(element.dataset.count ?? "0");
        if (Number.isNaN(target)) {
          return;
        }

        if (element.dataset.countAnimated === String(target)) {
          return;
        }

        element.dataset.countAnimated = String(target);
        element.textContent = "0";
        const counter = { value: 0 };

        gsap.to(counter, {
          value: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            start: "top 88%",
            once: true,
          },
          onUpdate: () => {
            element.textContent = Math.round(counter.value).toLocaleString("es-EC");
          },
          onComplete: () => {
            element.textContent = target.toLocaleString("es-EC");
          },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, [
    stats.conjuntos,
    stats.emprendimientos,
    stats.productos,
    stats.resenas,
    stats.visitas,
    conjuntos,
  ]);

  function submitHeroSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = heroQuery.trim();
    if (!query) {
      router.push("/productos");
      return;
    }

    router.push(`/productos?search=${encodeURIComponent(query)}`);
  }

  function requestPersonalizedLocation() {
    if (typeof window === "undefined") {
      return;
    }

    if (!navigator.geolocation) {
      setLocationError("Tu navegador no permite compartir ubicación.");
      return;
    }

    setLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.localStorage.setItem("urbis-location-prompt-answer", "accepted");
        window.localStorage.setItem("urbis-user-latitude", String(position.coords.latitude));
        window.localStorage.setItem("urbis-user-longitude", String(position.coords.longitude));
        setLocationReady(true);
        setLocationPromptVisible(false);
        setLocating(false);
      },
      () => {
        setLocationError("No se pudo obtener tu ubicación. Puedes seguir explorando sin este permiso.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  function dismissLocationPrompt() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("urbis-location-prompt-answer", "dismissed");
    }
    setLocationPromptVisible(false);
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedbackError("");
    setFeedbackSuccess("");
    setFeedbackLoading(true);

    try {
      const response = await fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: feedbackName,
          email: feedbackEmail,
          message: feedbackMessage,
          category: feedbackCategory,
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setFeedbackError(data.error ?? "No se pudo enviar tu mensaje.");
        return;
      }

      setFeedbackSuccess(data.message ?? "Mensaje enviado.");
      setFeedbackMessage("");
    } catch {
      setFeedbackError("No se pudo enviar tu mensaje.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <>
      <Script
        id="urbis-organization-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="urbis-website-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      {locationPromptVisible ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/72 px-6 backdrop-blur-sm">
          <div className="w-full max-w-xl border border-emerald-300/20 bg-[#0b1118] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Experiencia más personalizada
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold text-white sm:text-4xl">
              Comparte tu ubicación para ver lo más cercano.
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              URBIS puede priorizar productos, ofertas y comunidades cercanas a ti.
              Primero te lo pedimos aquí y luego tu navegador confirmará el permiso.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={requestPersonalizedLocation}
                disabled={locating}
                className="bg-emerald-300 px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-black disabled:opacity-60"
              >
                {locating ? "Activando ubicación..." : "Sí, compartir ubicación"}
              </button>
              <button
                type="button"
                onClick={dismissLocationPrompt}
                className="border border-white/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-zinc-200 transition hover:border-white/60"
              >
                Continuar sin ubicación
              </button>
            </div>
            {locationError ? (
              <p className="mt-4 text-sm text-amber-300">{locationError}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <main ref={rootRef} className="bg-[#080b0f] text-zinc-100">
      <section className="mx-auto grid min-h-screen max-w-[1320px] grid-cols-1 gap-12 px-6 pb-16 pt-32 lg:grid-cols-[1.02fr_1fr] lg:px-12">
        <div className="flex flex-col justify-center" data-hero>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Marketplace comunitario
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-6xl leading-[0.93] font-semibold tracking-tight text-white sm:text-7xl lg:text-[6.3rem]">
            Busca y compra en tu comunidad.
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-zinc-300">
            Escribe el nombre del producto, categoría o emprendimiento para
            encontrar opciones locales al instante.
          </p>

          {locationReady ? (
            <div className="mt-8 max-w-xl border border-cyan-300/25 bg-cyan-300/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                Ubicación activada
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-200">
                Ya podemos priorizar productos y comunidades cercanas para ti.
              </p>
            </div>
          ) : null}

          <form onSubmit={submitHeroSearch} className="mt-8 max-w-xl">
            <div className="flex gap-2 border border-white/20 bg-black/35 p-2">
              <input
                suppressHydrationWarning
                value={heroQuery}
                onChange={(event) => setHeroQuery(event.target.value)}
                placeholder="Buscar: canasta, huerto, panadería..."
                className="w-full bg-transparent px-3 py-3 text-sm text-white outline-none"
              />
              <button
                suppressHydrationWarning
                type="submit"
                className="bg-zinc-100 px-5 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-white"
              >
                Buscar
              </button>
            </div>

            {heroQuery ? (
              <div className="mt-2 border border-white/15 bg-black/65">
                {heroSearching ? (
                  <p className="px-4 py-3 text-sm text-zinc-400">Buscando productos...</p>
                ) : heroResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-zinc-400">Sin coincidencias.</p>
                ) : (
                  heroResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => router.push(`/productos/${product.slug}`)}
                      className="flex w-full items-center justify-between border-t border-white/10 px-4 py-3 text-left text-sm hover:bg-white/5 first:border-t-0"
                    >
                      <span className="text-zinc-200">{product.name}</span>
                      <span className="text-emerald-300">
                        ${product.finalPrice.toFixed(2)}
                        {product.onSale ? ` (-${product.discountPercent}%)` : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </form>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/productos"
              className="bg-zinc-100 px-7 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black transition hover:bg-white"
            >
              Explorar productos
            </Link>
            {authenticated ? (
              <Link
                href="/panel"
                className="border border-zinc-500 px-7 py-4 text-sm font-bold uppercase tracking-[0.14em] transition hover:border-zinc-200"
              >
                Gestionar emprendimientos
              </Link>
            ) : (
              <Link
                href="/auth/register"
                className="border border-zinc-500 px-7 py-4 text-sm font-bold uppercase tracking-[0.14em] transition hover:border-zinc-200"
              >
                Crear cuenta
              </Link>
            )}
          </div>
        </div>

        <div className="relative flex items-center justify-center" data-hero>
          <div className="relative w-full overflow-hidden border border-white/20 bg-white/5 p-4 lg:p-6 hover-lift">
            <Image
              src="/images/hero-market.jpg"
              alt="Mercado local en comunidad"
              width={1400}
              height={1000}
              className="h-[500px] w-full object-cover lg:h-[610px]"
              priority
              data-parallax
            />
          </div>
          <div className="absolute -left-5 -top-6 hidden w-44 overflow-hidden border border-white/20 bg-black/70 p-2 md:block lg:w-56">
            <Image
              src="/images/owner-1.jpg"
              alt="Emprendedor local"
              width={500}
              height={700}
              className="h-60 w-full object-cover lg:h-72"
              data-parallax
            />
          </div>
          <div className="absolute -bottom-8 -right-5 w-44 overflow-hidden border border-white/20 bg-black/70 p-2 md:w-56 lg:w-64">
            <Image
              src="/images/owner-2.jpg"
              alt="Comercio barrial"
              width={500}
              height={700}
              className="h-64 w-full object-cover lg:h-80"
              data-parallax
            />
          </div>
        </div>
      </section>

      {!authenticated ? (
        <section className="bg-[#0b1118] px-6 py-24 lg:px-12">
          <div className="mx-auto max-w-[1320px]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300" data-reveal>
              Qué es URBIS
            </p>
            <h2
              className="mt-3 max-w-5xl font-[family-name:var(--font-display)] text-5xl leading-tight font-semibold text-white sm:text-6xl"
              data-reveal
            >
              Una forma simple de comprar y vender entre vecinos.
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-300" data-reveal>
              URBIS ayuda a que los productos de tu urbanización se vean mejor,
              lleguen a más personas y generen confianza entre quienes viven cerca.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <article className="border border-white/10 bg-black/35 p-6" data-reveal>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Beneficio 01</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Compra más cerca</h3>
                <p className="mt-3 text-zinc-300">
                  Encuentra productos útiles de personas que viven en tu misma zona.
                </p>
              </article>
              <article className="border border-white/10 bg-black/35 p-6" data-reveal>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Beneficio 02</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Más confianza al elegir</h3>
                <p className="mt-3 text-zinc-300">
                  Revisa fotos, precios, opiniones y contacto para decidir mejor.
                </p>
              </article>
              <article className="border border-white/10 bg-black/35 p-6" data-reveal>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Beneficio 03</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Haz crecer tu emprendimiento</h3>
                <p className="mt-3 text-zinc-300">
                  Publica tus productos y elige si quieres vender solo dentro de tu comunidad o también al público.
                </p>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="beneficios"
        className="bg-zinc-100 px-6 py-24 text-[#0a0f14] lg:px-12"
      >
        <div className="mx-auto max-w-[1320px]">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2d6b4d]"
            data-reveal
          >
            Cómo aprovechas URBIS
          </p>
          <h2
            className="mt-3 max-w-4xl font-[family-name:var(--font-display)] text-5xl leading-tight font-semibold sm:text-6xl"
            data-reveal
          >
            Beneficios claros para vecinos, familias y pequeños negocios.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <article
                key={benefit.title}
                className="border border-zinc-300 bg-white p-5 transition hover:-translate-y-1 hover:shadow-xl"
                data-reveal
              >
                <h3 className="text-2xl font-semibold">{benefit.title}</h3>
                <p className="mt-3 text-zinc-700">{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ecosistema" className="grid grid-cols-1 bg-[#03070b] lg:grid-cols-2">
        <div className="flex items-center px-6 py-20 lg:px-14" data-reveal>
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Ecosistema en crecimiento
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-tight font-semibold text-white sm:text-6xl">
              Comunidades que ya comercian dentro de URBIS.
            </h3>
            <p className="mt-6 text-lg leading-relaxed text-zinc-300">
              Monitorea productos, reseñas y visitas para entender qué conjuntos
              están acelerando su economía local.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="border border-white/20 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Conjuntos</p>
                <p
                  data-count={stats.conjuntos}
                  className="mt-2 text-3xl font-bold text-emerald-300"
                >
                  {stats.conjuntos}
                </p>
              </div>
              <div className="border border-white/20 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Emprendimientos</p>
                <p
                  data-count={stats.emprendimientos}
                  className="mt-2 text-3xl font-bold text-emerald-300"
                >
                  {stats.emprendimientos}
                </p>
              </div>
              <div className="border border-white/20 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Productos</p>
                <p
                  data-count={stats.productos}
                  className="mt-2 text-3xl font-bold text-emerald-300"
                >
                  {stats.productos}
                </p>
              </div>
              <div className="border border-white/20 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Visitas</p>
                <p
                  data-count={stats.visitas}
                  className="mt-2 text-3xl font-bold text-emerald-300"
                >
                  {stats.visitas}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[#060b12] px-6 py-20 lg:px-10" data-reveal>
          <div className="grid grid-cols-2 gap-4">
            {conjuntos.length === 0
              ? Array.from({ length: 6 }).map((_, index) => (
                  <article
                    key={index}
                    className="border border-white/15 bg-white/5 p-4"
                    data-mosaic-card
                  >
                    <div className="h-12 w-12 rounded-full border border-white/20 bg-white/10" />
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Comunidad</p>
                    <p className="mt-2 text-lg font-semibold text-white">Nuevo conjunto</p>
                  </article>
                ))
              : conjuntos.map((conjunto) => (
                  <Link
                    key={conjunto.id}
                    href={`/productos?conjunto=${encodeURIComponent(conjunto.slug)}`}
                    className="border border-white/15 bg-white/5 p-4"
                    data-mosaic-card
                  >
                    <div
                      className="h-12 w-12 rounded-full border border-white/20 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${conjunto.logoUrl ?? "/images/owner-1.jpg"})`,
                      }}
                    />
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{conjunto.location}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{conjunto.name}</p>
                    <p className="mt-2 text-sm text-zinc-300">
                      <span data-count={conjunto.products}>{conjunto.products}</span> productos
                    </p>
                    <p className="text-sm text-zinc-400">
                      <span data-count={conjunto.reviews}>{conjunto.reviews}</span> reseñas
                    </p>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      <section
        id="ofertas"
        className="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-100 px-6 py-24 text-[#2a1404] lg:px-12"
      >
        <div className="mx-auto max-w-[1320px]" data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a3412]">
            Productos en oferta
          </p>
          <h3 className="mt-3 max-w-4xl font-[family-name:var(--font-display)] text-5xl leading-tight font-semibold sm:text-6xl">
            Productos con precio especial hoy.
          </h3>
          <Link
            href="/productos?onSale=1"
            className="mt-6 inline-block border border-[#9a3412] px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#9a3412] hover:bg-[#9a3412] hover:text-white"
          >
            Ver más
          </Link>
        </div>

        <div className="mx-auto mt-10 grid max-w-[1320px] gap-6 md:grid-cols-2 lg:grid-cols-4">
          {offers.length === 0 ? (
            <article className="border border-zinc-300 bg-white p-6" data-reveal>
              <h4 className="text-2xl font-semibold">Aún sin ofertas activas</h4>
              <p className="mt-3 text-zinc-700">Publica productos con precio especial desde gestionar emprendimientos.</p>
            </article>
          ) : (
            offers.map((offer) => (
              <Link
                key={offer.id}
                href={`/productos/${offer.slug}`}
                className="overflow-hidden border border-amber-300/70 bg-white/90 transition hover:-translate-y-1 hover:shadow-xl"
                data-reveal
              >
                <div className="relative h-52">
                  <Image
                    src={offer.image}
                    alt={offer.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    className="object-cover"
                  />
                  <div className="absolute left-3 top-3 bg-[#f59e0b] px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-black">
                    -{offer.discountPercent}%
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">{offer.category}</p>
                  <h4 className="text-xl font-semibold">{offer.name}</h4>
                  <p className="line-clamp-2 text-sm text-zinc-700">{offer.description}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-[#19593f]">${offer.specialPrice.toFixed(2)}</p>
                    <p className="text-sm text-zinc-500 line-through">${offer.regularPrice.toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {offer.conjuntoName} - {offer.viewCount} vistas - {offer.rating.average}/5
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section id="solicitud" className="bg-zinc-100 px-6 py-28 text-[#0a0f14] lg:px-12">
        <div className="mx-auto max-w-[1080px] border border-zinc-300/80 bg-white p-10 text-center shadow-[0_20px_50px_rgba(11,22,53,0.07)] sm:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2d6b4d]" data-reveal>
            Únete a URBIS
          </p>
          <h3
            className="mt-4 font-[family-name:var(--font-display)] text-5xl font-semibold leading-tight sm:text-6xl"
            data-reveal
          >
            ¿Quieres registrarte?
          </h3>
          <p className="mx-auto mt-7 max-w-3xl text-xl leading-relaxed text-zinc-700" data-reveal>
              Crea tu cuenta como residente o como encargado de un conjunto.
            Desde ahí podrás cargar los datos de tu comunidad, subir tu logo y
            publicar tus productos con fotos reales desde tus archivos.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4" data-reveal>
            <Link
              href="/auth/register"
              className="bg-[#0b1635] px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#15285a]"
            >
              Ir a crear cuenta
            </Link>
            <Link
              href="/auth/login"
              className="border border-zinc-400 px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-[#0b1635] transition hover:border-[#0b1635]"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      <section id="linekoders" className="bg-black px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-[1320px] text-center" data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Iniciativa social
          </p>
          <h3 className="mx-auto mt-3 max-w-5xl font-[family-name:var(--font-display)] text-5xl leading-tight font-semibold text-white sm:text-6xl">
            URBIS es una iniciativa de Linekoders para activar economías locales.
          </h3>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-zinc-300">
            Proyecto orientado a comunidades, emprendedores y líderes de conjunto
            que necesitan una plataforma práctica para vender con confianza.
          </p>
          <p className="mx-auto mt-3 max-w-3xl text-sm uppercase tracking-[0.14em] text-emerald-300">
            Proyecto social gratuito para comunidades.
          </p>
          <a
            href="https://linekoders.com/"
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-block border border-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white hover:text-black"
          >
            Conocer Linekoders
          </a>
        </div>
      </section>

      <section id="apoyo" className="bg-zinc-100 px-6 py-24 text-[#0a0f14] lg:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-12 lg:items-start lg:grid-cols-[1fr_1.05fr]">
          <div data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2d6b4d]">
              Apoya URBIS
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-tight font-semibold sm:text-6xl">
              Si quieres apoyar, toda ayuda cuenta.
            </h3>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-700">
              URBIS es un proyecto social gratuito. No necesitas donar dinero para aportar:
              también ayudan la difusión, las recomendaciones, la colaboración técnica o
              la creación de alianzas con comunidades.
            </p>
            <Link
              href="/donar"
              className="mt-6 inline-flex items-center justify-center rounded-sm bg-[#0b1635] px-8 py-4 text-sm font-extrabold uppercase tracking-[0.16em] text-white shadow-[0_18px_40px_rgba(11,22,53,0.35)] transition hover:-translate-y-0.5 hover:bg-[#15285a] hover:shadow-[0_22px_56px_rgba(11,22,53,0.45)]"
            >
              Quiero donar al proyecto
            </Link>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <article className="border border-zinc-300 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Difusión</p>
                <p className="mt-2 text-zinc-700">Comparte URBIS en redes y grupos de comunidad.</p>
              </article>
              <article className="border border-zinc-300 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Recomendaciones</p>
                <p className="mt-2 text-zinc-700">Invita a vecinos y administraciones a usar la plataforma.</p>
              </article>
              <article className="border border-zinc-300 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Colaboración</p>
                <p className="mt-2 text-zinc-700">Apoya con ideas, diseño, tecnología o alianzas locales.</p>
              </article>
              <article className="border border-zinc-300 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Donación voluntaria</p>
                <p className="mt-2 text-zinc-700">Si deseas aportar económicamente, también es bienvenida.</p>
              </article>
            </div>
          </div>

          <div className="border border-zinc-300 bg-white p-6 shadow-[0_20px_50px_rgba(11,22,53,0.07)]" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2d6b4d]">
              Comentarios de mejora
            </p>
            <h4 className="mt-2 text-3xl font-semibold">¿Qué podemos mejorar en URBIS?</h4>
            <p className="mt-3 text-zinc-700">
              Envíanos ideas, sugerencias o propuestas de apoyo. Leemos cada mensaje.
            </p>

            <form onSubmit={submitFeedback} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  suppressHydrationWarning
                  value={feedbackName}
                  onChange={(event) => setFeedbackName(event.target.value)}
                  placeholder="Tu nombre"
                  className="w-full border border-zinc-300 px-4 py-3 outline-none transition focus:border-[#2d6b4d]"
                  required
                />
                <input
                  type="email"
                  suppressHydrationWarning
                  value={feedbackEmail}
                  onChange={(event) => setFeedbackEmail(event.target.value)}
                  placeholder="Tu email"
                  className="w-full border border-zinc-300 px-4 py-3 outline-none transition focus:border-[#2d6b4d]"
                  required
                />
              </div>

              <select
                suppressHydrationWarning
                value={feedbackCategory}
                onChange={(event) => setFeedbackCategory(event.target.value === "apoyo" ? "apoyo" : "mejora")}
                className="w-full border border-zinc-300 px-4 py-3 outline-none transition focus:border-[#2d6b4d]"
              >
                <option value="mejora">Quiero sugerir una mejora</option>
                <option value="apoyo">Quiero apoyar el proyecto</option>
              </select>

              <textarea
                suppressHydrationWarning
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                placeholder="Escribe tu idea o propuesta..."
                rows={5}
                className="w-full border border-zinc-300 px-4 py-3 outline-none transition focus:border-[#2d6b4d]"
                required
              />

              {feedbackError ? <p className="text-sm text-red-600">{feedbackError}</p> : null}
              {feedbackSuccess ? <p className="text-sm text-emerald-700">{feedbackSuccess}</p> : null}

              <button
                type="submit"
                suppressHydrationWarning
                disabled={feedbackLoading}
                className="w-full bg-[#0b1635] px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#15285a] disabled:opacity-70"
              >
                {feedbackLoading ? "Enviando..." : "Enviar comentario"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#04070b] px-6 py-14 text-zinc-300 lg:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h4 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-white">
              URBIS
            </h4>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Marketplace comunitario para comercio local en urbanizaciones y
              conjuntos residenciales.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Producto
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/productos" className="hover:text-white">
                  Productos
                </Link>
              </li>
              <li>
                <Link href="/panel" className="hover:text-white">
                  Gestionar emprendimientos
                </Link>
              </li>
              <li>
                <Link href="/terminos-y-condiciones" className="hover:text-white">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-white">
                  Registro
                </Link>
              </li>
              <li>
                <Link href="#apoyo" className="hover:text-white">
                  Apoyar URBIS
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Datos
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>Conjuntos registrados: {stats.conjuntos}</li>
              <li>Productos activos: {stats.productos}</li>
              <li>Reseñas públicas: {stats.resenas}</li>
              <li>Visitas acumuladas: {stats.visitas}</li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Organización
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="https://linekoders.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white"
                >
                  Linekoders
                </a>
              </li>
              <li>Quito - Ecuador</li>
              <li>hello@linekoders.com</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-[1320px] border-t border-white/10 pt-6 text-xs uppercase tracking-[0.14em] text-zinc-500">
          URBIS - Iniciativa social gratuita de Linekoders
        </div>
      </footer>
      </main>
    </>
  );
}


