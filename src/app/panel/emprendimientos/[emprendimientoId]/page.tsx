"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface SessionUser {
  id: string;
  role: "resident" | "admin_conjunto" | "superadmin";
  conjuntoId: string | null;
}

interface ConjuntoData {
  id: string;
  name: string;
  slug: string;
  location: string;
  logoUrl: string | null;
}

interface EmprendimientoData {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  visibility: "public" | "internal";
  status: string;
  ownerId: string;
  contactEmail: string | null;
  contactPhone: string | null;
}

interface ProductCard {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  specialPrice: number | null;
  finalPrice: number;
  onSale: boolean;
  category: string;
  stock: number | null;
  image: string;
  imageUrls: string[];
  imageCount: number;
  status: string;
  viewCount: number;
  ownerId: string;
}

async function callAction(action: string, data: Record<string, unknown>) {
  const response = await fetch("/api/platform/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });

  const result = (await response.json()) as { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? "No se pudo ejecutar la accion.");
  }

  return result.message ?? "Operacion completada.";
}

export default function EmprendimientoProductsPage() {
  const params = useParams<{ emprendimientoId: string }>();
  const emprendimientoId = String(params?.emprendimientoId ?? "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [conjunto, setConjunto] = useState<ConjuntoData | null>(null);
  const [emprendimiento, setEmprendimiento] = useState<EmprendimientoData | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "emprendimiento" | "producto";
    id: string;
    name: string;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const response = await fetch(
      `/api/platform/hierarchy?emprendimientoId=${emprendimientoId}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "No se pudo cargar el emprendimiento.");
      setLoading(false);
      return;
    }

    const data = (await response.json()) as {
      user: SessionUser;
      conjunto: ConjuntoData | null;
      emprendimiento: EmprendimientoData;
      products: ProductCard[];
    };

    setUser(data.user);
    setConjunto(data.conjunto);
    setEmprendimiento(data.emprendimiento);
    setProducts(data.products ?? []);
    setLoading(false);
  }, [emprendimientoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function removeProduct(productId: string) {
    setMessage("");
    setError("");
    try {
      const result = await callAction("delete_producto", { productId });
      setMessage(result);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo eliminar producto.");
    }
  }

  async function removeEmprendimiento() {
    if (!emprendimiento) {
      return;
    }

    setMessage("");
    setError("");
    try {
      const result = await callAction("delete_emprendimiento", {
        emprendimientoId: emprendimiento.id,
      });
      setMessage(result);
      setTimeout(() => {
        window.location.href = "/panel";
      }, 350);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo eliminar emprendimiento.");
    }
  }

  async function processEmprendimientoStatus(status: "approved" | "rejected" | "suspended") {
    if (!emprendimiento) {
      return;
    }

    setMessage("");
    setError("");
    try {
      const result = await callAction("set_emprendimiento_status", {
        emprendimientoId: emprendimiento.id,
        status,
      });
      setMessage(result);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo actualizar el estado.");
    }
  }

  async function confirmDeleteAction() {
    if (!confirmDelete) {
      return;
    }

    setConfirmLoading(true);
    if (confirmDelete.kind === "emprendimiento") {
      await removeEmprendimiento();
    } else {
      await removeProduct(confirmDelete.id);
    }
    setConfirmLoading(false);
    setConfirmDelete(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] text-zinc-100">
        <p className="text-zinc-300">Cargando productos...</p>
      </main>
    );
  }

  if (!user || !emprendimiento) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-2xl border border-white/10 bg-black/30 p-8">
          <p className="text-red-300">{error || "No autorizado."}</p>
          <Link href="/panel" className="mt-4 inline-block text-emerald-300 hover:text-emerald-200">
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  const canCreateProduct =
    user.role === "resident" &&
    emprendimiento.ownerId === user.id &&
    emprendimiento.status === "approved";
  const canModerateStatus = user.role === "admin_conjunto" || user.role === "superadmin";

  return (
    <main className="min-h-screen bg-[#070b10] px-6 py-10 text-zinc-100 lg:px-12 urbis-watermark">
      <section className="mx-auto max-w-[1320px] space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 rounded-full border border-white/20 bg-cover bg-center"
              style={{
                backgroundImage: `url(${emprendimiento.logoUrl || "/images/market-woman.jpg"})`,
              }}
            />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Emprendimiento</p>
              <h1 className="mt-1 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
                {emprendimiento.name}
              </h1>
              <p className="mt-1 text-zinc-300">
                {conjunto?.name ?? "Sin conjunto"} -{" "}
                {emprendimiento.visibility === "public" ? "visible para todos" : "solo conjunto"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/panel"
              className="border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
            >
              Volver
            </Link>
            {canCreateProduct ? (
              <Link
                href={`/panel/emprendimientos/${emprendimiento.id}/productos/nuevo`}
                className="bg-zinc-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-black hover:bg-white"
              >
                Agregar producto
              </Link>
            ) : null}
            <Link
              href={`/panel/emprendimientos/${emprendimiento.id}/editar`}
              className="border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
            >
              Editar emprendimiento
            </Link>
            {canModerateStatus ? (
              <>
                {emprendimiento.status !== "approved" ? (
                  <button
                    type="button"
                    onClick={() => void processEmprendimientoStatus("approved")}
                    className="border border-emerald-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/10"
                  >
                    Aprobar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void processEmprendimientoStatus("suspended")}
                    className="border border-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200 hover:bg-amber-500/10"
                  >
                    Suspender
                  </button>
                )}
                {emprendimiento.status !== "rejected" ? (
                  <button
                    type="button"
                    onClick={() => void processEmprendimientoStatus("rejected")}
                    className="border border-red-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
                  >
                    Rechazar
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={() =>
                setConfirmDelete({
                  kind: "emprendimiento",
                  id: emprendimiento.id,
                  name: emprendimiento.name,
                })
              }
              className="border border-red-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
            >
              Eliminar emprendimiento
            </button>
          </div>
        </header>

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <section className="grid gap-4 border border-white/10 bg-black/25 p-5 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Descripción</p>
            <p className="mt-2 text-zinc-300">{emprendimiento.description}</p>
            {user.role === "resident" && emprendimiento.status !== "approved" ? (
              <p className="mt-3 text-sm text-amber-300">
                Cuando el emprendimiento este aprobado podras agregar productos.
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Contacto</p>
            <p className="mt-2 text-zinc-300">Email: {emprendimiento.contactEmail || "No definido"}</p>
            <p className="text-zinc-300">Teléfono: {emprendimiento.contactPhone || "No definido"}</p>
          </div>
        </section>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden border border-white/10 bg-black/25">
              <div className="relative h-48">
                <Image src={product.image} alt={product.name} fill className="object-cover" />
              </div>
              <div className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">{product.category}</p>
                <h2 className="text-xl font-semibold text-white">{product.name}</h2>
                <p className="line-clamp-2 text-sm text-zinc-300">{product.description}</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-emerald-300">${product.finalPrice.toFixed(2)}</p>
                  {product.onSale ? (
                    <p className="text-sm text-zinc-500 line-through">${product.price.toFixed(2)}</p>
                  ) : null}
                </div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">
                  {product.status} - {product.viewCount} vistas - {product.imageCount} imágenes -{" "}
                  {product.stock === null ? "sin stock definido" : `${product.stock} en stock`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/productos/${product.slug}`}
                    className="border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
                  >
                    Ver detalle
                  </Link>
                  <Link
                    href={`/panel/emprendimientos/${emprendimiento.id}/productos/${product.id}/editar`}
                    className="border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDelete({
                        kind: "producto",
                        id: product.id,
                        name: product.name,
                      })
                    }
                    className="border border-red-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Seguro que deseas eliminar?"
        description={
          confirmDelete
            ? `Se eliminara "${confirmDelete.name}" y su informacion relacionada.`
            : ""
        }
        loading={confirmLoading}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void confirmDeleteAction()}
      />
    </main>
  );
}
