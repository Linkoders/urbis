import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl } from "@/lib/seo";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "URBIS | Comercio local en tu comunidad",
    template: "%s | URBIS",
  },
  description:
    "Marketplace comunitario para descubrir productos locales, apoyar emprendimientos barriales y fortalecer la economía de urbanizaciones y conjuntos residenciales.",
  applicationName: "URBIS",
  keywords: [
    "urbis",
    "comercio local",
    "marketplace comunitario",
    "emprendimientos",
    "urbanizaciones",
    "linekoders",
    "productos locales",
    "economía barrial",
  ],
  authors: [{ name: "Linekoders", url: "https://linekoders.com/" }],
  creator: "Linekoders",
  publisher: "Linekoders",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: siteUrl,
    siteName: "URBIS",
    title: "URBIS | Comercio local en tu comunidad",
    description:
      "Plataforma social gratuita para conectar vecinos con productos y emprendimientos de su conjunto.",
    images: [
      {
        url: "/images/hero-market.jpg",
        width: 1400,
        height: 1000,
        alt: "Marketplace comunitario URBIS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "URBIS | Comercio local en tu comunidad",
    description:
      "Proyecto social de Linekoders para impulsar economías locales en urbanizaciones y comunidades.",
    images: ["/images/hero-market.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "marketplace",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080b0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} ${sora.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SiteHeader />
        <div className="pt-20">{children}</div>
      </body>
    </html>
  );
}
