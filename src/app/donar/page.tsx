import Link from "next/link";

const donationKushkiUrl = process.env.NEXT_PUBLIC_DONATION_KUSHKI_URL?.trim() ?? "";
const donationPaypalUrl = process.env.NEXT_PUBLIC_DONATION_PAYPAL_URL?.trim() ?? "";
const donationPichinchaAccountNumber =
  process.env.NEXT_PUBLIC_PICHINCHA_ACCOUNT_NUMBER?.trim() ?? "";
const donationPichinchaAccountType =
  process.env.NEXT_PUBLIC_PICHINCHA_ACCOUNT_TYPE?.trim() ?? "Cuenta de ahorros";
const donationPichinchaAccountHolder =
  process.env.NEXT_PUBLIC_PICHINCHA_ACCOUNT_HOLDER?.trim() ?? "URBIS / Linekoders";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";

export default function DonarPage() {
  return (
    <main className="min-h-screen bg-[#080b0f] px-6 py-14 text-zinc-100 lg:px-12">
      <section className="mx-auto max-w-[1100px] space-y-8">
        <div className="space-y-4">
          <Link
            href="/#apoyo"
            className="inline-block text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300 hover:text-emerald-200"
          >
            Volver a apoyo
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Donaciones URBIS
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold leading-tight text-white sm:text-6xl">
            Ayuda a que URBIS siga creciendo
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-zinc-300">
            Tu aporte nos ayuda a mantener la infraestructura, sostener servicios y acelerar mejoras para comunidades y
            emprendedores locales.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="border border-emerald-300/35 bg-emerald-300/10 p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Kushki (QR o link)</p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              Pago rapido con tarjeta o metodos habilitados. Puedes usar el enlace directo o convertirlo en QR para
              compartir.
            </p>
            {donationKushkiUrl ? (
              <a
                href={donationKushkiUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-block bg-emerald-300 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-black"
              >
                Donar con Kushki
              </a>
            ) : (
              <p className="mt-5 text-xs text-zinc-400">
                Configura NEXT_PUBLIC_DONATION_KUSHKI_URL para activar este boton.
              </p>
            )}
          </article>

          <article className="border border-cyan-300/35 bg-cyan-300/10 p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">PayPal (QR o link)</p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              Opcion internacional para aportar con cuenta PayPal o tarjeta. Tambien puedes compartir el enlace como QR.
            </p>
            {donationPaypalUrl ? (
              <a
                href={donationPaypalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-block bg-cyan-200 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#08212f]"
              >
                Donar con PayPal
              </a>
            ) : (
              <p className="mt-5 text-xs text-zinc-400">
                Configura NEXT_PUBLIC_DONATION_PAYPAL_URL para activar este boton.
              </p>
            )}
          </article>
        </div>

        <article className="border border-white/20 bg-black/30 p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Transferencia Banco Pichincha</p>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            Si prefieres transferencia directa, usa estos datos:
          </p>
          <div className="mt-4 grid gap-3 text-sm text-zinc-200 sm:grid-cols-3">
            <p>
              <span className="font-semibold">Titular:</span> {donationPichinchaAccountHolder}
            </p>
            <p>
              <span className="font-semibold">Tipo:</span> {donationPichinchaAccountType}
            </p>
            <p>
              <span className="font-semibold">Cuenta:</span>{" "}
              {donationPichinchaAccountNumber || "Pendiente de configurar"}
            </p>
          </div>
        </article>

        <article className="border border-white/20 bg-black/30 p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Otras formas de apoyo economico</p>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            Si quieres apoyar de otra forma economica, escribenos y coordinamos contigo.
          </p>
          {supportEmail ? (
            <a
              href={`mailto:${supportEmail}?subject=Apoyo%20economico%20a%20URBIS`}
              className="mt-4 inline-block text-sm font-semibold text-emerald-300 underline underline-offset-4"
            >
              {supportEmail}
            </a>
          ) : (
            <p className="mt-4 text-xs text-zinc-400">
              Configura NEXT_PUBLIC_SUPPORT_EMAIL para mostrar el correo de apoyo.
            </p>
          )}
        </article>
      </section>
    </main>
  );
}

