"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShieldIcon, StoreIcon, UserGroupIcon } from "@/components/ui-icons";
import { uploadImageFiles } from "@/lib/upload-client";

interface ConjuntoOption {
  id: string;
  name: string;
  slug: string;
  location: string;
  mapUrl?: string | null;
  distanceKm?: number | null;
}

const DRAFT_KEY = "urbis-register-draft-v2";

type Step = 1 | 2 | 3 | 4 | 5;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<"resident" | "admin_conjunto">("resident");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [conjuntoSlug, setConjuntoSlug] = useState("");
  const [conjuntoInputValue, setConjuntoInputValue] = useState("");
  const [requestedConjuntoName, setRequestedConjuntoName] = useState("");
  const [requestedConjuntoLocation, setRequestedConjuntoLocation] = useState("");
  const [requestedConjuntoMapUrl, setRequestedConjuntoMapUrl] = useState("");
  const [requestedConjuntoDescription, setRequestedConjuntoDescription] = useState("");
  const [requestedConjuntoLogoFile, setRequestedConjuntoLogoFile] = useState<File | null>(null);
  const [requestedConjuntoLogoPreview, setRequestedConjuntoLogoPreview] = useState("");

  const [conjuntos, setConjuntos] = useState<ConjuntoOption[]>([]);
  const [geoLocation, setGeoLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationFallbackCode, setVerificationFallbackCode] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedConjunto = useMemo(
    () => conjuntos.find((entry) => entry.slug === conjuntoSlug) ?? null,
    [conjuntos, conjuntoSlug],
  );

  const conjuntoOptions = useMemo(
    () =>
      conjuntos.map((conjunto) => {
        const distanceLabel =
          conjunto.distanceKm !== null && conjunto.distanceKm !== undefined
            ? ` (${conjunto.distanceKm.toFixed(1)} km)`
            : "";
        return {
          slug: conjunto.slug,
          name: conjunto.name,
          label: `${conjunto.name} - ${conjunto.location}${distanceLabel}`,
        };
      }),
    [conjuntos],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return;
    }

    try {
      const draft = JSON.parse(raw) as {
        role?: "resident" | "admin_conjunto";
        name?: string;
        email?: string;
        phone?: string;
        password?: string;
        acceptedTerms?: boolean;
        conjuntoSlug?: string;
        requestedConjuntoName?: string;
        requestedConjuntoLocation?: string;
        requestedConjuntoMapUrl?: string;
        requestedConjuntoDescription?: string;
      };
      setRole(draft.role === "admin_conjunto" ? "admin_conjunto" : "resident");
      setName(draft.name ?? "");
      setEmail(draft.email ?? "");
      setPhone(draft.phone ?? "");
      setPassword(draft.password ?? "");
      setAcceptedTerms(Boolean(draft.acceptedTerms));
      setConjuntoSlug(draft.conjuntoSlug ?? "");
      setRequestedConjuntoName(draft.requestedConjuntoName ?? "");
      setRequestedConjuntoLocation(draft.requestedConjuntoLocation ?? "");
      setRequestedConjuntoMapUrl(draft.requestedConjuntoMapUrl ?? "");
      setRequestedConjuntoDescription(draft.requestedConjuntoDescription ?? "");
    } catch {
      // Ignore malformed local drafts.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        role,
        name,
        email,
        phone,
        password,
        acceptedTerms,
        conjuntoSlug,
        requestedConjuntoName,
        requestedConjuntoLocation,
        requestedConjuntoMapUrl,
        requestedConjuntoDescription,
      }),
    );
  }, [
    acceptedTerms,
    conjuntoSlug,
    email,
    name,
    password,
    phone,
    requestedConjuntoDescription,
    requestedConjuntoLocation,
    requestedConjuntoMapUrl,
    requestedConjuntoName,
    role,
  ]);

  useEffect(() => {
    void loadConjuntos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoLocation?.latitude, geoLocation?.longitude]);

  useEffect(() => {
    return () => {
      if (avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
      if (requestedConjuntoLogoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(requestedConjuntoLogoPreview);
      }
    };
  }, [avatarPreview, requestedConjuntoLogoPreview]);

  async function loadConjuntos() {
    const params = new URLSearchParams();
    if (geoLocation) {
      params.set("latitude", String(geoLocation.latitude));
      params.set("longitude", String(geoLocation.longitude));
    }

    const query = params.toString();
    const response = await fetch(`/api/public/conjuntos${query ? `?${query}` : ""}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { conjuntos: ConjuntoOption[] };
    setConjuntos(data.conjuntos ?? []);
  }

  function updateAvatarFile(file: File | null) {
    if (avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : "");
  }

  function updateConjuntoLogoFile(file: File | null) {
    if (requestedConjuntoLogoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(requestedConjuntoLogoPreview);
    }

    setRequestedConjuntoLogoFile(file);
    setRequestedConjuntoLogoPreview(file ? URL.createObjectURL(file) : "");
  }

  function requestLocationForConjuntos() {
    if (!navigator.geolocation) {
      setError("Tu navegador no permite geolocalización.");
      return;
    }

    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setError("No se pudo obtener tu ubicación.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  function canAdvanceCurrentStep(): boolean {
    if (step === 1) {
      return Boolean(role);
    }

    if (step === 2) {
      return Boolean(name.trim() && email.trim() && phone.trim() && password.trim() && avatarFile);
    }

    if (step === 3) {
      if (role === "resident") {
        return true;
      }

      return Boolean(
        requestedConjuntoName.trim() &&
          requestedConjuntoLocation.trim() &&
          requestedConjuntoMapUrl.trim(),
      );
    }

    if (step === 4) {
      return acceptedTerms;
    }

    if (step === 5) {
      return Boolean(verificationCode.trim() && pendingVerificationEmail.trim());
    }

    return false;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLElement | null;
    const isExplicitCreate = submitter?.getAttribute("data-action") === "create-account";
    if (step !== 4 || !isExplicitCreate) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (!avatarFile) {
        setError("Debes subir una foto de perfil (rostro) para crear la cuenta.");
        setLoading(false);
        return;
      }

      const [uploadedAvatarUrl] = await uploadImageFiles([avatarFile]);
      const avatarUrl = uploadedAvatarUrl ?? "";
      if (!avatarUrl) {
        setError("No se pudo guardar tu foto de perfil.");
        setLoading(false);
        return;
      }

      let requestedConjuntoLogoUrl = "";
      if (role === "admin_conjunto" && requestedConjuntoLogoFile) {
        const [uploadedUrl] = await uploadImageFiles([requestedConjuntoLogoFile]);
        requestedConjuntoLogoUrl = uploadedUrl ?? "";
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name,
          email,
          phone,
          password,
          avatarUrl,
          conjuntoSlug,
          acceptedTerms,
          requestedConjuntoName,
          requestedConjuntoLocation,
          requestedConjuntoMapUrl,
          requestedConjuntoDescription,
          requestedConjuntoLogoUrl,
          isIndependent: role === "resident" && !conjuntoSlug,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        requiresEmailVerification?: boolean;
        verificationFallbackCode?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "No se pudo crear la cuenta.");
        return;
      }

      setPendingVerificationEmail(email.trim().toLowerCase());
      setVerificationFallbackCode(data.verificationFallbackCode ?? "");
      setStep(5);
    } catch {
      setError("Ocurrió un error al crear la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingVerificationEmail,
          code: verificationCode,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo verificar el correo.");
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DRAFT_KEY);
      }
      router.push("/productos?scope=my_conjunto");
      router.refresh();
    } catch {
      setError("No se pudo verificar el correo.");
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    if (!canAdvanceCurrentStep()) {
      setError("Completa los campos requeridos para continuar.");
      return;
    }
    setError("");
    setStep((current) => (current < 4 ? ((current + 1) as Step) : current));
  }

  function prevStep() {
    setError("");
    setStep((current) => (current > 1 && current <= 4 ? ((current - 1) as Step) : current));
  }

  return (
    <main className="urbis-watermark flex min-h-screen items-center justify-center bg-[#070b10] px-6 py-16 text-zinc-100">
      <div className="fade-up w-full max-w-3xl border border-white/10 bg-black/35 p-8 backdrop-blur-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Registro URBIS</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold sm:text-5xl">
          Crear cuenta
        </h1>
        <p className="mt-4 text-zinc-300">Registro por pasos con verificación de correo electrónico.</p>

        <div className="mt-6 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <div
              key={value}
              className={`h-1.5 ${step >= value ? "bg-emerald-300" : "bg-white/20"}`}
            />
          ))}
        </div>

        {step < 5 ? (
          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            {step === 1 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRole("resident")}
                  className={`border p-4 text-left transition ${role === "resident" ? "border-emerald-300 bg-emerald-300/10" : "border-white/20 bg-black/25 hover:border-white/40"}`}
                >
                  <UserGroupIcon className="h-6 w-6 text-emerald-300" />
                  <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-white">Residente</p>
                  <p className="mt-1 text-sm text-zinc-300">Compra, publica y vende en tu conjunto.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin_conjunto")}
                  className={`border p-4 text-left transition ${role === "admin_conjunto" ? "border-emerald-300 bg-emerald-300/10" : "border-white/20 bg-black/25 hover:border-white/40"}`}
                >
                  <ShieldIcon className="h-6 w-6 text-cyan-300" />
                  <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-white">Administrador de conjunto</p>
                  <p className="mt-1 text-sm text-zinc-300">Solicita el alta y luego gestiona tu comunidad.</p>
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm uppercase tracking-wider text-zinc-300">Nombre completo</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                    required
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm uppercase tracking-wider text-zinc-300">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm uppercase tracking-wider text-zinc-300">Teléfono</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Ej: 0991234567"
                      className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                      required
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm uppercase tracking-wider text-zinc-300">Contraseña</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                    required
                  />
                </label>
                <div className="space-y-3 border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">Foto de perfil</p>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={(event) => updateAvatarFile(event.target.files?.[0] ?? null)}
                    className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                    required
                  />
                  <div className="flex items-center gap-3 border border-white/20 bg-black/25 px-3 py-2">
                    <div
                      className="h-12 w-12 rounded-full border border-white/20 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${avatarPreview || "/images/owner-1.jpg"})`,
                      }}
                    />
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Vista previa</p>
                  </div>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              role === "resident" ? (
                <div className="space-y-4 border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                      Selecciona tu conjunto
                    </p>
                    <button
                      type="button"
                      onClick={requestLocationForConjuntos}
                      disabled={locating}
                      className="border border-emerald-300/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 disabled:opacity-60"
                    >
                      {locating ? "Ubicando..." : "Usar mi ubicación"}
                    </button>
                  </div>

                  <input
                    list="urbis-conjuntos-options"
                    value={
                      conjuntoInputValue ||
                      (selectedConjunto
                        ? `${selectedConjunto.name} - ${selectedConjunto.location}${
                            selectedConjunto.distanceKm !== null && selectedConjunto.distanceKm !== undefined
                              ? ` (${selectedConjunto.distanceKm.toFixed(1)} km)`
                              : ""
                          }`
                        : "")
                    }
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setConjuntoInputValue(nextValue);

                      const normalized = nextValue.trim().toLowerCase();
                      const match = conjuntoOptions.find(
                        (option) =>
                          option.label.toLowerCase() === normalized ||
                          option.name.toLowerCase() === normalized,
                      );

                      setConjuntoSlug(match?.slug ?? "");
                    }}
                    placeholder="Selecciona o busca tu conjunto"
                    className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                    required
                  />
                  <datalist id="urbis-conjuntos-options">
                    {conjuntoOptions.map((option) => (
                      <option key={option.slug} value={option.label} />
                    ))}
                  </datalist>
                  <p className="text-xs text-zinc-400">
                    Buscalo y seleccionalo desde este mismo campo. Si no perteneces a un conjunto, puedes continuar sin seleccionar.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setConjuntoSlug("");
                      setConjuntoInputValue("");
                    }}
                    className="inline-block text-xs uppercase tracking-[0.12em] text-amber-300 underline"
                  >
                    Continuar sin conjunto (perfil no verificado)
                  </button>
                  {selectedConjunto?.mapUrl ? (
                    <a
                      href={selectedConjunto.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs text-cyan-300 underline"
                    >
                      Ver conjunto seleccionado en mapa
                    </a>
                  ) : null}
                  {!conjuntoSlug ? (
                    <p className="text-xs text-amber-300">
                      Publicaras como emprendedor no verificado hasta que un conjunto valide tu perfil.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3 border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <StoreIcon className="h-5 w-5 text-cyan-300" />
                    <span>Datos del conjunto a registrar</span>
                  </div>
                  <input
                    value={requestedConjuntoName}
                    onChange={(event) => setRequestedConjuntoName(event.target.value)}
                    placeholder="Nombre del conjunto"
                    className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                    required
                  />
                  <input
                    value={requestedConjuntoLocation}
                    onChange={(event) => setRequestedConjuntoLocation(event.target.value)}
                    placeholder="Ubicación referencial"
                    className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                    required
                  />
                  <input
                    value={requestedConjuntoMapUrl}
                    onChange={(event) => setRequestedConjuntoMapUrl(event.target.value)}
                    placeholder="Enlace completo de Google Maps"
                    className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                    required
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => updateConjuntoLogoFile(event.target.files?.[0] ?? null)}
                    className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                  />
                  <div className="flex items-center gap-3 border border-white/20 bg-black/25 px-3 py-2">
                    <div
                      className="h-10 w-10 rounded-full border border-white/20 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${requestedConjuntoLogoPreview || "/images/owner-1.jpg"})`,
                      }}
                    />
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Vista previa del logo</p>
                  </div>
                  <textarea
                    value={requestedConjuntoDescription}
                    onChange={(event) => setRequestedConjuntoDescription(event.target.value)}
                    placeholder="Descripción breve del conjunto"
                    rows={3}
                    className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                  />
                </div>
              )
            ) : null}

            {step === 4 ? (
              <label className="flex items-start gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-400"
                  required
                />
                <span>
                  Acepto los{" "}
                  <Link
                    href="/terminos-y-condiciones"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 hover:text-emerald-200"
                  >
                    términos y condiciones
                  </Link>{" "}
                  de URBIS.
                </span>
              </label>
            ) : null}

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="border border-white/30 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] hover:border-white"
                >
                  Atrás
                </button>
              ) : null}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-zinc-100 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-white"
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="submit"
                  data-action="create-account"
                  disabled={loading}
                  className="bg-zinc-100 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-white disabled:opacity-70"
                >
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </button>
              )}
            </div>
          </form>
        ) : (
          <form className="mt-8 grid gap-4" onSubmit={submitVerification}>
            <p className="text-zinc-300">
              Te enviamos un código de verificación a <strong>{pendingVerificationEmail}</strong>.
            </p>
            <input
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              placeholder="Código de 6 dígitos"
              className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
              required
            />
            {verificationFallbackCode ? (
              <p className="text-xs text-amber-300">
                Código de respaldo (desarrollo): {verificationFallbackCode}
              </p>
            ) : null}
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="bg-zinc-100 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-white disabled:opacity-70"
            >
              {loading ? "Verificando..." : "Verificar correo"}
            </button>
          </form>
        )}

        <div className="mt-8 flex flex-wrap gap-4 text-sm uppercase tracking-[0.12em] text-zinc-300">
          <Link href="/auth/login" className="hover:text-white">
            Ya tengo cuenta
          </Link>
          <Link href="/" className="hover:text-white">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}

