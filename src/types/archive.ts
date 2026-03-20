export interface RawArchiveConversation {
  id: string;
  title: string;
  create_time?: number | null;
  update_time?: number | null;
  mapping?: Record<string, RawArchiveNode>;
}

export interface RawArchiveNode {
  id?: string;
  parent?: string | null;
  children?: string[];
  message?: RawArchiveMessage | null;
}

export interface RawArchiveMessage {
  id: string;
  author?: { role?: string | null } | null;
  create_time?: number | null;
  update_time?: number | null;
  status?: string | null;
  metadata?: unknown;
  content?: {
    content_type?: string;
    parts?: unknown[];
    text?: string;
  } | null;
}
