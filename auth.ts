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

/**
 * Optional first-time bootstrap only: promote matching emails while still CUSTOMER.
 * Ongoing role changes happen via DB /admin/users.
 * Includes store-owner Google accounts that may differ from seed spelling.
 */
function bootstrapAdminEmails(): Set<string> {
  const fromEnv = [
    process.env.ADMIN_EMAIL,
    ...(process.env.ADMIN_EMAILS || "").split(","),
  ];
  const owners = ["elorakart1@gmail.com", "elolrakart1@gmail.com"];
  return new Set(
    [...fromEnv, ...owners]
      .map((e) => e?.toLowerCase().trim())
      .filter((e): e is string => Boolean(e))
  );
}

async function ensureAdminRole(userId: string, email: string | null | undefined) {
  if (!email) return;
  const allowed = bootstrapAdminEmails();
  if (!allowed.has(email.toLowerCase().trim())) return;

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (existing?.role === "ADMIN") return;

  await prisma.user.update({
    where: { id: userId },
    data: { role: "ADMIN" },
  });
}

const useSecureCookies = process.env.AUTH_URL?.startsWith("https://") ?? false;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID?.trim(),
      clientSecret: process.env.AUTH_GOOGLE_SECRET?.trim(),
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  cookies: {
    pkceCodeVerifier: {
      name: `${useSecureCookies ? "__Secure-" : ""}authjs.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
    state: {
      name: `${useSecureCookies ? "__Secure-" : ""}authjs.state`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
    callbackUrl: {
      name: `${useSecureCookies ? "__Secure-" : ""}authjs.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `${useSecureCookies ? "__Host-" : ""}authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      // Prisma cannot run in Edge middleware — keep role already embedded in the JWT there.
      if (process.env.NEXT_RUNTIME === "edge") {
        return token;
      }

      if (user?.id) {
        await ensureAdminRole(user.id, user.email);
        token.sub = user.id;
        if (user.name) token.name = user.name;
        if (user.email) token.email = user.email;
        if (user.image) {
          token.picture = user.image;
          await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl: user.image },
          });
        }
      }

      // Re-read role from DB on Node so demotions/promotions take effect
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true },
        });
        (token as { role?: string }).role = dbUser?.role || "CUSTOMER";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.role = (token as { role?: string }).role || "CUSTOMER";
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;
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
  secret: process.env.AUTH_SECRET,
});
