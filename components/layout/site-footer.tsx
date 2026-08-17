import Link from "next/link";
import { opaqueHref } from "@/lib/security/opaque-routes";

function Icon({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <a href="#" aria-label={label} className="hover:text-sage">
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-0 border-t border-border/30 bg-surface-container">
      <div className="mx-auto grid max-w-store gap-10 px-4 py-14 md:grid-cols-3 md:px-6">
        <div>
          <p className="font-display text-3xl tracking-tight text-sage">Elorakart</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            123 Promenade Street
            <br />
            California, CA 12345
          </p>
          <p className="mt-3 text-sm text-muted">contactus@elorakart.com</p>
          <ul className="mt-4 flex flex-wrap gap-3 text-sm text-muted">
            <li><Link href={opaqueHref("/sale")} className="font-medium text-price-sale hover:underline">Sale</Link></li>
            <li><Link href={opaqueHref("/products")} className="hover:underline hover:text-sage">Shop</Link></li>
            <li><Link href={opaqueHref("/blog")} className="hover:underline hover:text-sage">Blog</Link></li>
            <li><Link href={opaqueHref("/about")} className="hover:underline hover:text-sage">About</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-display text-xl text-sage">Social Media</p>
          <div className="mt-4 flex gap-4 text-foreground/80">
            <Icon label="Facebook">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H8v3h3v7h3v-7h3l1-3h-4V9c0-.6.4-1 1-1z" />
              </svg>
            </Icon>
            <Icon label="Pinterest">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.8 6.3 9.2-.1-.8-.2-2 0-2.9.2-.8 1.3-5.5 1.3-5.5s-.3-.7-.3-1.6c0-1.5.9-2.6 2-2.6.9 0 1.4.7 1.4 1.5 0 .9-.6 2.3-.9 3.5-.3 1.1.5 1.9 1.5 1.9 1.8 0 3.2-1.9 3.2-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.6 2.1-4.6 4.4 0 .9.3 1.8.8 2.3.1.1.1.2.1.3l-.3 1.1c0 .2-.1.2-.3.1-1.2-.6-2-2.3-2-3.7 0-3 2.2-5.8 6.3-5.8 3.3 0 5.9 2.4 5.9 5.5 0 3.3-2.1 6-4.9 6-1 0-1.9-.5-2.2-1.1l-.6 2.3c-.2.8-.8 1.8-1.2 2.4 1 .3 2 .5 3.1.5 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
              </svg>
            </Icon>
            <Icon label="Instagram">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </Icon>
          </div>
        </div>
        <div>
          <p className="font-display text-xl text-sage">Newsletter</p>
          <p className="mt-2 text-sm text-muted">Sign up to receive botanical beauty tips.</p>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              placeholder="Email"
              className="h-11 flex-1 rounded border border-border/50 bg-white px-3 text-sm"
            />
            <button type="submit" className="h-11 rounded bg-sage px-5 text-xs font-semibold uppercase tracking-widest text-white hover:bg-sage-muted">
              Sign Up
            </button>
          </form>
        </div>
      </div>
      <div className="flex flex-col items-center justify-between gap-2 border-t border-border/40 px-4 py-4 text-xs uppercase tracking-widest text-muted sm:flex-row md:px-6">
        <p>© {new Date().getFullYear()} Elorakart. All rights reserved.</p>
        <div className="flex gap-4">
          <Link href={opaqueHref("/about")}>Privacy Policy</Link>
          <Link href={opaqueHref("/about")}>Terms</Link>
        </div>
      </div>
    </footer>
  );
}
