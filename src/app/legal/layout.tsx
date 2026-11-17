import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/logo";

const links = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/community-rules", label: "Community Rules" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="glass sticky top-0 z-30 border-b border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Konnekt home">
            <LogoMark className="size-8 text-accent" />
            <Wordmark className="text-[1.0625rem]" />
          </Link>
          <Link href="/login" className="text-small font-semibold text-fg-muted hover:text-fg">
            Log in
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl px-5 py-8">
        {children}
        <nav aria-label="Legal documents" className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-5 text-small">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="font-medium text-accent underline-offset-2 hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-tiny text-fg-subtle">Konnekt · Verified students, one campus at a time.</p>
      </main>
    </div>
  );
}
