"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { uploadImageFiles } from "@/lib/upload-client";
import { FullScreenSpinner } from "@/components/spinner";

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
  description: string;
  logoUrl: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
}

export default function EditConjuntoPage() {
  const router = useRouter();
  const params = useParams<{ conjuntoId: string }>();
  const conjuntoId = String(params?.conjuntoId ?? "");

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "suspended">(
    "approved",
  );

  useEffect(() => {
    async function loadData() {
      const response = await fetch(`/api/platform/hierarchy?conjuntoId=${conjuntoId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "No se pudo cargar el conjunto.");
        setLoadingData(false);
        return;
      }

      const data = (await response.json()) as {
        user: SessionUser;
        conjunto: ConjuntoData;
      };

      setUser(data.user);
      setName(data.conjunto.name);
      setLocation(data.conjunto.location);
      setDescription(data.conjunto.description ?? "");
      setLogoUrl(data.conjunto.logoUrl ?? "");
      setLogoPreview(data.conjunto.logoUrl ?? "/images/owner-1.jpg");
      setStatus(data.conjunto.status);
      setLoadingData(false);
    }

    void loadData();
  }, [conjuntoId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    let finalLogoUrl = logoUrl;
    if (logoFile) {
      try {
        const [uploadedUrl] = await uploadImageFiles([logoFile]);
        finalLogoUrl = uploadedUrl ?? logoUrl;
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir el logo.");
        setSaving(false);
        return;
      }
    }

    const response = await fetch("/api/platform/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_conjunto",
        data: {
          conjuntoId,
          name,
          location,
          description,
          logoUrl: finalLogoUrl,
          status,
        },
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "No se pudo actualizar el conjunto.");
      setSaving(false);
      return;
    }

    router.push(`/panel/conjuntos/${conjuntoId}`);
    router.refresh();
  }

  if (loadingData) {
    return <FullScreenSpinner label="Cargando formulario" />;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-xl border border-white/10 bg-black/30 p-8">
          <p className="text-zinc-300">{error || "No autorizado."}</p>
          <Link
            href={`/panel/conjuntos/${conjuntoId}`}
            className="mt-4 inline-block text-emerald-300 hover:text-emerald-200"
          >
            Volver al conjunto
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b10] px-6 py-10 text-zinc-100 lg:px-12 urbis-watermark">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Editar conjunto</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
            Actualiza datos de la comunidad
          </h1>
        </header>

        <form onSubmit={submit} className="space-y-4 border border-white/10 bg-black/25 p-6">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del conjunto"
            className="w-full border border-white/20 bg-black/40 px-4 py-3"
            required
          />
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Ubicación"
            className="w-full border border-white/20 bg-black/40 px-4 py-3"
            required
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descripción"
            rows={4}
            className="w-full border border-white/20 bg-black/40 px-4 py-3"
          />
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setLogoFile(file);
                if (!file) {
                  setLogoPreview(logoUrl || "/images/owner-1.jpg");
                  return;
                }
                setLogoPreview(URL.createObjectURL(file));
              }}
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            />
            <div className="flex items-center gap-3 border border-white/15 bg-black/30 px-3 py-2">
              <div
                className="h-10 w-10 rounded-full border border-white/20 bg-cover bg-center"
                style={{ backgroundImage: `url(${logoPreview || "/images/owner-1.jpg"})` }}
              />
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Vista previa del logo</p>
            </div>
          </div>

          {user.role === "superadmin" ? (
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as "pending" | "approved" | "rejected" | "suspended",
                )
              }
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            >
              <option value="pending">Pendiente</option>
              <option value="approved">Aprobado</option>
              <option value="rejected">Rechazado</option>
              <option value="suspended">Suspendido</option>
            </select>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-zinc-100 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black hover:bg-white disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <Link
              href={`/panel/conjuntos/${conjuntoId}`}
              className="border border-white/30 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] hover:border-white"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
