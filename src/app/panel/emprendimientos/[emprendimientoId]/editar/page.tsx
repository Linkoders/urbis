"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { uploadImageFiles } from "@/lib/upload-client";

interface SessionUser {
  id: string;
  role: "resident" | "admin_conjunto" | "superadmin";
}

interface EmprendimientoData {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  visibility: "public" | "internal";
  contactEmail: string | null;
  contactPhone: string | null;
}

export default function EditEmprendimientoPage() {
  const router = useRouter();
  const params = useParams<{ emprendimientoId: string }>();
  const emprendimientoId = String(params?.emprendimientoId ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");

  useEffect(() => {
    async function loadData() {
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
        emprendimiento: EmprendimientoData;
      };

      setUser(data.user);
      setName(data.emprendimiento.name);
      setDescription(data.emprendimiento.description);
      setLogoUrl(data.emprendimiento.logoUrl ?? "");
      setLogoPreview(data.emprendimiento.logoUrl ?? "/images/market-woman.jpg");
      setContactEmail(data.emprendimiento.contactEmail ?? "");
      setContactPhone(data.emprendimiento.contactPhone ?? "");
      setVisibility(data.emprendimiento.visibility);
      setLoading(false);
    }

    void loadData();
  }, [emprendimientoId]);

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
        action: "update_emprendimiento",
        data: {
          emprendimientoId,
          name,
          description,
          logoUrl: finalLogoUrl,
          contactEmail,
          contactPhone,
          visibility,
        },
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "No se pudo actualizar.");
      setSaving(false);
      return;
    }

    router.push(`/panel/emprendimientos/${emprendimientoId}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] text-zinc-100">
        <p className="text-zinc-300">Cargando formulario...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-xl border border-white/10 bg-black/30 p-8">
          <p className="text-zinc-300">{error || "No autorizado."}</p>
          <Link href="/panel" className="mt-4 inline-block text-emerald-300 hover:text-emerald-200">
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b10] px-6 py-10 text-zinc-100 lg:px-12 urbis-watermark">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Editar emprendimiento</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
            Actualiza datos y contacto
          </h1>
        </header>

        <form onSubmit={submit} className="space-y-4 border border-white/10 bg-black/25 p-6">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del emprendimiento"
            className="w-full border border-white/20 bg-black/40 px-4 py-3"
            required
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descripción"
            rows={4}
            className="w-full border border-white/20 bg-black/40 px-4 py-3"
            required
          />
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setLogoFile(file);
                if (!file) {
                  setLogoPreview(logoUrl || "/images/market-woman.jpg");
                  return;
                }
                setLogoPreview(URL.createObjectURL(file));
              }}
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            />
            <div className="flex items-center gap-3 border border-white/15 bg-black/30 px-3 py-2">
              <div
                className="h-10 w-10 rounded-full border border-white/20 bg-cover bg-center"
                style={{ backgroundImage: `url(${logoPreview || "/images/market-woman.jpg"})` }}
              />
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Vista previa del logo</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="Email de contacto"
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            />
            <input
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="Teléfono de contacto"
              className="w-full border border-white/20 bg-black/40 px-4 py-3"
            />
          </div>
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as "public" | "internal")}
            className="w-full border border-white/20 bg-black/40 px-4 py-3"
          >
            <option value="public">Visible para todos</option>
            <option value="internal">Solo visible en el conjunto</option>
          </select>

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
              href={`/panel/emprendimientos/${emprendimientoId}`}
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
