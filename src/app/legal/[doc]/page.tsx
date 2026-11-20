import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isLegalDoc, LEGAL_DOCS, readLegalDoc } from "@/lib/legal";

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: isLegalDoc(doc) ? LEGAL_DOCS[doc] : "Legal" };
}

const IN_SHORT: Record<string, string> = {
  terms: "Only verified students may join. Keep posts respectful to your campus community, and delete or export your account anytime.",
  privacy: "We collect only what verifies your student status, never show your matric number publicly, and let you export or delete your data.",
  "community-rules": "Treat classmates with respect, keep academic spaces helpful, and flag spam or harassment for campus moderators.",
};

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  const document = await readLegalDoc(doc);
  if (!document) notFound();

  const summary = IN_SHORT[doc];

  return (
    <article className="prose-legal max-w-none">
      <p className="text-tiny font-bold uppercase tracking-[0.12em] text-accent-ink">Version {document.version}</p>
      {summary ? (
        <div className="mt-3 rounded-card border border-accent/20 bg-accent-soft px-4 py-3">
          <p className="text-tiny font-bold uppercase tracking-[0.08em] text-accent-ink">In short</p>
          <p className="mt-1 text-small leading-relaxed text-fg">{summary}</p>
        </div>
      ) : null}
      <div className="mt-4">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className="text-h1 text-fg">{children}</h1>,
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse text-small">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="border-b border-border px-2 py-1.5 text-left font-semibold text-fg">{children}</th>,
            td: ({ children }) => <td className="border-b border-border px-2 py-1.5 align-top text-fg-muted">{children}</td>,
            code: ({ children }) => <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">{children}</code>,
            a: ({ href, children }) => (
              <a href={href} className="text-accent-ink underline underline-offset-2">
                {children}
              </a>
            ),
          }}
        >
          {document.body}
        </ReactMarkdown>
      </div>
      {document.updated ? <p className="mt-8 text-tiny text-fg-subtle">Last updated {document.updated}.</p> : null}
    </article>
  );
}
