import { useEffect, useState } from "react";

import ConversationView from "../components/ConversationView";
import ResultList from "../components/ResultList";
import SearchBar from "../components/SearchBar";
import {
  getArchiveStats,
  getConversation,
  importArchive,
  searchMessages,
} from "../services/api";
import { parseArchiveFile } from "../services/archiveParser";
import type { ConversationDetail } from "../types/conversation";
import type { ArchiveStats, ImportResult } from "../types/import";
import type { SearchResultItem } from "../types/search";

const SEARCH_PAGE_SIZE = 500;

export default function ArchivePage() {
  const [query, setQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<"all" | "user">("user");
  const [selectedYear, setSelectedYear] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState("Import a ChatGPT archive to begin.");
  const [archiveStats, setArchiveStats] = useState<ArchiveStats | null>(null);
  const [importIssues, setImportIssues] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    void loadArchiveStats();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const handleImport = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const sortedFiles = [...files].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    const issues: string[] = [];
    let conversationsImported = 0;
    let messagesImported = 0;
    let skippedNodes = 0;
    let duplicateConversations = 0;

    try {
      setIsImporting(true);
      setImportIssues([]);
      setStatus(`Importing ${sortedFiles.length} file(s)...`);

      for (const file of sortedFiles) {
        try {
          const payload = await parseArchiveFile(file);
          const result = await importArchive(payload);
          conversationsImported += result.conversationsImported;
          messagesImported += result.messagesImported;
          skippedNodes += result.skippedNodes;
          duplicateConversations += result.duplicateConversations;
        } catch (error) {
          issues.push(formatError(error, `${file.name}: import failed`));
        }
      }

      setImportResult({
        conversationsImported,
        messagesImported,
        skippedNodes,
        duplicateConversations,
      });
      setImportIssues(issues);
      setResults([]);
      setTotalResults(0);
      setHasMoreResults(false);
      setConversation(null);
      setSelectedMessageId(null);

      await loadArchiveStats();

      if (issues.length > 0) {
        setStatus(
          `Imported ${conversationsImported} conversations and ${messagesImported} messages. Skipped ${duplicateConversations} duplicate conversations. ${issues.length} file(s) failed.`,
        );
      } else {
        setStatus(
          `Imported ${conversationsImported} conversations and ${messagesImported} messages from ${sortedFiles.length} file(s). Skipped ${duplicateConversations} duplicate conversations.`,
        );
      }
    } catch (error) {
      setStatus(formatError(error, "Failed to import archive."));
    } finally {
      setIsImporting(false);
    }
  };

  const handleSearch = async () => {
    const request = buildSearchRequest(query, selectedRole, selectedYear, 0);
    const hasFilters =
      request.authorRole !== "all" || request.year !== null;

    if (!request.query.trim() && !hasFilters) {
      setResults([]);
      setTotalResults(0);
      setHasMoreResults(false);
      setConversation(null);
      setSelectedMessageId(null);
      setStatus("Enter a search query or specify filters.");
      return;
    }

    try {
      setIsSearching(true);
      setStatus(
        request.query.trim()
          ? `Searching for "${request.query}"...`
          : "Searching with filters...",
      );

      const response = await searchMessages(request);
      setResults(response.items);
      setTotalResults(response.total);
      setHasMoreResults(response.hasMore);
      setConversation(null);
      setSelectedMessageId(response.items[0]?.messageId ?? null);
      setStatus(
        response.total === 0
          ? `No matches for "${request.query || "filters"}".`
          : `Found ${response.total} results.`,
      );

      if (response.items[0]) {
        await handleSelectResult(response.items[0]);
      }
    } catch (error) {
      setStatus(formatError(error, "Search failed."));
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    try {
      setIsSearching(true);
      const response = await searchMessages(
        buildSearchRequest(query, selectedRole, selectedYear, results.length),
      );
      setResults((prev) => [...prev, ...response.items]);
      setTotalResults(response.total);
      setHasMoreResults(response.hasMore);
    } catch (error) {
      setStatus(formatError(error, "Failed to load more results."));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = async (item: SearchResultItem) => {
    try {
      setSelectedMessageId(item.messageId);
      setConversation(await getConversation(item.conversationId));
    } catch (error) {
      setStatus(formatError(error, "Failed to load conversation."));
    }
  };

  async function loadArchiveStats() {
    try {
      const stats = await getArchiveStats();
      setArchiveStats(stats);
      if (stats.messageCount > 0) {
        setStatus(
          `Loaded ${stats.conversationCount} conversations and ${stats.messageCount} messages from the local database.`,
        );
      }
    } catch {
      // Keep initial status if stats are unavailable.
    }
  }

  return (
    <main className="app-shell">
      <section className="sidebar">
        <SearchBar
          availableYears={buildYearOptions(archiveStats)}
          isImporting={isImporting}
          isSearching={isSearching}
          onImport={handleImport}
          onQueryChange={setQuery}
          onRoleChange={setSelectedRole}
          onSearch={handleSearch}
          onThemeToggle={() =>
            setTheme((prev) => (prev === "light" ? "dark" : "light"))
          }
          onYearChange={setSelectedYear}
          query={query}
          selectedRole={selectedRole}
          selectedYear={selectedYear}
          theme={theme}
        />
        <div className="status-bar">
          <p>{status}</p>
          {importResult ? <span>skipped {importResult.skippedNodes} nodes</span> : null}
        </div>
        {archiveStats ? (
          <div className="status-bar">
            <span>
              db {archiveStats.conversationCount} conversations / {archiveStats.messageCount} messages
            </span>
            <span>{archiveStats.lastImportedAt ?? "not imported yet"}</span>
          </div>
        ) : null}
        {importIssues.length > 0 ? (
          <div className="import-issues">
            {importIssues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        ) : null}
        <ResultList
          hasMore={hasMoreResults}
          onLoadMore={() => {
            void handleLoadMore();
          }}
          onSelect={handleSelectResult}
          query={query}
          results={results}
          selectedMessageId={selectedMessageId}
          total={totalResults}
        />
      </section>

      <section className="detail-pane">
        <ConversationView
          conversation={conversation}
          query={query}
          selectedMessageId={selectedMessageId}
        />
      </section>
    </main>
  );
}

function buildSearchRequest(
  query: string,
  selectedRole: "all" | "user",
  selectedYear: string,
  offset: number,
) {
  const parsedYear = Number.parseInt(selectedYear, 10);
  const year =
    selectedYear.trim().length === 4 && Number.isFinite(parsedYear)
      ? parsedYear
      : null;

  return {
    query,
    limit: SEARCH_PAGE_SIZE,
    offset,
    authorRole: selectedRole,
    year,
  } as const;
}

function buildYearOptions(stats: ArchiveStats | null): string[] {
  if (!stats?.oldestMessageTime || !stats?.newestMessageTime) {
    return [];
  }

  const oldest = new Date(stats.oldestMessageTime * 1000).getFullYear();
  const newest = new Date(stats.newestMessageTime * 1000).getFullYear();
  const years: string[] = [];

  for (let year = newest; year >= oldest; year -= 1) {
    years.push(String(year));
  }

  return years;
}

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
