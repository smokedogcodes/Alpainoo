import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cream: "var(--cream)",
        "off-white": "var(--off-white)",
        blush: "var(--blush)",
        "blush-soft": "var(--blush-soft)",
        sage: {
          DEFAULT: "var(--sage)",
          muted: "var(--sage-muted)",
        },
        terracotta: "var(--terracotta)",
        sale: "var(--sale)",
        "price-sale": "var(--price-sale)",
        muted: "var(--muted)",
        border: "var(--border)",
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
      },
      maxWidth: {
        store: "72rem",
      },
    },
  },
  plugins: [],
};
export default config;
