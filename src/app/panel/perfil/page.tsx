"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FullScreenSpinner, Spinner } from "@/components/spinner";

type SubscriptionPlan = "basic" | "plus";
type SubscriptionStatus = "inactive" | "pending" | "active";
type PaymentMethod = "kushki" | "paypal";

interface ProfilePayload {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: "resident" | "admin_conjunto" | "superadmin";
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPaymentMethod: string | null;
  subscriptionUpdatedAt: string | null;
}

interface PaymentOptions {
  kushkiUrl: string;
  paypalUrl: string;
  supportEmail: string;
  supportPhone: string;
  supportPhoneAlt: string;
}

const paymentLabels: Record<PaymentMethod, string> = {
  kushki: "Kushki",
  paypal: "PayPal",
};

function statusLabel(status: SubscriptionStatus): string {
  if (status === "active") return "Activa";
  if (status === "pending") return "Pendiente";
  return "Sin activar";
}

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<SubscriptionPlan>("basic");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("kushki");

  const selectedPaymentHref = useMemo(() => {
    if (!paymentOptions) {
      return "";
    }

    if (paymentMethod === "kushki") {
      return paymentOptions.kushkiUrl;
    }

    return paymentOptions.paypalUrl;
  }, [paymentMethod, paymentOptions]);

  useEffect(() => {
    async function loadProfile() {
      const response = await fetch("/api/user/profile", { cache: "no-store" });
      if (!response.ok) {
        setError("No se pudo cargar tu perfil. Inicia sesión e inténtalo de nuevo.");
        setLoading(false);
        return;
      }

      const data = (await response.json()) as {
        profile: ProfilePayload;
        paymentOptions: PaymentOptions;
      };

      setProfile(data.profile);
      setPaymentOptions(data.paymentOptions);
      setName(data.profile.name);
      setPhone(data.profile.phone ?? "");
      setPlan(data.profile.subscriptionPlan);
      setPaymentMethod(data.profile.subscriptionPaymentMethod === "paypal" ? "paypal" : "kushki");
      setLoading(false);
    }

    void loadProfile();
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        subscriptionPlan: plan,
        paymentMethod: plan === "plus" ? paymentMethod : undefined,
      }),
    });

    const data = (await response.json()) as {
      error?: string;
      message?: string;
      profile?: ProfilePayload;
      paymentOptions?: PaymentOptions;
    };

    if (!response.ok || !data.profile) {
      setError(data.error ?? "No se pudo guardar el perfil.");
      setSaving(false);
      return;
    }

    setProfile(data.profile);
    setPaymentOptions(data.paymentOptions ?? paymentOptions);
    setMessage(data.message ?? "Perfil actualizado.");
    setSaving(false);
  }

  if (loading) {
    return <FullScreenSpinner label="Cargando perfil" />;
  }

  if (!profile || !paymentOptions) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-xl border border-white/10 bg-black/30 p-8">
          <p className="text-zinc-300">{error || "No se pudo cargar el perfil."}</p>
          <Link href="/auth/login" className="mt-4 inline-block text-emerald-300 hover:text-emerald-200">
            Ir a iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b10] px-6 py-10 text-zinc-100 lg:px-12 urbis-watermark">
      <section className="mx-auto max-w-4xl space-y-8">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Mi perfil</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
            Editar perfil y suscripción
          </h1>
          <p className="mt-2 text-sm text-zinc-300">
            Plan actual: <strong className="text-white">{profile.subscriptionPlan.toUpperCase()}</strong> · Estado:{" "}
            <strong className="text-white">{statusLabel(profile.subscriptionStatus)}</strong>
          </p>
        </header>

        <form onSubmit={saveProfile} className="space-y-6 border border-white/10 bg-black/25 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-400">Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-400">Teléfono</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                placeholder="Ej: 0991234567"
              />
            </label>
          </div>

          <article className="space-y-4 border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Plan de suscripción</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`border p-4 ${plan === "basic" ? "border-emerald-300 bg-emerald-300/10" : "border-white/20 bg-black/25"}`}>
                <input
                  type="radio"
                  name="subscriptionPlan"
                  checked={plan === "basic"}
                  onChange={() => setPlan("basic")}
                  className="mr-2 accent-emerald-400"
                />
                Básico (gratis)
              </label>
              <label className={`border p-4 ${plan === "plus" ? "border-cyan-300 bg-cyan-300/10" : "border-white/20 bg-black/25"}`}>
                <input
                  type="radio"
                  name="subscriptionPlan"
                  checked={plan === "plus"}
                  onChange={() => setPlan("plus")}
                  className="mr-2 accent-cyan-300"
                />
                Plus (con pago)
              </label>
            </div>

            {plan === "plus" ? (
              <div className="space-y-4 border border-cyan-300/25 bg-cyan-300/5 p-4">
                <p className="text-sm text-zinc-200">
                  Selecciona el método de pago digital. Para suscripción no recibimos transferencias directas a cuenta.
                </p>

                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  <option value="kushki">{paymentLabels.kushki}</option>
                  <option value="paypal">{paymentLabels.paypal}</option>
                </select>

                <div>
                  {selectedPaymentHref ? (
                    <a
                      href={selectedPaymentHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block border border-cyan-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200 hover:bg-cyan-500/10"
                    >
                      Ir a pagar con {paymentLabels[paymentMethod]}
                    </a>
                  ) : (
                    <p className="text-xs text-zinc-400">
                      Configura el enlace de {paymentLabels[paymentMethod]} en variables de entorno.
                    </p>
                  )}
                </div>

                <div className="space-y-1 text-xs text-zinc-300">
                  <p>
                    Si requieren hacer transferencia bancaria, comuníquense con nosotros por correo o números de soporte.
                  </p>
                  {paymentOptions.supportEmail ? (
                    <p>
                      Correo: {" "}
                      <a
                        href={`mailto:${paymentOptions.supportEmail}?subject=Solicitud%20Plan%20Plus%20URBIS`}
                        className="text-emerald-300 underline"
                      >
                        {paymentOptions.supportEmail}
                      </a>
                    </p>
                  ) : null}
                  {paymentOptions.supportPhone ? <p>Número 1: {paymentOptions.supportPhone}</p> : null}
                  {paymentOptions.supportPhoneAlt ? <p>Número 2: {paymentOptions.supportPhoneAlt}</p> : null}
                </div>
              </div>
            ) : null}
          </article>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-zinc-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-black hover:bg-white disabled:opacity-60"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="sm" className="text-black" />
                  Guardando...
                </span>
              ) : (
                "Guardar perfil"
              )}
            </button>

            <Link
              href="/panel"
              className="border border-white/30 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] hover:border-white"
            >
              Volver al panel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
