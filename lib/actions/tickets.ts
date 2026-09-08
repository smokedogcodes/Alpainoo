"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/admin";
import { getTicketById, updateTicketFields } from "@/lib/db/tickets";
import { notifyTicketCustomerUpdate } from "@/lib/email/tickets";
import {
  deleteKnowledgeArticleDb,
  toggleKnowledgeArticleDb,
  upsertKnowledgeArticleDb,
} from "@/lib/db/knowledge";

export async function updateTicketStatus(id: string, status: string) {
  await requirePermission("tickets", "edit");
  const allowed = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  if (!allowed.includes(status)) throw new Error("Invalid status");

  const ticket = await getTicketById(id);
  if (!ticket) throw new Error("Ticket not found");

  await updateTicketFields(id, { status });
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${id}`);
  revalidatePath("/account");

  if (status !== ticket.status) {
    void notifyTicketCustomerUpdate({
      ticketNumber: ticket.ticketNumber,
      email: ticket.email,
      name: ticket.name,
      subject: ticket.subject,
      status,
      adminReply: ticket.adminReply,
      kind: "status",
    }).catch((err) => console.warn("[ticket] customer status email failed:", err));
  }
}

export async function replyToTicket(id: string, adminReply: string) {
  await requirePermission("tickets", "edit");
  const reply = adminReply.trim();
  if (!reply) throw new Error("Reply required");

  const ticket = await getTicketById(id);
  if (!ticket) throw new Error("Ticket not found");

  const nextStatus =
    ticket.status === "RESOLVED" || ticket.status === "CLOSED"
      ? ticket.status
      : "IN_PROGRESS";

  await updateTicketFields(id, { adminReply: reply, status: nextStatus });
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${id}`);
  revalidatePath("/account");

  void notifyTicketCustomerUpdate({
    ticketNumber: ticket.ticketNumber,
    email: ticket.email,
    name: ticket.name,
    subject: ticket.subject,
    status: nextStatus,
    adminReply: reply,
    kind: "reply",
  }).catch((err) => console.warn("[ticket] customer reply email failed:", err));
}

export async function upsertKnowledgeArticle(input: {
  id?: string;
  slug: string;
  title: string;
  question: string;
  answer: string;
  keywords: string;
  category: string;
  active: boolean;
}) {
  await requirePermission("knowledge", "edit");
  const keywordsJson = JSON.stringify(
    input.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
  );

  await upsertKnowledgeArticleDb({
    id: input.id,
    slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
    title: input.title.trim(),
    question: input.question.trim(),
    answer: input.answer.trim(),
    keywords: keywordsJson,
    category: input.category.trim() || "GENERAL",
    active: input.active,
  });
  revalidatePath("/admin/knowledge");
}

export async function deleteKnowledgeArticle(id: string) {
  await requirePermission("knowledge", "delete");
  await deleteKnowledgeArticleDb(id);
  revalidatePath("/admin/knowledge");
}

export async function toggleKnowledgeArticle(id: string, active: boolean) {
  await requirePermission("knowledge", "edit");
  await toggleKnowledgeArticleDb(id, active);
  revalidatePath("/admin/knowledge");
}
