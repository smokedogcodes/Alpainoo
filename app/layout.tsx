import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { auth } from "@/auth";
import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

// Stable Google fonts for Vercel builds (same CSS vars as Stitch tokens)
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Elorakart — Botanical Beauty & Skincare",
    template: "%s | Elorakart",
  },
  description: "Your ultimate online skincare destination for serums, haircare, and fragrances.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} min-h-screen antialiased`}>
        <AuthProvider session={session}>
          {children}
          <Toaster richColors position="top-center" />
          {process.env.VERCEL === "1" ? <Analytics /> : null}
        </AuthProvider>
      </body>
    </html>
  );
}
