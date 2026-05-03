import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, readDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

function createProductsCountByEmprendimiento<T extends { emprendimientoId: string }>(
  products: T[],
): Map<string, number> {
  const countMap = new Map<string, number>();
  for (const product of products) {
    countMap.set(
      product.emprendimientoId,
      (countMap.get(product.emprendimientoId) ?? 0) + 1,
    );
  }
  return countMap;
}

function createByConjuntoId<T extends { conjuntoId: string }>(
  emprendimientos: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const emprendimiento of emprendimientos) {
    const bucket = grouped.get(emprendimiento.conjuntoId);
    if (bucket) {
      bucket.push(emprendimiento);
    } else {
      grouped.set(emprendimiento.conjuntoId, [emprendimiento]);
    }
  }
  return grouped;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const db = await readDb();
  const conjuntoId = request.nextUrl.searchParams.get("conjuntoId");
  const emprendimientoId = request.nextUrl.searchParams.get("emprendimientoId");

  const productsCountByEmprendimiento = createProductsCountByEmprendimiento(db.products);
  const emprendimientosByConjunto = createByConjuntoId(db.emprendimientos);

  if (emprendimientoId) {
    const emprendimiento = db.emprendimientos.find((entry) => entry.id === emprendimientoId);
    if (!emprendimiento) {
      return NextResponse.json({ error: "Emprendimiento no encontrado." }, { status: 404 });
    }

    if (
      (user.role === "admin_conjunto" && user.conjuntoId !== emprendimiento.conjuntoId) ||
      (user.role === "resident" && emprendimiento.ownerId !== user.id)
    ) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const products = db.products
      .filter((entry) => entry.emprendimientoId === emprendimiento.id)
      .map((entry) => {
        const specialPrice =
          typeof entry.specialPrice === "number" ? entry.specialPrice : null;
        const onSale = specialPrice !== null && specialPrice < entry.price;

        return {
          id: entry.id,
          slug: entry.slug,
          name: entry.name,
          description: entry.description,
          price: entry.price,
          specialPrice,
          finalPrice: onSale ? specialPrice : entry.price,
          onSale,
          category: entry.category,
          stock: entry.stock,
          image: entry.imageUrls[0] ?? "/images/hero-market.jpg",
          imageUrls: entry.imageUrls,
          imageCount: entry.imageUrls.length,
          status: entry.status,
          viewCount: entry.viewCount,
          ownerId: entry.ownerId,
        };
      });

    const conjunto = db.conjuntos.find((entry) => entry.id === emprendimiento.conjuntoId);

    return NextResponse.json({
      user: {
        id: user.id,
        role: user.role,
        conjuntoId: user.conjuntoId,
      },
      conjunto: conjunto
        ? {
            id: conjunto.id,
            name: conjunto.name,
            slug: conjunto.slug,
            location: conjunto.location,
            mapUrl: conjunto.mapUrl,
            latitude: conjunto.latitude,
            longitude: conjunto.longitude,
            description: conjunto.description,
            logoUrl: conjunto.logoUrl,
            status: conjunto.status,
          }
        : null,
      emprendimiento: {
        id: emprendimiento.id,
        name: emprendimiento.name,
        description: emprendimiento.description,
        logoUrl: emprendimiento.logoUrl,
        visibility: emprendimiento.visibility,
        status: emprendimiento.status,
        ownerId: emprendimiento.ownerId,
        contactEmail: emprendimiento.contactEmail,
        contactPhone: emprendimiento.contactPhone,
      },
      products,
    });
  }

  if (conjuntoId) {
    const conjunto = db.conjuntos.find((entry) => entry.id === conjuntoId);
    if (!conjunto) {
      return NextResponse.json({ error: "Conjunto no encontrado." }, { status: 404 });
    }

    if (
      (user.role === "admin_conjunto" && user.conjuntoId !== conjunto.id) ||
      user.role === "resident"
    ) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const emprendimientos = (emprendimientosByConjunto.get(conjunto.id) ?? []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      logoUrl: entry.logoUrl,
      visibility: entry.visibility,
      status: entry.status,
      ownerId: entry.ownerId,
      contactEmail: entry.contactEmail,
      contactPhone: entry.contactPhone,
      productsCount: productsCountByEmprendimiento.get(entry.id) ?? 0,
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        role: user.role,
        conjuntoId: user.conjuntoId,
      },
      conjunto: {
        id: conjunto.id,
        name: conjunto.name,
        slug: conjunto.slug,
        location: conjunto.location,
        mapUrl: conjunto.mapUrl,
        latitude: conjunto.latitude,
        longitude: conjunto.longitude,
        description: conjunto.description,
        logoUrl: conjunto.logoUrl,
        status: conjunto.status,
      },
      emprendimientos,
    });
  }

  if (user.role === "superadmin") {
    const pendingConjuntoRequests = db.conjuntoRequests
      .filter((entry) => entry.status === "pending")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => ({
        id: entry.id,
        nameRequested: entry.nameRequested,
        location: entry.location,
        mapUrl: entry.mapUrl,
        latitude: entry.latitude,
        longitude: entry.longitude,
        description: entry.description,
        logoUrl: entry.logoUrl,
        contactEmail: entry.contactEmail,
        createdAt: entry.createdAt,
      }));

    const conjuntos = db.conjuntos.map((entry) => {
      const emprendimientos = emprendimientosByConjunto.get(entry.id) ?? [];
      let productsCount = 0;
      for (const emprendimiento of emprendimientos) {
        productsCount += productsCountByEmprendimiento.get(emprendimiento.id) ?? 0;
      }

      return {
        id: entry.id,
        name: entry.name,
        slug: entry.slug,
        location: entry.location,
        mapUrl: entry.mapUrl,
        latitude: entry.latitude,
        longitude: entry.longitude,
        description: entry.description,
        logoUrl: entry.logoUrl,
        status: entry.status,
        emprendimientosCount: emprendimientos.length,
        productsCount,
      };
    });

    return NextResponse.json({
      user: {
        id: user.id,
        role: user.role,
        conjuntoId: user.conjuntoId,
      },
      conjuntos,
      pendingConjuntoRequests,
    });
  }

  if (user.role === "admin_conjunto") {
    const emprendimientos = (emprendimientosByConjunto.get(user.conjuntoId ?? "") ?? []).map(
      (entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        logoUrl: entry.logoUrl,
        visibility: entry.visibility,
        status: entry.status,
        ownerId: entry.ownerId,
        contactEmail: entry.contactEmail,
        contactPhone: entry.contactPhone,
        productsCount: productsCountByEmprendimiento.get(entry.id) ?? 0,
      }),
    );

    return NextResponse.json({
      user: {
        id: user.id,
        role: user.role,
        conjuntoId: user.conjuntoId,
      },
      emprendimientos,
    });
  }

  const emprendimientos = db.emprendimientos
    .filter((entry) => entry.ownerId === user.id)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      logoUrl: entry.logoUrl,
      visibility: entry.visibility,
      status: entry.status,
      ownerId: entry.ownerId,
      contactEmail: entry.contactEmail,
      contactPhone: entry.contactPhone,
      productsCount: productsCountByEmprendimiento.get(entry.id) ?? 0,
    }));

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      conjuntoId: user.conjuntoId,
    },
    emprendimientos,
  });
}
