import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { DefaultSession } from "next-auth";
import {
  findUserByEmail,
  findUserById,
  updateUserRole,
  upsertUserByEmail,
} from "@/lib/db/users";

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

  const existing = await findUserById(userId);
  if (existing?.role === "ADMIN") return;
  await updateUserRole(userId, "ADMIN");
}

const useSecureCookies = process.env.AUTH_URL?.startsWith("https://") ?? false;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT-only — no PrismaAdapter (Workers cannot run Prisma). Users upserted on sign-in.
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID?.trim(),
      clientSecret: process.env.AUTH_GOOGLE_SECRET?.trim(),
      allowDangerousEmailAccountLinking: true,
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
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const dbUser = await upsertUserByEmail({
          email: user.email,
          name: user.name,
          image: user.image,
        });
        user.id = dbUser.id;
        await ensureAdminRole(dbUser.id, user.email);
      } catch (err) {
        console.error("[auth] signIn upsert failed", err);
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (process.env.NEXT_RUNTIME === "edge") {
        return token;
      }

      try {
        if (user?.email) {
          const dbUser = await upsertUserByEmail({
            email: user.email,
            name: user.name,
            image: user.image,
          });
          await ensureAdminRole(dbUser.id, user.email);
          token.sub = dbUser.id;
          if (user.name) token.name = user.name;
          if (user.email) token.email = user.email;
          if (user.image) token.picture = user.image;
        }

        if (token.sub) {
          const dbUser = await findUserById(token.sub);
          (token as { role?: string }).role = dbUser?.role || "CUSTOMER";
        } else if (token.email) {
          const dbUser = await findUserByEmail(String(token.email));
          if (dbUser) {
            token.sub = dbUser.id;
            (token as { role?: string }).role = dbUser.role;
          }
        }
      } catch {
        /* keep existing JWT on DB blips */
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
  trustHost: true,
  secret: process.env.AUTH_SECRET,
});
