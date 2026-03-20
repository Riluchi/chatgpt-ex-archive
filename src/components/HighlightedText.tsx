interface HighlightedTextProps {
  text: string;
  terms?: string[];
  className?: string;
  highlightClassName?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function HighlightedText({
  text,
  terms = [],
  className,
  highlightClassName,
}: HighlightedTextProps) {
  const normalizedTerms = Array.from(
    new Set(
      terms
        .map((term) => term.trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length),
    ),
  );

  if (normalizedTerms.length === 0 || !text) {
    return <span className={className}>{text}</span>;
  }

  const regex = new RegExp(`(${normalizedTerms.map(escapeRegExp).join("|")})`, "ig");
  const termLookup = new Set(normalizedTerms.map((term) => term.toLowerCase()));
  const chunks = text.split(regex);

  return (
    <span className={className}>
      {chunks.map((chunk, index) => {
        if (!termLookup.has(chunk.toLowerCase())) {
          return <span key={`${index}-${chunk}`}>{chunk}</span>;
        }

        return (
          <mark key={`${index}-${chunk}`} className={highlightClassName}>
            {chunk}
          </mark>
        );
      })}
    </span>
  );
}
