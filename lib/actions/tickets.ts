"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/admin";

export async function updateTicketStatus(id: string, status: string) {
  await requireAdmin();
  const allowed = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  if (!allowed.includes(status)) throw new Error("Invalid status");
  await prisma.supportTicket.update({ where: { id }, data: { status } });
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${id}`);
}

export async function replyToTicket(id: string, adminReply: string) {
  await requireAdmin();
  const reply = adminReply.trim();
  if (!reply) throw new Error("Reply required");
  await prisma.supportTicket.update({
    where: { id },
    data: { adminReply: reply, status: "IN_PROGRESS" },
  });
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${id}`);
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
  await requireAdmin();
  const keywordsJson = JSON.stringify(
    input.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
  );

  const data = {
    slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
    title: input.title.trim(),
    question: input.question.trim(),
    answer: input.answer.trim(),
    keywords: keywordsJson,
    category: input.category.trim() || "GENERAL",
    active: input.active,
  };

  if (input.id) {
    await prisma.knowledgeArticle.update({ where: { id: input.id }, data });
  } else {
    await prisma.knowledgeArticle.create({ data });
  }
  revalidatePath("/admin/knowledge");
}

export async function deleteKnowledgeArticle(id: string) {
  await requireAdmin();
  await prisma.knowledgeArticle.delete({ where: { id } });
  revalidatePath("/admin/knowledge");
}

export async function toggleKnowledgeArticle(id: string, active: boolean) {
  await requireAdmin();
  await prisma.knowledgeArticle.update({ where: { id }, data: { active } });
  revalidatePath("/admin/knowledge");
}
