import { Fragment, useMemo } from "react";

/**
 * The concierge model formats replies in markdown (bold, numbered/bulleted lists — see
 * system-prompt.ts), but replies were rendered as a plain `whitespace-pre-wrap` string, so
 * `**4GB of VRAM**` and `1.  **Display:** ...` printed literally with their `**`/`1.` markers
 * instead of being formatted (audit finding H3). This is a small, purpose-built renderer for the
 * exact subset the concierge actually emits — full markdown correctness (nested lists, tables,
 * code fences) isn't needed for a chat reply, so a dependency like react-markdown is more than
 * this surface calls for.
 */

type InlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "link"; value: string; href: string };

const INLINE_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ type: "text", value: text.slice(lastIndex, index) });
    if (match[1] !== undefined) tokens.push({ type: "bold", value: match[1] });
    else if (match[2] !== undefined && match[3] !== undefined) {
      tokens.push({ type: "link", value: match[2], href: match[3] });
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) tokens.push({ type: "text", value: text.slice(lastIndex) });
  return tokens;
}

function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, index) => {
        if (token.type === "bold") return <strong key={index}>{token.value}</strong>;
        if (token.type === "link") {
          return (
            <a key={index} href={token.href} target="_blank" rel="noopener noreferrer" className="underline">
              {token.value}
            </a>
          );
        }
        return <Fragment key={index}>{token.value}</Fragment>;
      })}
    </>
  );
}

type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "ol"; items: string[] }
  | { type: "ul"; items: string[] };

const OL_LINE = /^\s*\d+[.)]\s+(.*)$/;
const UL_LINE = /^\s*[-*]\s+(.*)$/;

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }
    if (OL_LINE.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length) {
        const match = lines[i].match(OL_LINE);
        if (!match) break;
        items.push(match[1]);
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    if (UL_LINE.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length) {
        const match = lines[i].match(UL_LINE);
        if (!match) break;
        items.push(match[1]);
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !OL_LINE.test(lines[i]) && !UL_LINE.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", lines: paraLines });
  }
  return blocks;
}

export function ConciergeMarkdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "ol") {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText text={item} />
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <InlineText text={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
