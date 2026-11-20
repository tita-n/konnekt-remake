import Link from "next/link";
import { Fragment } from "react";

const TOKEN = /(#[\p{L}\p{N}_]{1,50})|((?:^|[^\p{L}\p{N}_@])@[a-zA-Z0-9_]{3,30})/gu;

/**
 * Hashtags and mentions become links, but the text is always escaped by React.
 * A mention is only a link — the server's audience check decides whether the
 * post itself is visible, so a mention can never widen an audience.
 */
export function RichText({ body, className }: { body: string; className?: string }) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of body.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    const raw = match[0];
    if (index > lastIndex) nodes.push(<Fragment key={key++}>{body.slice(lastIndex, index)}</Fragment>);

    if (raw.startsWith("#")) {
      nodes.push(
        <Link
          key={key++}
          href={`/hashtag/${raw.slice(1).toLowerCase()}`}
          className="font-medium text-accent-ink underline-offset-2 hover:underline"
        >
          {raw}
        </Link>,
      );
    } else {
      const prefix = raw.match(/^[^\p{L}\p{N}_@]?/u)?.[0] ?? "";
      const handle = raw.slice(prefix.length);
      if (prefix) nodes.push(<Fragment key={key++}>{prefix}</Fragment>);
      nodes.push(
        <Link
          key={key++}
          href={`/profile/${handle.slice(1).toLowerCase()}`}
          className="font-medium text-accent-ink underline-offset-2 hover:underline"
        >
          {handle}
        </Link>,
      );
    }
    lastIndex = index + raw.length;
  }
  if (lastIndex < body.length) nodes.push(<Fragment key={key++}>{body.slice(lastIndex)}</Fragment>);
  return <p className={className}>{nodes}</p>;
}
