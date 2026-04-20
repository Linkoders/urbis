import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/productos", "/productos/*", "/terminos-y-condiciones"],
        disallow: [
          "/api/",
          "/panel/",
          "/dashboard/",
          "/emprendimientos/",
          "/auth/login",
          "/auth/register",
        ],
      },
    ],
    sitemap: getAbsoluteUrl("/sitemap.xml"),
    host: getAbsoluteUrl("/"),
  };
}
