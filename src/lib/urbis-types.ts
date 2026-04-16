export type UserRole = "resident" | "admin_conjunto" | "superadmin";

export type ConjuntoStatus = "pending" | "approved" | "rejected" | "suspended";
export type EmprendimientoStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";
export type ProductStatus = "draft" | "published" | "paused" | "archived";
export type Visibility = "internal" | "public";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  conjuntoId: string | null;
  avatarUrl: string | null;
  status: "active" | "blocked";
  acceptedTermsAt: string | null;
  createdAt: string;
}

export interface Conjunto {
  id: string;
  name: string;
  slug: string;
  location: string;
  description: string;
  logoUrl: string | null;
  status: ConjuntoStatus;
  createdBy: string;
  createdAt: string;
}

export interface ConjuntoRequest {
  id: string;
  nameRequested: string;
  location: string;
  description: string;
  logoUrl: string | null;
  contactEmail: string;
  requestedByUserId: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Emprendimiento {
  id: string;
  conjuntoId: string;
  ownerId: string;
  name: string;
  description: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  visibility: Visibility;
  status: EmprendimientoStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Producto {
  id: string;
  emprendimientoId: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  specialPrice: number | null;
  category: string;
  stock: number | null;
  imageUrls: string[];
  status: ProductStatus;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  authorId: string;
  rating: number;
  comment: string;
  status: "visible" | "hidden";
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  channel: "email" | "in_app";
  status: "queued" | "sent" | "read";
  metadata: Record<string, string>;
  createdAt: string;
}

export interface FeedbackMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  category: "mejora" | "apoyo";
  status: "new" | "reviewed";
  createdAt: string;
}

export interface UrbisDb {
  users: User[];
  conjuntos: Conjunto[];
  conjuntoRequests: ConjuntoRequest[];
  emprendimientos: Emprendimiento[];
  products: Producto[];
  reviews: Review[];
  notifications: Notification[];
  feedbackMessages: FeedbackMessage[];
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  conjuntoId: string | null;
  avatarUrl: string | null;
  status: "active" | "blocked";
}
