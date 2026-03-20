import { invoke } from "@tauri-apps/api/core";

import type { ConversationDetail } from "../types/conversation";
import type { ArchiveStats, ImportPayload, ImportResult } from "../types/import";
import type { SearchRequest, SearchResponse } from "../types/search";

export async function importArchive(
  payload: ImportPayload,
): Promise<ImportResult> {
  return invoke<ImportResult>("import_archive", { payload });
}

export async function searchMessages(
  request: SearchRequest,
): Promise<SearchResponse> {
  return invoke<SearchResponse>("search_messages", {
    query: request.query,
    limit: request.limit,
    offset: request.offset,
    authorRole: request.authorRole,
    year: request.year,
  });
}

export async function getConversation(
  conversationId: string,
): Promise<ConversationDetail> {
  return invoke<ConversationDetail>("get_conversation", {
    conversationId,
  });
}

export async function getArchiveStats(): Promise<ArchiveStats> {
  return invoke<ArchiveStats>("get_archive_stats");
}
