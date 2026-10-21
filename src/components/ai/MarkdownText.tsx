import { ReactNode } from "react";

/**
 * Lightweight, dependency-free markdown renderer for assistant replies.
 *
 * Renders only a safe subset (headings, paragraphs, bullet & numbered lists,
 * blockquotes, fenced/inline code, bold, italic, strikethrough, links, rules).
 * All input HTML is escaped before tokenizing, so a model reply can never
 * inject live markup or runnable content into the page.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|~~[^~\n]+~~|\[([^\]]+)\]\(([^)]+)\))/g;

function renderInline(text: string, keySeed: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keySeed}-i${k++}`;
    if (token.startsWith("**")) {
      nodes.push(<strong key={key} className="font-bold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<s key={key}>{token.slice(2, -2)}</s>);
    } else if (token.startsWith("[")) {
      nodes.push(
        <a
          key={key}
          href={m[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary underline underline-offset-2"
        >
          {m[2]}
        </a>
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderInlineMarkup(text: string, keySeed: string): ReactNode[] {
  const parts = text.split(/(`[^`\n]+`)/g);
  const nodes: ReactNode[] = [];
  let k = 0;
  parts.forEach((part, idx) => {
    const key = `${keySeed}-c${k++}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    } else if (part) {
      nodes.push(...renderInline(part, key));
    }
  });
  return nodes;
}

function isListItem(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line);
}

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const raw = lines[i];

    // Fenced code block.
    if (/^\s*```/.test(raw)) {
      const lang = raw.replace(/^\s*```/, "").trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      void lang;
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-[0.85em] leading-relaxed text-foreground"
        >
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    const trimmed = raw.trim();

    // Blank line: just advance (paragraph gathering handles breaks).
    if (trimmed === "") {
      i++;
      continue;
    }

    // Heading.
    if (isHeading(raw)) {
      const match = raw.match(/^(#{1,6})\s+(.*)$/);
      const level = match![1].length;
      const Tag = (`h${level}`) as "h1";
      const sizeClass =
        level === 1
          ? "mt-4 mb-2 text-xl font-bold tracking-tight text-foreground"
          : level === 2
            ? "mt-3.5 mb-1.5 text-lg font-bold text-foreground"
            : level === 3
              ? "mt-3 mb-1 text-base font-semibold text-foreground"
              : "mt-2 mb-1 text-sm font-semibold text-foreground";
      blocks.push(
        <Tag key={key++} className={sizeClass}>
          {renderInlineMarkup(match![2], `h${key}`)}
        </Tag>
      );
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^-{3,}\s*$/.test(trimmed) && !raw.startsWith(" ")) {
      blocks.push(<hr key={key++} className="my-3.5 border-border/80" />);
      i++;
      continue;
    }

    // Blockquote: gather consecutive quote lines.
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="mt-2.5 rounded-r-lg border-l-4 border-secondary/60 bg-surface-raised/40 py-1.5 pl-3.5 pr-3 text-sm italic text-foreground-muted"
        >
          {renderInlineMarkup(quoteLines.join(" "), `bq${key}`)}
        </blockquote>
      );
      continue;
    }

    // Lists: gather consecutive same-type list items.
    if (isListItem(raw)) {
      const ordered = /^\s*\d+[.)]\s+/.test(raw);
      const items: string[] = [];
      while (i < lines.length && isListItem(lines[i])) {
        const markerAt = lines[i].search(/\s/);
        items.push(lines[i].slice(markerAt + 1));
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={key++}
          className={`mt-2 space-y-1 pl-5 text-sm ${ordered ? "list-decimal" : "list-disc"}`}
        >
          {items.map((item, idx) => (
            <li key={`${key}-${idx}`} className="text-foreground">
              {renderInlineMarkup(item, `li${key}-${idx}`)}
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Paragraph: gather consecutive normal lines.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isHeading(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !(/-{3,}\s*$/.test(lines[i].trim()) && !lines[i].startsWith(" ")) &&
      !isListItem(lines[i]) &&
      !lines[i].trim().startsWith(">")
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={key++} className="mt-2 text-sm leading-relaxed text-foreground">
          {renderInlineMarkup(paraLines.join(" "), `p${key}`)}
        </p>
      );
    }
  }

  return <div className={className}>{blocks}</div>;
}

export default MarkdownText;