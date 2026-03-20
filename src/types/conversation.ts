export type AuthorRole = "user" | "assistant" | "system" | "tool" | "unknown";

export interface ConversationSummary {
  id: string;
  title: string;
  createTime: number | null;
  updateTime: number | null;
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  parentId: string | null;
  authorRole: AuthorRole;
  contentText: string;
  createTime: number | null;
  updateTime: number | null;
  depth: number;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
}
