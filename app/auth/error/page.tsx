import Link from "next/link";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  Configuration: "Auth is misconfigured. Check Google Client ID/Secret and AUTH_SECRET.",
  AccessDenied: "Access was denied for this Google account.",
  Verification: "The sign-in link is no longer valid.",
  OAuthCallback: "Google sign-in was interrupted. Please try again.",
  OAuthAccountNotLinked: "This email is already linked to another sign-in method.",
  Default: "Sign-in failed. Please try again.",
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const code = searchParams.error || "Default";
  const message = MESSAGES[code] || MESSAGES.Default;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">Sign in</p>
      <h1 className="font-display text-4xl text-sage">Couldn’t complete login</h1>
      <p className="text-sm text-muted">{message}</p>
      {code !== "Default" && <p className="text-xs text-muted">Error code: {code}</p>}
      <div className="mt-2 flex gap-3">
        <Button asChild>
          <Link href="/">Back home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/api/auth/signin">Try Google again</Link>
        </Button>
      </div>
    </div>
  );
}
