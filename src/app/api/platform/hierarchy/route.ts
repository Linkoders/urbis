import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, readDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const db = await readDb();
  const conjuntoId = request.nextUrl.searchParams.get("conjuntoId");
  const emprendimientoId = request.nextUrl.searchParams.get("emprendimientoId");

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

    const emprendimientos = db.emprendimientos
      .filter((entry) => entry.conjuntoId === conjunto.id)
      .map((entry) => {
        const productsCount = db.products.filter(
          (product) => product.emprendimientoId === entry.id,
        ).length;

        return {
          id: entry.id,
          name: entry.name,
          description: entry.description,
          logoUrl: entry.logoUrl,
          visibility: entry.visibility,
          status: entry.status,
          ownerId: entry.ownerId,
          contactEmail: entry.contactEmail,
          contactPhone: entry.contactPhone,
          productsCount,
        };
      });

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
        description: conjunto.description,
        logoUrl: conjunto.logoUrl,
        status: conjunto.status,
      },
      emprendimientos,
    });
  }

  if (user.role === "superadmin") {
    const conjuntos = db.conjuntos.map((entry) => {
      const emprendimientos = db.emprendimientos.filter(
        (emprendimiento) => emprendimiento.conjuntoId === entry.id,
      );
      const emprendimientoIds = new Set(emprendimientos.map((emprendimiento) => emprendimiento.id));
      const productsCount = db.products.filter((product) =>
        emprendimientoIds.has(product.emprendimientoId),
      ).length;

      return {
        id: entry.id,
        name: entry.name,
        slug: entry.slug,
        location: entry.location,
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
    });
  }

  if (user.role === "admin_conjunto") {
    const emprendimientos = db.emprendimientos
      .filter((entry) => entry.conjuntoId === user.conjuntoId)
      .map((entry) => {
        const productsCount = db.products.filter(
          (product) => product.emprendimientoId === entry.id,
        ).length;

        return {
          id: entry.id,
          name: entry.name,
          description: entry.description,
          logoUrl: entry.logoUrl,
          visibility: entry.visibility,
          status: entry.status,
          ownerId: entry.ownerId,
          contactEmail: entry.contactEmail,
          contactPhone: entry.contactPhone,
          productsCount,
        };
      });

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
    .map((entry) => {
      const productsCount = db.products.filter(
        (product) => product.emprendimientoId === entry.id,
      ).length;

      return {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        logoUrl: entry.logoUrl,
        visibility: entry.visibility,
        status: entry.status,
        ownerId: entry.ownerId,
        contactEmail: entry.contactEmail,
        contactPhone: entry.contactPhone,
        productsCount,
      };
    });

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      conjuntoId: user.conjuntoId,
    },
    emprendimientos,
  });
}
