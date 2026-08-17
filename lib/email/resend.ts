import { Resend } from "resend";

let client: Resend | null | undefined;

export function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (client === undefined) {
    client = new Resend(key);
  }
  return client;
}

export function getEmailFrom() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Elorakart <onboarding@resend.dev>"
  );
}

/** Admin CC list: ADMIN_EMAIL + store owners, excluding the customer. */
export function getAdminCc(customerEmail?: string | null) {
  const owners = ["elorakart1@gmail.com", "elolrakart1@gmail.com"];
  const fromEnv = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const customer = (customerEmail || "").toLowerCase().trim();
  const set = new Set<string>([...fromEnv, ...owners]);
  if (customer) set.delete(customer);
  return Array.from(set);
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.info("[email] skipped (RESEND_API_KEY not set):", input.subject);
    return { skipped: true as const };
  }

  const to = input.to.trim().toLowerCase();
  if (!to) {
    console.warn("[email] skipped (no recipient):", input.subject);
    return { skipped: true as const };
  }

  const cc = getAdminCc(to);

  try {
    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: [to],
      ...(cc.length ? { cc } : {}),
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error("[email] Resend error:", error);
      void import("@/lib/logging/system-log").then(({ logError }) =>
        logError({
          category: "email",
          action: "SEND_FAILED",
          message: typeof error === "object" && error && "message" in error
            ? String((error as { message: string }).message)
            : "Resend send failed",
          meta: { to, subject: input.subject },
        })
      );
      return { ok: false as const, error };
    }
    return { ok: true as const, id: data?.id };
  } catch (err) {
    console.error("[email] send failed:", err);
    void import("@/lib/logging/system-log").then(({ logError }) =>
      logError({
        category: "email",
        action: "SEND_EXCEPTION",
        message: err instanceof Error ? err.message : "Email send exception",
        meta: { to: input.to, subject: input.subject },
      })
    );
    return { ok: false as const, error: err };
  }
}
