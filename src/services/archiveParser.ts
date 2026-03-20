import type {
  RawArchiveConversation,
  RawArchiveMessage,
  RawArchiveNode,
} from "../types/archive";
import type { AuthorRole } from "../types/conversation";
import type {
  ImportPayload,
  NormalizedConversationPathRecord,
  NormalizedConversationRecord,
  NormalizedMessageRecord,
} from "../types/import";

const TEXT_FIELD_KEYS = ["text", "result", "value", "content", "caption", "title"] as const;

export async function parseArchiveFile(file: File): Promise<ImportPayload> {
  try {
    const rawText = await file.text();
    const archive = JSON.parse(rawText) as RawArchiveConversation[];
    return normalizeArchive(archive);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    throw new Error(`${file.name}: ${message}`);
  }
}

export async function parseArchiveFiles(files: File[]): Promise<ImportPayload> {
  const payloads = await Promise.all(
    [...files]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((file) => parseArchiveFile(file)),
  );

  return {
    conversations: payloads.flatMap((payload) => payload.conversations),
    messages: payloads.flatMap((payload) => payload.messages),
    paths: payloads.flatMap((payload) => payload.paths),
    skippedNodes: payloads.reduce(
      (total, payload) => total + (payload.skippedNodes ?? 0),
      0,
    ),
  };
}

export function splitSearchTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .trim()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  );
}

export function formatArchiveTimestamp(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "Unknown time";
  }

  return new Date(value * 1000).toLocaleString();
}

function normalizeArchive(archive: RawArchiveConversation[]): ImportPayload {
  const conversations: NormalizedConversationRecord[] = [];
  const messages: NormalizedMessageRecord[] = [];
  const paths: NormalizedConversationPathRecord[] = [];
  let skippedNodes = 0;

  for (const conversation of archive) {
    if (!conversation?.id) {
      continue;
    }

    conversations.push({
      id: conversation.id,
      title: normalizeTitle(conversation.title),
      createTime: normalizeTimestamp(conversation.create_time),
      updateTime: normalizeTimestamp(conversation.update_time),
    });

    const mapping = conversation.mapping ?? {};
    const depthCache = new Map<string, number>();
    const terminalCache = new Map<string, boolean>();

    for (const [nodeId, node] of Object.entries(mapping)) {
      if (!node?.message) {
        continue;
      }

      const message = node.message;
      const messageId = message.id || node.id || nodeId;
      const contentText = extractContentText(message);
      const shouldPersist = shouldPersistMessage(message, contentText);

      if (!messageId || !shouldPersist) {
        skippedNodes += 1;
        continue;
      }

      messages.push({
        id: messageId,
        conversationId: conversation.id,
        parentId: normalizeParentId(node.parent, mapping),
        authorRole: normalizeAuthorRole(message.author?.role),
        contentText,
        createTime: normalizeTimestamp(message.create_time),
        updateTime: normalizeTimestamp(message.update_time),
        status: message.status ?? null,
        metadataJson: serializeMetadata(message.metadata),
      });

      paths.push({
        conversationId: conversation.id,
        messageId,
        depth: computeDepth(nodeId, mapping, depthCache),
        isTerminal: isTerminalMessageNode(nodeId, mapping, terminalCache),
      });
    }
  }

  return { conversations, messages, paths, skippedNodes };
}

function normalizeTitle(title: string | undefined): string {
  const value = title?.trim();
  return value ? value : "Untitled Conversation";
}

function normalizeTimestamp(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeAuthorRole(role: string | null | undefined): AuthorRole {
  switch (role) {
    case "user":
    case "assistant":
    case "system":
    case "tool":
      return role;
    default:
      return "unknown";
  }
}

function normalizeParentId(
  parentNodeId: string | null | undefined,
  mapping: Record<string, RawArchiveNode>,
): string | null {
  if (!parentNodeId) {
    return null;
  }

  const parentNode = mapping[parentNodeId];
  return parentNode?.message?.id ?? null;
}

function computeDepth(
  nodeId: string,
  mapping: Record<string, RawArchiveNode>,
  cache: Map<string, number>,
): number {
  const cached = cache.get(nodeId);
  if (cached !== undefined) {
    return cached;
  }

  const node = mapping[nodeId];
  const parentId = node?.parent;
  const depth =
    parentId && mapping[parentId]
      ? computeDepth(parentId, mapping, cache) + (mapping[parentId]?.message ? 1 : 0)
      : 0;

  cache.set(nodeId, depth);
  return depth;
}

function isTerminalMessageNode(
  nodeId: string,
  mapping: Record<string, RawArchiveNode>,
  cache: Map<string, boolean>,
): boolean {
  const cached = cache.get(nodeId);
  if (cached !== undefined) {
    return cached;
  }

  const node = mapping[nodeId];
  const result = !(node?.children ?? []).some((childId) =>
    hasMessageDescendant(childId, mapping, new Set()),
  );

  cache.set(nodeId, result);
  return result;
}

function hasMessageDescendant(
  nodeId: string,
  mapping: Record<string, RawArchiveNode>,
  seen: Set<string>,
): boolean {
  if (seen.has(nodeId)) {
    return false;
  }

  seen.add(nodeId);
  const node = mapping[nodeId];
  if (!node) {
    return false;
  }

  if (node.message) {
    return true;
  }

  return (node.children ?? []).some((childId) =>
    hasMessageDescendant(childId, mapping, seen),
  );
}

function extractContentText(message: RawArchiveMessage): string {
  const parts = message.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .map((part) => extractTextFromUnknown(part))
      .filter(Boolean)
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  const text =
    extractTextFromUnknown(message.content?.text) ||
    extractTextFromUnknown(message.content) ||
    extractTextFromUnknown(message.metadata);

  return text.trim();
}

function shouldPersistMessage(
  message: RawArchiveMessage,
  contentText: string,
): boolean {
  const role = message.author?.role ?? "unknown";
  const metadata = (message.metadata ?? {}) as Record<string, unknown>;
  const isHidden = metadata.is_visually_hidden_from_conversation === true;
  const isContextMessage = metadata.is_user_system_message === true;
  const isNextMarker = metadata.message_type === "next";
  const contentType =
    typeof message.content?.content_type === "string"
      ? message.content.content_type
      : "";

  if (isContextMessage || contentType === "user_editable_context") {
    return false;
  }

  if (contentText) {
    return true;
  }

  if (role === "system" && isHidden) {
    return false;
  }

  if (isNextMarker) {
    return false;
  }

  return false;
}

function extractTextFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => extractTextFromUnknown(entry))
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    for (const key of TEXT_FIELD_KEYS) {
      const nested = extractTextFromUnknown(
        (value as Record<string, unknown>)[key],
      );
      if (nested) {
        return nested;
      }
    }
  }

  return "";
}

function serializeMetadata(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
