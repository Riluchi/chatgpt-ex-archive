export interface SearchRequest {
  query: string;
  limit?: number;
  offset?: number;
  authorRole?: "all" | "user";
  year?: number | null;
}

export interface SearchResultItem {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  authorRole: string;
  contentText: string;
  snippet: string;
  score: number;
  createTime: number | null;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
