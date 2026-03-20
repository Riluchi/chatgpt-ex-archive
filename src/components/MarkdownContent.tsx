import type { ReactNode } from "react";

interface MarkdownContentProps {
  text: string;
  terms?: string[];
}

export default function MarkdownContent({
  text,
  terms = [],
}: MarkdownContentProps) {
  const blocks = parseBlocks(text);

  return (
    <div className="markdown-content">
      {blocks.map((block, index) => renderBlock(block, terms, index))}
    </div>
  );
}

type MarkdownBlock =
  | { type: "code"; language: string; content: string }
  | { type: "heading"; level: number; content: string }
  | { type: "hr" }
  | { type: "blockquote"; lines: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "checklist"; items: { checked: boolean; content: string }[] }
  | { type: "paragraph"; content: string };

function parseBlocks(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({
        type: "code",
        language,
        content: codeLines.join("\n"),
      });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = splitTableLine(lines[index]);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) {
        const row = splitTableLine(lines[index]);
        if (row.length === 0) {
          break;
        }
        rows.push(row);
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const checklistMatch = trimmed.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (checklistMatch) {
      const items: { checked: boolean; content: string }[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = current.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/);
        if (!match) {
          break;
        }
        items.push({
          checked: match[1].toLowerCase() === "x",
          content: match[2],
        });
        index += 1;
      }
      blocks.push({ type: "checklist", items });
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = ordered
          ? current.match(/^\d+\.\s+(.*)$/)
          : current.match(/^[-*]\s+(.*)$/);
        if (!match) {
          break;
        }
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      if (!current.trim()) {
        break;
      }
      if (
        current.trim().startsWith("```") ||
        current.trim().startsWith(">") ||
        current.trim().match(/^(#{1,6})\s+/) ||
        current.trim().match(/^[-*]\s+/) ||
        current.trim().match(/^\d+\.\s+/)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraphLines.join("\n") });
  }

  return blocks;
}

function renderBlock(
  block: MarkdownBlock,
  terms: string[],
  index: number,
): ReactNode {
  switch (block.type) {
    case "code":
      return (
        <pre className="markdown-pre" key={index}>
          <code data-language={block.language || undefined}>{block.content}</code>
        </pre>
      );
    case "heading": {
      return renderHeading(block.level, block.content, terms, index);
    }
    case "blockquote":
      return (
        <blockquote className="markdown-blockquote" key={index}>
          {block.lines.map((line, lineIndex) => (
            <p key={lineIndex}>{renderInline(line, terms)}</p>
          ))}
        </blockquote>
      );
    case "hr":
      return <hr className="markdown-hr" key={index} />;
    case "table":
      return (
        <div className="markdown-table-wrap" key={index}>
          <table className="markdown-table">
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th key={cellIndex}>{renderInline(cell, terms)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInline(cell, terms)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className="markdown-list" key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, terms)}</li>
          ))}
        </Tag>
      );
    }
    case "checklist":
      return (
        <ul className="markdown-list markdown-checklist" key={index}>
          {block.items.map((item, itemIndex) => (
            <li className="markdown-checklist-item" key={itemIndex}>
              <input checked={item.checked} readOnly type="checkbox" />
              <span>{renderInline(item.content, terms)}</span>
            </li>
          ))}
        </ul>
      );
    case "paragraph":
      return (
        <p className="markdown-paragraph" key={index}>
          {renderInline(block.content, terms)}
        </p>
      );
  }
}

function isTableStart(lines: string[], index: number): boolean {
  if (index + 1 >= lines.length) {
    return false;
  }

  const current = lines[index].trim();
  const next = lines[index + 1].trim();

  return (
    current.includes("|") &&
    /^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(next)
  );
}

function splitTableLine(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderHeading(
  level: number,
  content: string,
  terms: string[],
  index: number,
): ReactNode {
  const className = `markdown-heading markdown-heading-${level}`;
  const children = renderInline(content, terms);

  switch (Math.min(level, 6)) {
    case 1:
      return <h1 className={className} key={index}>{children}</h1>;
    case 2:
      return <h2 className={className} key={index}>{children}</h2>;
    case 3:
      return <h3 className={className} key={index}>{children}</h3>;
    case 4:
      return <h4 className={className} key={index}>{children}</h4>;
    case 5:
      return <h5 className={className} key={index}>{children}</h5>;
    default:
      return <h6 className={className} key={index}>{children}</h6>;
  }
}

function renderInline(text: string, terms: string[]): ReactNode[] {
  const segments = parseInline(text);
  return segments.map((segment, index) => renderInlineSegment(segment, terms, `${index}`));
}

type InlineSegment =
  | { type: "text"; content: string }
  | { type: "strong"; content: string }
  | { type: "em"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; content: string; href: string };

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const match = remaining.match(
      /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/,
    );

    if (!match || match.index === undefined) {
      segments.push({ type: "text", content: remaining });
      break;
    }

    if (match.index > 0) {
      segments.push({ type: "text", content: remaining.slice(0, match.index) });
    }

    const token = match[0];
    if (token.startsWith("`")) {
      segments.push({ type: "code", content: token.slice(1, -1) });
    } else if (token.startsWith("**") || token.startsWith("__")) {
      segments.push({ type: "strong", content: token.slice(2, -2) });
    } else if (token.startsWith("*") || token.startsWith("_")) {
      segments.push({ type: "em", content: token.slice(1, -1) });
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        segments.push({
          type: "link",
          content: linkMatch[1],
          href: linkMatch[2],
        });
      } else {
        segments.push({ type: "text", content: token });
      }
    }

    remaining = remaining.slice(match.index + token.length);
  }

  return segments;
}

function renderInlineSegment(
  segment: InlineSegment,
  terms: string[],
  key: string,
): ReactNode {
  switch (segment.type) {
    case "text":
      return <span key={key}>{highlightText(segment.content, terms)}</span>;
    case "strong":
      return <strong key={key}>{highlightText(segment.content, terms)}</strong>;
    case "em":
      return <em key={key}>{highlightText(segment.content, terms)}</em>;
    case "code":
      return <code className="markdown-inline-code" key={key}>{segment.content}</code>;
    case "link":
      return renderSafeLink(segment.content, segment.href, terms, key);
  }
}

function renderSafeLink(
  label: string,
  href: string,
  terms: string[],
  key: string,
): ReactNode {
  const safeHref = sanitizeHref(href);

  if (!safeHref) {
    return <span key={key}>{highlightText(label, terms)}</span>;
  }

  return (
    <a
      className="markdown-link"
      href={safeHref}
      key={key}
      rel="noreferrer noopener"
      target="_blank"
    >
      {highlightText(label, terms)}
    </a>
  );
}

function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed, "https://local.invalid");
    if (url.protocol === "http:" || url.protocol === "https:") {
      return trimmed;
    }
  } catch {
    return null;
  }

  return null;
}

function highlightText(text: string, terms: string[]): ReactNode[] {
  const normalizedTerms = Array.from(
    new Set(terms.map((term) => term.trim()).filter(Boolean)),
  );

  if (normalizedTerms.length === 0 || !text) {
    return [text];
  }

  const regex = new RegExp(
    `(${normalizedTerms
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})`,
    "ig",
  );
  const termLookup = new Set(normalizedTerms.map((term) => term.toLowerCase()));

  return text.split(regex).map((part, index) =>
    termLookup.has(part.toLowerCase()) ? (
      <mark className="highlight" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}
