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
  const to = admins[0] || process.env.ADMIN_EMAIL?.split(",")[0]?.trim();
  if (!to) {
    console.info("[email] ticket notify skipped (no admin)");
    return;
  }

  const due = input.dueAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
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

  await sendTransactionalEmail({ to, subject, html, text });
}
