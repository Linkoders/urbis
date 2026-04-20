import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "@/lib/seo";
import { canViewProduct, readDb } from "@/lib/urbis-store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: getAbsoluteUrl("/productos"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl("/terminos-y-condiciones"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  try {
    const db = await readDb();
    const emprendimientosById = new Map(db.emprendimientos.map((item) => [item.id, item]));
    const conjuntosById = new Map(db.conjuntos.map((item) => [item.id, item]));

    const publicProducts = db.products
      .map<MetadataRoute.Sitemap[number] | null>((product) => {
        const emprendimiento = emprendimientosById.get(product.emprendimientoId);
        if (!emprendimiento) {
          return null;
        }

        const conjunto = conjuntosById.get(emprendimiento.conjuntoId);
        if (!conjunto) {
          return null;
        }

        if (!canViewProduct(product, emprendimiento, conjunto, null)) {
          return null;
        }

        return {
          url: getAbsoluteUrl(`/productos/${product.slug}`),
          lastModified: new Date(product.updatedAt || product.createdAt || now),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        };
      })
      .filter((entry) => entry !== null);

    return [...routes, ...publicProducts];
  } catch {
    return routes;
  }
}
