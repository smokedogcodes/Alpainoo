import { sendTransactionalEmail, getAdminCc } from "@/lib/email/resend";

export async function notifyTicketCreated(input: {
  ticketNumber: string;
  email: string;
  name?: string | null;
  subject: string;
  description: string;
  tatHours: number;
  dueAt: Date;
}) {
  const admins = getAdminCc();
  const adminTo = admins[0] || process.env.ADMIN_EMAIL?.split(",")[0]?.trim();
  const due = input.dueAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  if (adminTo) {
    const subject = `[Ticket ${input.ticketNumber}] ${input.subject}`;
    const text = `New support ticket ${input.ticketNumber}
From: ${input.name || "Customer"} <${input.email}>
TAT: ${input.tatHours}h (due ${due})

${input.description}

Open Admin → Tickets to reply.`;

    const html = `<p><strong>New support ticket ${input.ticketNumber}</strong></p>
<p>From: ${input.name || "Customer"} &lt;${input.email}&gt;<br/>
TAT: ${input.tatHours}h (due ${due})</p>
<p>${input.description.replace(/\n/g, "<br/>")}</p>
<p>Open Admin → Tickets to reply and view chat history.</p>`;

    await sendTransactionalEmail({ to: adminTo, subject, html, text });
  } else {
    console.info("[email] ticket admin notify skipped (no admin)");
  }

  // Confirmation to the customer (skip placeholder guest addresses)
  const customerEmail = input.email.trim().toLowerCase();
  if (customerEmail && !customerEmail.endsWith("@alpainoo.local")) {
    const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
    const subject = `[Ticket ${input.ticketNumber}] We received your request`;
    const text = `${greeting}

We created support ticket ${input.ticketNumber} for "${input.subject}".
Our team aims to respond within ${input.tatHours} hours (by ${due}).

Track updates anytime at ${appUrl}/account after signing in.

— Alpainoo Support`;
    const html = `<p>${greeting}</p>
<p>We created support ticket <strong>${escapeHtml(input.ticketNumber)}</strong> for <em>${escapeHtml(input.subject)}</em>.</p>
<p>Our team aims to respond within <strong>${input.tatHours} hours</strong> (by ${escapeHtml(due)}).</p>
<p>Track updates anytime on your <a href="${appUrl}/account">Account</a> page after signing in.</p>
<p>— Alpainoo Support</p>`;
    await sendTransactionalEmail({ to: customerEmail, subject, html, text });
  }
}

/** Notify the customer when admin replies or changes status. */
export async function notifyTicketCustomerUpdate(input: {
  ticketNumber: string;
  email: string;
  name?: string | null;
  subject: string;
  status: string;
  adminReply?: string | null;
  kind: "reply" | "status";
}) {
  const to = input.email.trim().toLowerCase();
  if (!to || to.endsWith("@alpainoo.local")) {
    console.info("[email] ticket customer notify skipped (no real email)");
    return;
  }

  const statusLabel = input.status.replaceAll("_", " ");
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const replyBlock = input.adminReply?.trim()
    ? `\n\nSupport reply:\n${input.adminReply.trim()}`
    : "";

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const subject =
    input.kind === "reply"
      ? `[Ticket ${input.ticketNumber}] New reply from Alpainoo support`
      : `[Ticket ${input.ticketNumber}] Status: ${statusLabel}`;

  const text = `${greeting}

Your support ticket ${input.ticketNumber} (${input.subject}) is now ${statusLabel}.${replyBlock}

You can also review this ticket anytime in your Account page after signing in: ${appUrl}/account

— Alpainoo Support`;

  const html = `<p>${greeting}</p>
<p>Your support ticket <strong>${escapeHtml(input.ticketNumber)}</strong> (${escapeHtml(input.subject)}) is now <strong>${escapeHtml(statusLabel)}</strong>.</p>
${
  input.adminReply?.trim()
    ? `<p><strong>Support reply:</strong></p><p>${escapeHtml(input.adminReply.trim()).replace(/\n/g, "<br/>")}</p>`
    : ""
}
<p>You can also review this ticket anytime on your <a href="${appUrl}/account">Account</a> page after signing in.</p>
<p>— Alpainoo Support</p>`;

  await sendTransactionalEmail({ to, subject, html, text });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
