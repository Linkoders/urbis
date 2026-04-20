import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Productos locales",
  description:
    "Explora productos de emprendimientos comunitarios, con ofertas activas y reseñas reales.",
  alternates: {
    canonical: "/productos",
  },
  openGraph: {
    title: "Productos locales | URBIS",
    description:
      "Catálogo de productos comunitarios con filtros por categoría, conjunto y ofertas.",
    url: "/productos",
    images: ["/images/hero-market.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Productos locales | URBIS",
    description:
      "Catálogo comunitario con productos en oferta, reseñas y contacto directo con emprendedores.",
    images: ["/images/hero-market.jpg"],
  },
};

export default function ProductosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
