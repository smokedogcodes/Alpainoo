import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { DefaultSession } from "next-auth";
import {
  findUserByEmail,
  findUserById,
  markEmailVerified,
  updateUserRole,
  upsertUserByEmail,
} from "@/lib/db/users";
import { verifyEmailLoginTicket } from "@/lib/auth/email-login-ticket";
import { resolvePermissionMatrix } from "@/lib/auth/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      permissions: string;
      roleExpiresAt: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    permissions?: string;
    roleExpiresAt?: string | null;
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

function applyUserTokenFields(
  token: Record<string, unknown>,
  dbUser: {
    role: string;
    permissions: string;
    roleExpiresAt: Date | null;
  }
) {
  const resolved = resolvePermissionMatrix({
    role: dbUser.role,
    permissionsJson: dbUser.permissions,
    roleExpiresAt: dbUser.roleExpiresAt,
  });
  token.role = resolved.expired ? "CUSTOMER" : dbUser.role;
  token.permissions = dbUser.permissions || "[]";
  token.roleExpiresAt = dbUser.roleExpiresAt
    ? dbUser.roleExpiresAt.toISOString()
    : null;
}

const useSecureCookies = process.env.AUTH_URL?.startsWith("https://") ?? false;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT-only — no PrismaAdapter. Users upserted by email on sign-in.
  // Email OTP creates the same User row; later Google login matches by email.
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID?.trim(),
      clientSecret: process.env.AUTH_GOOGLE_SECRET?.trim(),
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        ticket: { label: "Ticket", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "")
          .trim()
          .toLowerCase();
        const ticket = String(credentials?.ticket || "");
        if (!email || !ticket) return null;
        const verified = verifyEmailLoginTicket(ticket, email);
        if (!verified) return null;
        const user = await findUserById(verified.userId);
        if (!user || user.email.toLowerCase() !== email) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
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
    async signIn({ user, account }) {
      if (!user.email) return false;
      try {
        const dbUser = await upsertUserByEmail({
          email: user.email,
          name: user.name,
          image: user.image,
        });
        user.id = dbUser.id;
        if (account?.provider === "google" || account?.provider === "email-otp") {
          await markEmailVerified(dbUser.id);
        }
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
          if (dbUser) applyUserTokenFields(token as Record<string, unknown>, dbUser);
          else (token as Record<string, unknown>).role = "CUSTOMER";
        } else if (token.email) {
          const dbUser = await findUserByEmail(String(token.email));
          if (dbUser) {
            token.sub = dbUser.id;
            applyUserTokenFields(token as Record<string, unknown>, dbUser);
          }
        }
      } catch {
        /* keep existing JWT on DB blips */
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const t = token as Record<string, unknown>;
        session.user.id = (token.sub as string) || "";
        session.user.role = typeof t.role === "string" ? t.role : "CUSTOMER";
        session.user.permissions =
          typeof t.permissions === "string" ? t.permissions : "[]";
        session.user.roleExpiresAt =
          typeof t.roleExpiresAt === "string" ? t.roleExpiresAt : null;
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
