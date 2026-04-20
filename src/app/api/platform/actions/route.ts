import { NextRequest, NextResponse } from "next/server";
import {
  createId,
  getSessionUser,
  pushInAppNotification,
  readDb,
  requireRole,
  slugify,
  writeDb,
} from "@/lib/urbis-store";
import { sendEmailNotification } from "@/lib/email-service";
import { prisma } from "@/lib/prisma";
import type { ProductStatus, Visibility } from "@/lib/urbis-types";

export const runtime = "nodejs";
const MAX_PRODUCT_IMAGES = 5;

function uniqueSlug(base: string, existing: Set<string>): string {
  let slug = base;
  let cursor = 1;

  while (existing.has(slug)) {
    cursor += 1;
    slug = `${base}-${cursor}`;
  }

  return slug;
}

function parseImageUrls(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  }

  const raw = String(input ?? "").trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function canManageEmprendimiento(
  role: "resident" | "admin_conjunto" | "superadmin",
  userId: string,
  userConjuntoId: string | null,
  emprendimiento: { ownerId: string; conjuntoId: string },
): boolean {
  if (role === "superadmin") {
    return true;
  }

  if (role === "admin_conjunto") {
    return userConjuntoId === emprendimiento.conjuntoId;
  }

  return emprendimiento.ownerId === userId;
}

function notifyRoleUsers(
  role: "superadmin" | "admin_conjunto",
  db: Awaited<ReturnType<typeof readDb>>,
  type: string,
  message: string,
  metadata: Record<string, string> = {},
) {
  const users = db.users.filter((entry) => entry.role === role && entry.status === "active");
  for (const entry of users) {
    pushInAppNotification(db, entry.id, type, message, metadata);
  }
}

function ensureIndependentConjunto(
  db: Awaited<ReturnType<typeof readDb>>,
  actorUserId: string,
): string {
  const existing = db.conjuntos.find((entry) => entry.slug === "emprendedores-independientes");
  if (existing) {
    return existing.id;
  }

  const superadmin =
    db.users.find((entry) => entry.role === "superadmin" && entry.status === "active") ?? null;
  const now = new Date().toISOString();
  const id = createId();
  db.conjuntos.push({
    id,
    name: "Emprendedores Independientes",
    slug: "emprendedores-independientes",
    location: "Nacional",
    description:
      "Espacio para emprendedores que operan sin asociación inicial a un conjunto específico.",
    logoUrl: "/images/owner-1.jpg",
    status: "approved",
    createdBy: superadmin?.id ?? actorUserId,
    createdAt: now,
  });

  return id;
}

async function notifyFollowersAboutNewProduct(params: {
  db: Awaited<ReturnType<typeof readDb>>;
  emprendimiento: { id: string; name: string };
  product: { id: string; name: string; slug: string; price: number };
  ownerId: string;
}) {
  const follows = await prisma.emprendimientoFollowRecord.findMany({
    where: {
      emprendimientoId: params.emprendimiento.id,
      notifyNewProducts: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      },
    },
  });

  if (follows.length === 0) {
    return;
  }

  const followerIds = follows.map((entry) => entry.userId);
  const preferences = await prisma.notificationPreferenceRecord.findMany({
    where: {
      userId: { in: followerIds },
    },
    select: {
      userId: true,
      wantsProductNotifications: true,
      wantsEmail: true,
    },
  });
  const preferenceByUserId = new Map(preferences.map((entry) => [entry.userId, entry]));

  for (const follow of follows) {
    const follower = follow.user;
    if (!follower || follower.status !== "active" || follower.id === params.ownerId) {
      continue;
    }

    const preference = preferenceByUserId.get(follower.id);
    if (!preference?.wantsProductNotifications) {
      continue;
    }

    pushInAppNotification(
      params.db,
      follower.id,
      "new_product_from_followed_emprendimiento",
      `${params.emprendimiento.name} publicó un nuevo producto: ${params.product.name}.`,
      {
        productId: params.product.id,
        productSlug: params.product.slug,
        emprendimientoId: params.emprendimiento.id,
      },
    );

    if (preference.wantsEmail) {
      const subject = `Nuevo producto en ${params.emprendimiento.name}`;
      const productUrl = `/productos/${params.product.slug}`;
      const emailResult = await sendEmailNotification({
        to: follower.email,
        subject,
        html: `<p>Hola ${follower.name},</p>
<p><strong>${params.emprendimiento.name}</strong> publicó un nuevo producto:</p>
<p><strong>${params.product.name}</strong> - $${params.product.price.toFixed(2)}</p>
<p>Revisa el producto aquí: ${productUrl}</p>`,
        text: `Hola ${follower.name}, ${params.emprendimiento.name} publicó ${params.product.name}. Ver: ${productUrl}`,
      });

      params.db.notifications.unshift({
        id: createId(),
        userId: follower.id,
        type: "new_product_email",
        channel: "email",
        status: emailResult.ok ? "sent" : "failed",
        metadata: {
          message: subject,
          emprendimientoId: params.emprendimiento.id,
          productId: params.product.id,
          result: emailResult.ok ? "sent" : "failed",
          detail: emailResult.error ?? "OK",
        },
        createdAt: new Date().toISOString(),
      });
    }
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action?: string;
    data?: Record<string, unknown>;
  };

  const action = body.action;
  const data = body.data ?? {};

  if (!action) {
    return NextResponse.json({ error: "Acción requerida." }, { status: 400 });
  }

  if (action === "request_conjunto") {
    const nameRequested = String(data.nameRequested ?? "").trim();
    const location = String(data.location ?? "").trim();
    const description = String(data.description ?? "").trim();
    const logoUrlRaw = String(data.logoUrl ?? "").trim();
    const logoUrl = logoUrlRaw || null;
    const contactEmail = String(data.contactEmail ?? "").trim().toLowerCase();

    if (!nameRequested || !location || !contactEmail) {
      return NextResponse.json(
        { error: "Nombre, ubicación y email de contacto son requeridos." },
        { status: 400 },
      );
    }

    const db = await readDb();
    const timestamp = new Date().toISOString();
    db.conjuntoRequests.push({
      id: createId(),
      nameRequested,
      location,
      description,
      logoUrl,
      contactEmail,
      requestedByUserId: null,
      status: "pending",
      reviewedBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    notifyRoleUsers(
      "superadmin",
      db,
      "new_conjunto_request",
      `Nueva solicitud de conjunto: ${nameRequested}`,
      {
        location,
        contactEmail,
      },
    );

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Solicitud enviada." });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const db = await readDb();

  if (action === "update_conjunto") {
    if (!requireRole(user, ["admin_conjunto", "superadmin"])) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const conjuntoId = String(data.conjuntoId ?? "").trim();
    const name = String(data.name ?? "").trim();
    const location = String(data.location ?? "").trim();
    const description = String(data.description ?? "").trim();
    const logoUrlRaw = String(data.logoUrl ?? "").trim();
    const statusRaw = String(data.status ?? "").trim();

    if (!conjuntoId || !name || !location) {
      return NextResponse.json({ error: "Datos de conjunto inválidos." }, { status: 400 });
    }

    const conjunto = db.conjuntos.find((entry) => entry.id === conjuntoId);
    if (!conjunto) {
      return NextResponse.json({ error: "Conjunto no encontrado." }, { status: 404 });
    }

    if (user.role === "admin_conjunto" && user.conjuntoId !== conjunto.id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    if (conjunto.name !== name) {
      const baseSlug = slugify(name) || "conjunto";
      const existingSlugs = new Set(
        db.conjuntos.filter((entry) => entry.id !== conjunto.id).map((entry) => entry.slug),
      );
      conjunto.slug = uniqueSlug(baseSlug, existingSlugs);
    }

    conjunto.name = name;
    conjunto.location = location;
    conjunto.description = description;
    conjunto.logoUrl = logoUrlRaw || conjunto.logoUrl || "/images/owner-1.jpg";

    if (
      user.role === "superadmin" &&
      ["pending", "approved", "rejected", "suspended"].includes(statusRaw)
    ) {
      conjunto.status = statusRaw as "pending" | "approved" | "rejected" | "suspended";
    }

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Conjunto actualizado." });
  }

  if (action === "create_emprendimiento") {
    if (!requireRole(user, ["resident"])) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const name = String(data.name ?? "").trim();
    const description = String(data.description ?? "").trim();
    const logoUrlRaw = String(data.logoUrl ?? "").trim();
    const contactEmailRaw = String(data.contactEmail ?? "").trim();
    const contactPhoneRaw = String(data.contactPhone ?? "").trim();
    const visibilityRaw = String(data.visibility ?? "public") as Visibility;
    const visibility: Visibility = visibilityRaw === "internal" ? "internal" : "public";
    const logoUrl = logoUrlRaw || "/images/market-woman.jpg";
    const contactEmail = contactEmailRaw ? contactEmailRaw.toLowerCase() : null;
    const contactPhone = contactPhoneRaw || null;

    if (!name || !description) {
      return NextResponse.json(
        { error: "Nombre y descripción son requeridos." },
        { status: 400 },
      );
    }

    const assignedConjuntoId = user.conjuntoId || ensureIndependentConjunto(db, user.id);

    const timestamp = new Date().toISOString();
    db.emprendimientos.push({
      id: createId(),
      conjuntoId: assignedConjuntoId,
      ownerId: user.id,
      name,
      description,
      logoUrl,
      contactEmail,
      contactPhone,
      visibility,
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const conjuntoAdmins = db.users.filter(
      (entry) =>
        entry.role === "admin_conjunto" &&
        entry.conjuntoId === assignedConjuntoId &&
        entry.status === "active",
    );
    for (const admin of conjuntoAdmins) {
      pushInAppNotification(
        db,
        admin.id,
        "new_emprendimiento_pending",
        `Nuevo emprendimiento pendiente: ${name}`,
      );
    }

    pushInAppNotification(
      db,
      user.id,
      "emprendimiento_created",
      "Tu emprendimiento fue creado y está pendiente de revisión.",
    );

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Emprendimiento enviado a revisión." });
  }

  if (action === "update_emprendimiento") {
    if (!requireRole(user, ["resident", "admin_conjunto", "superadmin"])) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const emprendimientoId = String(data.emprendimientoId ?? "").trim();
    const name = String(data.name ?? "").trim();
    const description = String(data.description ?? "").trim();
    const logoUrlRaw = String(data.logoUrl ?? "").trim();
    const contactEmailRaw = String(data.contactEmail ?? "").trim();
    const contactPhoneRaw = String(data.contactPhone ?? "").trim();
    const visibilityRaw = String(data.visibility ?? "public") as Visibility;
    const visibility: Visibility = visibilityRaw === "internal" ? "internal" : "public";

    if (!emprendimientoId || !name || !description) {
      return NextResponse.json(
        { error: "Datos de emprendimiento inválidos." },
        { status: 400 },
      );
    }

    const emprendimiento = db.emprendimientos.find((entry) => entry.id === emprendimientoId);
    if (!emprendimiento) {
      return NextResponse.json({ error: "Emprendimiento no encontrado." }, { status: 404 });
    }

    if (
      !canManageEmprendimiento(
        user.role,
        user.id,
        user.conjuntoId,
        emprendimiento,
      )
    ) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    emprendimiento.name = name;
    emprendimiento.description = description;
    emprendimiento.logoUrl = logoUrlRaw || emprendimiento.logoUrl || "/images/market-woman.jpg";
    emprendimiento.contactEmail = contactEmailRaw ? contactEmailRaw.toLowerCase() : null;
    emprendimiento.contactPhone = contactPhoneRaw || null;
    emprendimiento.visibility = visibility;
    emprendimiento.updatedAt = new Date().toISOString();

    if (user.id !== emprendimiento.ownerId) {
      pushInAppNotification(
        db,
        emprendimiento.ownerId,
        "emprendimiento_updated",
        `Tu emprendimiento "${emprendimiento.name}" fue actualizado por gestión de comunidad.`,
      );
    }

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Emprendimiento actualizado." });
  }

  if (action === "set_emprendimiento_status") {
    if (!requireRole(user, ["admin_conjunto", "superadmin"])) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const emprendimientoId = String(data.emprendimientoId ?? "").trim();
    const status = String(data.status ?? "").trim();
    if (!emprendimientoId || !["approved", "rejected", "suspended"].includes(status)) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    const emprendimiento = db.emprendimientos.find((entry) => entry.id === emprendimientoId);
    if (
      !emprendimiento ||
      (user.role === "admin_conjunto" && emprendimiento.conjuntoId !== user.conjuntoId)
    ) {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }

    emprendimiento.status = status as "approved" | "rejected" | "suspended";
    emprendimiento.updatedAt = new Date().toISOString();

    pushInAppNotification(
      db,
      emprendimiento.ownerId,
      "emprendimiento_status_changed",
      `Tu emprendimiento "${emprendimiento.name}" fue ${status === "approved" ? "aprobado" : status === "rejected" ? "rechazado" : "suspendido"}.`,
    );

    await writeDb(db);

    return NextResponse.json({ ok: true, message: "Estado actualizado." });
  }

  if (action === "create_producto") {
    if (!requireRole(user, ["resident"])) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const emprendimientoId = String(data.emprendimientoId ?? "").trim();
    const name = String(data.name ?? "").trim();
    const description = String(data.description ?? "").trim();
    const price = Number(data.price ?? 0);
    const specialPriceRaw = String(data.specialPrice ?? "").trim();
    const specialPriceValue = specialPriceRaw ? Number(specialPriceRaw) : null;
    const category = String(data.category ?? "General").trim() || "General";
    const stockRaw = String(data.stock ?? "").trim();
    const imageUrl = String(data.imageUrl ?? "").trim();
    const imageUrls = parseImageUrls(data.imageUrls);
    const statusRaw = String(data.status ?? "draft") as ProductStatus;
    const status: ProductStatus = ["draft", "published", "paused", "archived"].includes(statusRaw)
      ? statusRaw
      : "draft";

    if (!emprendimientoId || !name || !description || Number.isNaN(price) || price <= 0) {
      return NextResponse.json({ error: "Datos de producto inválidos." }, { status: 400 });
    }

    if (
      specialPriceValue !== null &&
      (Number.isNaN(specialPriceValue) || specialPriceValue <= 0 || specialPriceValue >= price)
    ) {
      return NextResponse.json(
        { error: "El precio especial debe ser menor que el precio regular." },
        { status: 400 },
      );
    }
    if (imageUrls.length > MAX_PRODUCT_IMAGES) {
      return NextResponse.json(
        { error: `Un producto puede tener máximo ${MAX_PRODUCT_IMAGES} imágenes.` },
        { status: 400 },
      );
    }

    const emprendimiento = db.emprendimientos.find((entry) => entry.id === emprendimientoId);
    if (!emprendimiento || emprendimiento.ownerId !== user.id) {
      return NextResponse.json({ error: "Emprendimiento no válido." }, { status: 404 });
    }

    if (emprendimiento.status !== "approved") {
      return NextResponse.json(
        { error: "Tu emprendimiento debe estar aprobado para publicar productos." },
        { status: 400 },
      );
    }

    const baseSlug = slugify(name) || "producto";
    const slug = uniqueSlug(baseSlug, new Set(db.products.map((entry) => entry.slug)));

    const timestamp = new Date().toISOString();
    const createdProduct = {
      id: createId(),
      emprendimientoId,
      ownerId: user.id,
      name,
      slug,
      description,
      price,
      specialPrice: specialPriceValue,
      category,
      stock: stockRaw ? Number(stockRaw) : null,
      imageUrls:
        imageUrls.length > 0
          ? imageUrls.slice(0, MAX_PRODUCT_IMAGES)
          : [imageUrl || "/images/hero-market.jpg"],
      status,
      viewCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    db.products.push(createdProduct);

    pushInAppNotification(
      db,
      user.id,
      "producto_created",
      `Producto "${name}" creado correctamente.`,
    );

    if (status === "published") {
      await notifyFollowersAboutNewProduct({
        db,
        emprendimiento: {
          id: emprendimiento.id,
          name: emprendimiento.name,
        },
        product: {
          id: createdProduct.id,
          name: createdProduct.name,
          slug: createdProduct.slug,
          price: createdProduct.price,
        },
        ownerId: user.id,
      });
    }

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Producto creado." });
  }

  if (action === "update_producto") {
    if (!requireRole(user, ["resident", "admin_conjunto", "superadmin"])) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const productId = String(data.productId ?? "").trim();
    const name = String(data.name ?? "").trim();
    const description = String(data.description ?? "").trim();
    const price = Number(data.price ?? 0);
    const specialPriceRaw = String(data.specialPrice ?? "").trim();
    const specialPriceValue = specialPriceRaw ? Number(specialPriceRaw) : null;
    const category = String(data.category ?? "General").trim() || "General";
    const stockRaw = String(data.stock ?? "").trim();
    const imageUrls = parseImageUrls(data.imageUrls);
    const statusRaw = String(data.status ?? "draft") as ProductStatus;
    const status: ProductStatus = ["draft", "published", "paused", "archived"].includes(statusRaw)
      ? statusRaw
      : "draft";

    if (!productId || !name || !description || Number.isNaN(price) || price <= 0) {
      return NextResponse.json({ error: "Datos de producto inválidos." }, { status: 400 });
    }

    if (
      specialPriceValue !== null &&
      (Number.isNaN(specialPriceValue) || specialPriceValue <= 0 || specialPriceValue >= price)
    ) {
      return NextResponse.json(
        { error: "El precio especial debe ser menor que el precio regular." },
        { status: 400 },
      );
    }
    if (imageUrls.length > MAX_PRODUCT_IMAGES) {
      return NextResponse.json(
        { error: `Un producto puede tener máximo ${MAX_PRODUCT_IMAGES} imágenes.` },
        { status: 400 },
      );
    }

    const product = db.products.find((entry) => entry.id === productId);
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }

    const emprendimiento = db.emprendimientos.find(
      (entry) => entry.id === product.emprendimientoId,
    );
    if (!emprendimiento) {
      return NextResponse.json({ error: "Emprendimiento no encontrado." }, { status: 404 });
    }

    if (
      !canManageEmprendimiento(
        user.role,
        user.id,
        user.conjuntoId,
        emprendimiento,
      )
    ) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    if (product.name !== name) {
      const baseSlug = slugify(name) || "producto";
      const existingSlugs = new Set(
        db.products.filter((entry) => entry.id !== product.id).map((entry) => entry.slug),
      );
      product.slug = uniqueSlug(baseSlug, existingSlugs);
    }

    product.name = name;
    product.description = description;
    product.price = price;
    product.specialPrice = specialPriceValue;
    product.category = category;
    product.stock = stockRaw ? Number(stockRaw) : null;
    product.imageUrls =
      imageUrls.length > 0
        ? imageUrls.slice(0, MAX_PRODUCT_IMAGES)
        : product.imageUrls.slice(0, MAX_PRODUCT_IMAGES);
    product.status = status;
    product.updatedAt = new Date().toISOString();

    if (user.id !== product.ownerId) {
      pushInAppNotification(
        db,
        product.ownerId,
        "producto_updated",
        `Tu producto "${product.name}" fue actualizado por gestión de comunidad.`,
      );
    }

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Producto actualizado." });
  }

  if (action === "set_producto_status") {
    if (!requireRole(user, ["resident"])) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const productId = String(data.productId ?? "").trim();
    const status = String(data.status ?? "").trim();

    if (!productId || !["draft", "published", "paused", "archived"].includes(status)) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    const product = db.products.find((entry) => entry.id === productId && entry.ownerId === user.id);
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }

    const previousStatus = product.status;
    product.status = status as ProductStatus;
    product.updatedAt = new Date().toISOString();

    if (previousStatus !== "published" && product.status === "published") {
      const emprendimiento = db.emprendimientos.find(
        (entry) => entry.id === product.emprendimientoId,
      );
      if (emprendimiento) {
        await notifyFollowersAboutNewProduct({
          db,
          emprendimiento: {
            id: emprendimiento.id,
            name: emprendimiento.name,
          },
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
          },
          ownerId: user.id,
        });
      }
    }

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Estado de producto actualizado." });
  }

  if (action === "set_conjunto_request_status") {
    if (!requireRole(user, ["superadmin"])) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const requestId = String(data.requestId ?? "").trim();
    const status = String(data.status ?? "").trim();
    if (!requestId || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    const reqEntry = db.conjuntoRequests.find((entry) => entry.id === requestId);
    if (!reqEntry) {
      return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
    }

    reqEntry.status = status as "approved" | "rejected";
    reqEntry.reviewedBy = user.id;
    reqEntry.updatedAt = new Date().toISOString();

    if (status === "approved") {
      const baseSlug = slugify(reqEntry.nameRequested) || `conjunto-${db.conjuntos.length + 1}`;
      const slug = uniqueSlug(baseSlug, new Set(db.conjuntos.map((entry) => entry.slug)));
      const newConjuntoId = createId();
      db.conjuntos.push({
        id: newConjuntoId,
        name: reqEntry.nameRequested,
        slug,
        location: reqEntry.location,
        description: reqEntry.description,
        logoUrl: reqEntry.logoUrl ?? "/images/owner-1.jpg",
        status: "approved",
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      });

      if (reqEntry.requestedByUserId) {
        const requester = db.users.find((entry) => entry.id === reqEntry.requestedByUserId);
        if (requester) {
          requester.role = "admin_conjunto";
          requester.conjuntoId = newConjuntoId;
          pushInAppNotification(
            db,
            requester.id,
            "conjunto_request_approved",
            `Tu conjunto "${reqEntry.nameRequested}" fue aprobado y ya puedes gestionarlo.`,
          );
        }
      }
    } else if (reqEntry.requestedByUserId) {
      pushInAppNotification(
        db,
        reqEntry.requestedByUserId,
        "conjunto_request_rejected",
        `Tu solicitud de conjunto "${reqEntry.nameRequested}" fue rechazada.`,
      );
    }

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Solicitud procesada." });
  }

  if (action === "delete_conjunto") {
    if (!requireRole(user, ["superadmin"])) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const conjuntoId = String(data.conjuntoId ?? "").trim();
    if (!conjuntoId) {
      return NextResponse.json({ error: "Conjunto inválido." }, { status: 400 });
    }

    const conjunto = db.conjuntos.find((entry) => entry.id === conjuntoId);
    if (!conjunto) {
      return NextResponse.json({ error: "Conjunto no encontrado." }, { status: 404 });
    }

    const emprendimientoIds = new Set(
      db.emprendimientos
        .filter((entry) => entry.conjuntoId === conjuntoId)
        .map((entry) => entry.id),
    );
    const productIds = new Set(
      db.products
        .filter((entry) => emprendimientoIds.has(entry.emprendimientoId))
        .map((entry) => entry.id),
    );

    db.reviews = db.reviews.filter((entry) => !productIds.has(entry.productId));
    db.products = db.products.filter((entry) => !productIds.has(entry.id));
    db.emprendimientos = db.emprendimientos.filter((entry) => !emprendimientoIds.has(entry.id));
    db.conjuntos = db.conjuntos.filter((entry) => entry.id !== conjuntoId);

    db.users = db.users.map((entry) => {
      if (entry.conjuntoId !== conjuntoId) {
        return entry;
      }

      return {
        ...entry,
        conjuntoId: null,
        role: entry.role === "admin_conjunto" ? "resident" : entry.role,
      };
    });

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Conjunto eliminado." });
  }

  if (action === "delete_emprendimiento") {
    const emprendimientoId = String(data.emprendimientoId ?? "").trim();
    if (!emprendimientoId) {
      return NextResponse.json({ error: "Emprendimiento inválido." }, { status: 400 });
    }

    const emprendimiento = db.emprendimientos.find((entry) => entry.id === emprendimientoId);
    if (!emprendimiento) {
      return NextResponse.json({ error: "Emprendimiento no encontrado." }, { status: 404 });
    }

    if (
      !canManageEmprendimiento(
        user.role,
        user.id,
        user.conjuntoId,
        emprendimiento,
      )
    ) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const ownerId = emprendimiento.ownerId;
    const emprendimientoName = emprendimiento.name;
    const productIds = new Set(
      db.products
        .filter((entry) => entry.emprendimientoId === emprendimientoId)
        .map((entry) => entry.id),
    );

    db.reviews = db.reviews.filter((entry) => !productIds.has(entry.productId));
    db.products = db.products.filter((entry) => !productIds.has(entry.id));
    db.emprendimientos = db.emprendimientos.filter((entry) => entry.id !== emprendimientoId);

    if (user.id !== ownerId) {
      pushInAppNotification(
        db,
        ownerId,
        "emprendimiento_deleted",
        `Tu emprendimiento "${emprendimientoName}" fue eliminado por gestión de comunidad.`,
      );
    }

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Emprendimiento eliminado." });
  }

  if (action === "delete_producto") {
    const productId = String(data.productId ?? "").trim();
    if (!productId) {
      return NextResponse.json({ error: "Producto inválido." }, { status: 400 });
    }

    const product = db.products.find((entry) => entry.id === productId);
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }

    const emprendimiento = db.emprendimientos.find(
      (entry) => entry.id === product.emprendimientoId,
    );
    if (!emprendimiento) {
      return NextResponse.json({ error: "Emprendimiento no encontrado." }, { status: 404 });
    }

    if (
      !canManageEmprendimiento(
        user.role,
        user.id,
        user.conjuntoId,
        emprendimiento,
      )
    ) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const ownerId = product.ownerId;
    const productName = product.name;

    db.products = db.products.filter((entry) => entry.id !== productId);
    db.reviews = db.reviews.filter((entry) => entry.productId !== productId);

    if (user.id !== ownerId) {
      pushInAppNotification(
        db,
        ownerId,
        "producto_deleted",
        `Tu producto "${productName}" fue eliminado por gestión de comunidad.`,
      );
    }

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Producto eliminado." });
  }

  if (action === "add_resena") {
    const productId = String(data.productId ?? "").trim();
    const comment = String(data.comment ?? "").trim();
    const rating = Number(data.rating ?? 0);

    if (!productId || Number.isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Reseña inválida." }, { status: 400 });
    }

    const product = db.products.find((entry) => entry.id === productId);
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }

    db.reviews.push({
      id: createId(),
      productId,
      authorId: user.id,
      rating,
      comment,
      status: "visible",
      createdAt: new Date().toISOString(),
    });

    await writeDb(db);
    return NextResponse.json({ ok: true, message: "Reseña agregada." });
  }

  return NextResponse.json({ error: "Acción no soportada." }, { status: 400 });
}
