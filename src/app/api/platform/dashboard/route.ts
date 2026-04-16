import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, readDb, toSessionUser } from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const db = await readDb();

  const stats = {
    approvedConjuntos: db.conjuntos.filter((entry) => entry.status === "approved").length,
    pendingConjuntos: db.conjuntoRequests.filter((entry) => entry.status === "pending").length,
    approvedEmprendimientos: db.emprendimientos.filter((entry) => entry.status === "approved")
      .length,
    pendingEmprendimientos: db.emprendimientos.filter((entry) => entry.status === "pending")
      .length,
    publishedProducts: db.products.filter((entry) => entry.status === "published").length,
    reviews: db.reviews.filter((entry) => entry.status === "visible").length,
  };

  if (user.role === "resident") {
    const myEmprendimientos = db.emprendimientos.filter((entry) => entry.ownerId === user.id);
    const myProducts = db.products.filter((entry) => entry.ownerId === user.id);

    return NextResponse.json({
      user: toSessionUser(user),
      stats,
      roleData: {
        myEmprendimientos,
        myProducts,
        approvedConjuntos: db.conjuntos.filter((entry) => entry.status === "approved"),
      },
    });
  }

  if (user.role === "admin_conjunto") {
    const pendingEmprendimientos = db.emprendimientos.filter(
      (entry) => entry.conjuntoId === user.conjuntoId && entry.status === "pending",
    );

    const conjunto = db.conjuntos.find((entry) => entry.id === user.conjuntoId) ?? null;

    return NextResponse.json({
      user: toSessionUser(user),
      stats,
      roleData: {
        conjunto,
        pendingEmprendimientos,
      },
    });
  }

  const pendingConjuntoRequests = db.conjuntoRequests.filter(
    (entry) => entry.status === "pending",
  );

  return NextResponse.json({
    user: toSessionUser(user),
    stats,
    roleData: {
      pendingConjuntoRequests,
      conjuntos: db.conjuntos,
    },
  });
}