import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

async function ensureAdminRole(userId: string, email: string | null | undefined) {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || !email) return "CUSTOMER";
  if (email.toLowerCase() === adminEmail) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
    });
    return "ADMIN";
  }
  return undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  // JWT keeps /admin middleware Edge-compatible (no Prisma in middleware)
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const role = await ensureAdminRole(user.id, user.email);
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        (token as { role?: string }).role = role || dbUser?.role || "CUSTOMER";
        token.sub = user.id;
        if (user.image) {
          await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl: user.image },
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.role = (token as { role?: string }).role || "CUSTOMER";
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureAdminRole(user.id, user.email);
        if (user.image) {
          await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl: user.image },
          });
        }
      }
    },
  },
  trustHost: true,
});
