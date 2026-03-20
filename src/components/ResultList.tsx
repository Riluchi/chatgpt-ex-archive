import { formatArchiveTimestamp, splitSearchTerms } from "../services/archiveParser";
import type { SearchResultItem } from "../types/search";
import HighlightedText from "./HighlightedText";

interface ResultListProps {
  query: string;
  results: SearchResultItem[];
  total: number;
  hasMore: boolean;
  selectedMessageId: string | null;
  onSelect: (item: SearchResultItem) => void;
  onLoadMore: () => void;
}

export default function ResultList({
  query,
  results,
  total,
  hasMore,
  selectedMessageId,
  onSelect,
  onLoadMore,
}: ResultListProps) {
  const highlightTerms = splitSearchTerms(query);

  if (results.length === 0) {
    return (
      <div className="panel results-panel empty-state">
        <p>No results yet. Import an archive and run a search.</p>
      </div>
    );
  }

  return (
    <div className="panel results-panel">
      <div className="results-meta">
        <span>{results.length} / {total} results</span>
        <span>{query.trim() ? `Query: ${query}` : "Browse imported results"}</span>
      </div>
      <div className="results-list">
        {results.map((item) => (
          <button
            className={`result-card ${
              item.messageId === selectedMessageId ? "selected" : ""
            }`}
            key={`${item.conversationId}-${item.messageId}`}
            onClick={() => onSelect(item)}
            type="button"
          >
            <div className="result-card-header">
              <HighlightedText
                className="result-title"
                highlightClassName="highlight"
                text={item.conversationTitle}
                terms={highlightTerms}
              />
              <span className={`role-badge role-${item.authorRole}`}>
                {item.authorRole}
              </span>
            </div>
            <p className="result-snippet">
              <HighlightedText
                className="result-snippet-text"
                highlightClassName="highlight"
                text={item.snippet || item.contentText}
                terms={highlightTerms}
              />
            </p>
            <div className="result-footer">
              <span>{formatArchiveTimestamp(item.createTime)}</span>
              <span>score {item.score.toFixed(2)}</span>
            </div>
          </button>
        ))}
        {hasMore ? (
          <button className="load-more-button" onClick={onLoadMore} type="button">
            Next 500
          </button>
        ) : null}
      </div>
    </div>
  );
}
