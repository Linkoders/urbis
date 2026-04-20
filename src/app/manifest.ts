import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "URBIS",
    short_name: "URBIS",
    description:
      "Marketplace comunitario para impulsar emprendimientos y comercio local.",
    start_url: "/",
    display: "standalone",
    background_color: "#080b0f",
    theme_color: "#080b0f",
    lang: "es-EC",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/images/urbis-mark.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
    ],
  };
}
