export interface NormalizedConversationRecord {
  id: string;
  title: string;
  createTime: number | null;
  updateTime: number | null;
}

export interface NormalizedMessageRecord {
  id: string;
  conversationId: string;
  parentId: string | null;
  authorRole: "user" | "assistant" | "system" | "tool" | "unknown";
  contentText: string;
  createTime: number | null;
  updateTime: number | null;
  status: string | null;
  metadataJson: string | null;
}

export interface NormalizedConversationPathRecord {
  conversationId: string;
  messageId: string;
  depth: number;
  isTerminal: boolean;
}

export interface ImportPayload {
  conversations: NormalizedConversationRecord[];
  messages: NormalizedMessageRecord[];
  paths: NormalizedConversationPathRecord[];
  skippedNodes?: number;
}

export interface ImportResult {
  conversationsImported: number;
  messagesImported: number;
  skippedNodes: number;
  duplicateConversations: number;
}

export interface ArchiveStats {
  conversationCount: number;
  messageCount: number;
  lastImportedAt: string | null;
  oldestMessageTime: number | null;
  newestMessageTime: number | null;
}
