import type { Metadata } from "next";
import { EB_Garamond, Hanken_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { auth } from "@/auth";
import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
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
      <body className={`${ebGaramond.variable} ${hanken.variable} min-h-screen antialiased`}>
        <AuthProvider session={session}>
          {children}
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
