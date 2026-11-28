import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-5 sm:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-button" aria-label="Konnekt home">
          <LogoMark className="size-9 text-accent" />
          <Wordmark className="text-[1.125rem]" />
        </Link>
        <Link href="/legal/terms" className="inline-flex min-h-11 min-w-11 items-center px-1 text-small text-fg-subtle underline-offset-4 hover:text-fg hover:underline">
          Terms
        </Link>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 pt-8 sm:px-0 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
