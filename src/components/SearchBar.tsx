import type { ChangeEvent } from "react";

interface SearchBarProps {
  query: string;
  selectedRole: "all" | "user";
  selectedYear: string;
  availableYears: string[];
  theme: "light" | "dark";
  isImporting: boolean;
  isSearching: boolean;
  onQueryChange: (value: string) => void;
  onRoleChange: (value: "all" | "user") => void;
  onYearChange: (value: string) => void;
  onThemeToggle: () => void;
  onImport: (files: File[]) => void;
  onSearch: () => void;
}

export default function SearchBar({
  query,
  selectedRole,
  selectedYear,
  availableYears,
  theme,
  isImporting,
  isSearching,
  onQueryChange,
  onRoleChange,
  onYearChange,
  onThemeToggle,
  onImport,
  onSearch,
}: SearchBarProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    onImport(files);
    event.target.value = "";
  };

  return (
    <div className="panel search-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Archive</p>
          <h1>ChatGPT Conversation Search</h1>
        </div>
        <div className="toolbar-actions">
          <button className="theme-toggle" onClick={onThemeToggle} type="button">
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <label className="import-button">
            <input
              accept=".json,application/json"
              className="file-input"
              disabled={isImporting}
              onChange={handleFileChange}
              type="file"
              multiple
            />
            {isImporting ? "Importing..." : "Import JSONs"}
          </label>
        </div>
      </div>

      <div className="search-row">
        <input
          className="search-input"
          disabled={isSearching}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearch();
            }
          }}
          placeholder="Search messages, titles, or leave blank and use filters"
          value={query}
        />
        <button className="search-button" disabled={isSearching} onClick={onSearch} type="button">
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="filter-panel">
        <div className="segmented-control" role="tablist" aria-label="Role filter">
          <button
            className={`segment ${selectedRole === "user" ? "active" : ""}`}
            disabled={isSearching}
            onClick={() => onRoleChange("user")}
            type="button"
          >
            User only
          </button>
          <button
            className={`segment ${selectedRole === "all" ? "active" : ""}`}
            disabled={isSearching}
            onClick={() => onRoleChange("all")}
            type="button"
          >
            Include assistant
          </button>
        </div>

        <label className="year-picker">
          <span>Year</span>
          <select
            className="year-select"
            disabled={isSearching || availableYears.length === 0}
            onChange={(event) => onYearChange(event.currentTarget.value)}
            value={selectedYear}
          >
            <option value="">All years</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
