interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SendEmailResult {
  ok: boolean;
  provider: "resend";
  skipped: boolean;
  messageId?: string;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function resolveSender(): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) {
    return configured;
  }

  return "URBIS <onboarding@resend.dev>";
}

export async function sendEmailNotification(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) {
    return {
      ok: false,
      provider: "resend",
      skipped: true,
      error: "RESEND_API_KEY no configurado.",
    };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resolveSender(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text ?? input.subject,
      }),
    });

    if (!response.ok) {
      const rawError = await response.text();
      return {
        ok: false,
        provider: "resend",
        skipped: false,
        error: `Error al enviar correo (${response.status}): ${rawError.slice(0, 280)}`,
      };
    }

    const payload = (await response.json()) as { id?: string };
    return {
      ok: true,
      provider: "resend",
      skipped: false,
      messageId: payload.id,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "resend",
      skipped: false,
      error: error instanceof Error ? error.message : "Error desconocido al enviar correo.",
    };
  }
}

