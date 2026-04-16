import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import type {
  Conjunto,
  Emprendimiento,
  Notification,
  Producto,
  SessionUser,
  UrbisDb,
  User,
  UserRole,
} from "./urbis-types";
import { prisma } from "./prisma";

const DB_DIR = join(process.cwd(), "data");
const DB_PATH = join(DB_DIR, "urbis-db.json");
export const SESSION_COOKIE = "urbis_session";

const now = () => new Date().toISOString();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, packed: string): boolean {
  const [salt, storedHash] = packed.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const computed = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, "hex");

  if (stored.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(stored, computed);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function createSeedDb(): UrbisDb {
  const timestamp = now();
  const superId = randomUUID();
  const adminId = randomUUID();
  const residentId = randomUUID();
  const conjuntoId = randomUUID();
  const conjuntoId2 = randomUUID();
  const emprendimientoId = randomUUID();
  const emprendimientoId2 = randomUUID();

  const users: User[] = [
    {
      id: superId,
      name: "Super Admin URBIS",
      email: "super@urbis.local",
      passwordHash: hashPassword("Super123!"),
      role: "superadmin",
      conjuntoId: null,
      avatarUrl: null,
      status: "active",
      acceptedTermsAt: timestamp,
      createdAt: timestamp,
    },
    {
      id: adminId,
      name: "Admin Vista Norte",
      email: "admin@urbis.local",
      passwordHash: hashPassword("Admin123!"),
      role: "admin_conjunto",
      conjuntoId,
      avatarUrl: null,
      status: "active",
      acceptedTermsAt: timestamp,
      createdAt: timestamp,
    },
    {
      id: residentId,
      name: "Residente Demo",
      email: "residente@urbis.local",
      passwordHash: hashPassword("Demo123!"),
      role: "resident",
      conjuntoId,
      avatarUrl: null,
      status: "active",
      acceptedTermsAt: timestamp,
      createdAt: timestamp,
    },
  ];

  const conjuntos: Conjunto[] = [
    {
      id: conjuntoId,
      name: "Vista Norte",
      slug: "vista-norte",
      location: "Quito",
      description: "Comunidad residencial con enfoque en comercio local.",
      logoUrl: "/images/owner-1.jpg",
      status: "approved",
      createdBy: superId,
      createdAt: timestamp,
    },
    {
      id: conjuntoId2,
      name: "Jardines del Sol",
      slug: "jardines-del-sol",
      location: "Guayaquil",
      description: "Urbanizacion con mercado local activo y negocios familiares.",
      logoUrl: "/images/owner-2.jpg",
      status: "approved",
      createdBy: superId,
      createdAt: timestamp,
    },
  ];

  const emprendimientos: Emprendimiento[] = [
    {
      id: emprendimientoId,
      conjuntoId,
      ownerId: residentId,
      name: "Huerto Vecinal",
      description: "Productos frescos y canastas semanales para vecinos.",
      logoUrl: "/images/market-woman.jpg",
      contactEmail: "huerto@urbis.local",
      contactPhone: "+593 99 123 4567",
      visibility: "public",
      status: "approved",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: emprendimientoId2,
      conjuntoId,
      ownerId: residentId,
      name: "Tienda Aurora",
      description: "Articulos para hogar, belleza y regalos de temporada.",
      logoUrl: "/images/owner-3.jpg",
      contactEmail: "aurora@urbis.local",
      contactPhone: "+593 98 555 2244",
      visibility: "public",
      status: "approved",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  const products: Producto[] = [
    {
      id: randomUUID(),
      emprendimientoId,
      ownerId: residentId,
      name: "Canasta Organica Familiar",
      slug: "canasta-organica-familiar",
      description:
        "Incluye vegetales de temporada, frutas locales y entregas semanales.",
      price: 28.5,
      specialPrice: 22.9,
      category: "Alimentos",
      stock: 24,
      imageUrls: ["/images/hero-market.jpg"],
      status: "published",
      viewCount: 43,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: randomUUID(),
      emprendimientoId,
      ownerId: residentId,
      name: "Pack de Hierbas Aromaticas",
      slug: "pack-hierbas-aromaticas",
      description: "Menta, albahaca y romero para cocina diaria.",
      price: 9.99,
      specialPrice: null,
      category: "Hogar",
      stock: 30,
      imageUrls: ["/images/owner-3.jpg"],
      status: "published",
      viewCount: 27,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: randomUUID(),
      emprendimientoId: emprendimientoId2,
      ownerId: residentId,
      name: "Set de Velas Aromaticas",
      slug: "set-velas-aromaticas",
      description: "Velas artesanales de lavanda y canela para hogar.",
      price: 15.5,
      specialPrice: 13.2,
      category: "Hogar y Decoracion",
      stock: 18,
      imageUrls: ["/images/night-store.jpg"],
      status: "published",
      viewCount: 35,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: randomUUID(),
      emprendimientoId: emprendimientoId2,
      ownerId: residentId,
      name: "Kit de Cuidado Facial",
      slug: "kit-cuidado-facial",
      description: "Limpieza, hidratacion y protector para rutina diaria.",
      price: 24.9,
      specialPrice: null,
      category: "Belleza y Cuidado Personal",
      stock: 14,
      imageUrls: ["/images/market-woman.jpg"],
      status: "published",
      viewCount: 22,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: randomUUID(),
      emprendimientoId: emprendimientoId2,
      ownerId: residentId,
      name: "Soporte Ajustable para Laptop",
      slug: "soporte-ajustable-laptop",
      description: "Soporte ergonomico en aluminio para trabajo en casa.",
      price: 32,
      specialPrice: 27.9,
      category: "Tecnologia y Accesorios",
      stock: 12,
      imageUrls: ["/images/owner-1.jpg"],
      status: "published",
      viewCount: 19,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: randomUUID(),
      emprendimientoId: emprendimientoId2,
      ownerId: residentId,
      name: "Correa Premium para Perro",
      slug: "correa-premium-perro",
      description: "Correa reforzada para paseos diarios con mascotas.",
      price: 18.4,
      specialPrice: null,
      category: "Mascotas",
      stock: 25,
      imageUrls: ["/images/owner-2.jpg"],
      status: "published",
      viewCount: 14,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  return {
    users,
    conjuntos,
    conjuntoRequests: [],
    emprendimientos,
    products,
    reviews: [
      {
        id: randomUUID(),
        productId: products[0].id,
        authorId: adminId,
        rating: 5,
        comment: "Muy buena calidad y entrega puntual.",
        status: "visible",
        createdAt: timestamp,
      },
    ],
    notifications: [],
    feedbackMessages: [],
  };
}

function normalizeDb(rawDb: UrbisDb): UrbisDb {
  rawDb.users = rawDb.users.map((user) => ({
    ...user,
    acceptedTermsAt: user.acceptedTermsAt ?? null,
  }));

  rawDb.conjuntos = rawDb.conjuntos.map((conjunto) => ({
    ...conjunto,
    logoUrl: conjunto.logoUrl ?? "/images/owner-1.jpg",
  }));

  rawDb.conjuntoRequests = rawDb.conjuntoRequests.map((request) => ({
    ...request,
    logoUrl: request.logoUrl ?? null,
    requestedByUserId: request.requestedByUserId ?? null,
  }));

  rawDb.emprendimientos = rawDb.emprendimientos.map((emprendimiento) => ({
    ...emprendimiento,
    logoUrl: emprendimiento.logoUrl ?? "/images/market-woman.jpg",
    contactEmail: emprendimiento.contactEmail ?? null,
    contactPhone: emprendimiento.contactPhone ?? null,
  }));

  rawDb.notifications = rawDb.notifications.map((notification) => ({
    ...notification,
    status: notification.status ?? "queued",
    metadata: notification.metadata ?? {},
  }));

  rawDb.feedbackMessages = (rawDb.feedbackMessages ?? []).map((entry) => ({
    ...entry,
    category: entry.category ?? "mejora",
    status: entry.status ?? "new",
  }));

  const hasExplicitSpecial = rawDb.products.some(
    (product) =>
      typeof product.specialPrice === "number" && product.specialPrice > 0,
  );

  const topPublishedIds = new Set(
    rawDb.products
      .filter((product) => product.status === "published")
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 2)
      .map((product) => product.id),
  );

  rawDb.products = rawDb.products.map((product) => {
    const explicitSpecial =
      typeof product.specialPrice === "number" ? product.specialPrice : null;

    if (explicitSpecial !== null) {
      return {
        ...product,
        specialPrice: explicitSpecial,
      };
    }

    if (!hasExplicitSpecial && topPublishedIds.has(product.id)) {
      return {
        ...product,
        specialPrice: Number((product.price * 0.85).toFixed(2)),
      };
    }

    return {
      ...product,
      specialPrice: null,
    };
  });

  return rawDb;
}

async function ensureDbFile(): Promise<void> {
  await mkdir(DB_DIR, { recursive: true });

  try {
    await readFile(DB_PATH, "utf-8");
  } catch {
    const seed = createSeedDb();
    await writeFile(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
  }
}

function shouldUseDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

async function readLocalDbIfExists(): Promise<UrbisDb | null> {
  try {
    await ensureDbFile();
    const raw = await readFile(DB_PATH, "utf-8");
    const db = JSON.parse(raw) as UrbisDb;
    return normalizeDb(db);
  } catch {
    return null;
  }
}

async function ensureDbStateRow(): Promise<void> {
  const existing = await prisma.appState.findUnique({
    where: { id: "default" },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  const localDb = await readLocalDbIfExists();
  const seed = localDb ?? createSeedDb();

  await prisma.appState.create({
    data: {
      id: "default",
      data: seed as Prisma.InputJsonValue,
    },
  });
}

export async function readDb(): Promise<UrbisDb> {
  if (shouldUseDatabase()) {
    await ensureDbStateRow();

    const row = await prisma.appState.findUnique({
      where: { id: "default" },
      select: { data: true },
    });

    if (!row) {
      return normalizeDb(createSeedDb());
    }

    const db = row.data as unknown as UrbisDb;
    return normalizeDb(db);
  }

  await ensureDbFile();
  const raw = await readFile(DB_PATH, "utf-8");
  const db = JSON.parse(raw) as UrbisDb;
  return normalizeDb(db);
}

export async function writeDb(db: UrbisDb): Promise<void> {
  if (shouldUseDatabase()) {
    await prisma.appState.upsert({
      where: { id: "default" },
      update: { data: db as Prisma.InputJsonValue },
      create: { id: "default", data: db as Prisma.InputJsonValue },
    });
    return;
  }

  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function createId(): string {
  return randomUUID();
}

export function pushInAppNotification(
  db: UrbisDb,
  userId: string,
  type: string,
  message: string,
  metadata: Record<string, string> = {},
): Notification {
  const notification: Notification = {
    id: createId(),
    userId,
    type,
    channel: "in_app",
    status: "queued",
    metadata: {
      message,
      ...metadata,
    },
    createdAt: now(),
  };

  db.notifications.unshift(notification);
  return notification;
}

export function createPasswordHash(password: string): string {
  return hashPassword(password);
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    conjuntoId: user.conjuntoId,
    avatarUrl: user.avatarUrl ?? null,
    status: user.status,
  };
}

export async function getSessionUser(request: NextRequest): Promise<User | null> {
  const userId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!userId) {
    return null;
  }

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId) ?? null;
  if (!user || user.status !== "active") {
    return null;
  }

  return user;
}

export function requireRole(user: User, allowed: UserRole[]): boolean {
  return allowed.includes(user.role);
}

export function computeRating(productId: string, db: UrbisDb): {
  average: number;
  total: number;
} {
  const related = db.reviews.filter(
    (review) => review.productId === productId && review.status === "visible",
  );

  if (related.length === 0) {
    return { average: 0, total: 0 };
  }

  const totalScore = related.reduce((acc, review) => acc + review.rating, 0);
  return {
    average: Number((totalScore / related.length).toFixed(1)),
    total: related.length,
  };
}

export function canViewProduct(
  product: Producto,
  emprendimiento: Emprendimiento,
  conjunto: Conjunto,
  viewer: User | null,
): boolean {
  if (product.status !== "published") {
    return false;
  }

  if (emprendimiento.status !== "approved") {
    return false;
  }

  if (conjunto.status !== "approved") {
    return false;
  }

  if (emprendimiento.visibility === "public") {
    return true;
  }

  return Boolean(viewer && viewer.conjuntoId === emprendimiento.conjuntoId);
}
