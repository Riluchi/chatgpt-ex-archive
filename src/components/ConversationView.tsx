import { formatArchiveTimestamp, splitSearchTerms } from "../services/archiveParser";
import type { ConversationDetail } from "../types/conversation";
import MarkdownContent from "./MarkdownContent";

interface ConversationViewProps {
  conversation: ConversationDetail | null;
  query: string;
  selectedMessageId: string | null;
}

export default function ConversationView({
  conversation,
  query,
  selectedMessageId,
}: ConversationViewProps) {
  const highlightTerms = splitSearchTerms(query);

  if (!conversation) {
    return (
      <div className="panel conversation-panel empty-state">
        <p>Select a search result to inspect the full conversation.</p>
      </div>
    );
  }

  return (
    <div className="panel conversation-panel">
      <div className="conversation-header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>{conversation.conversation.title}</h2>
        </div>
        <div className="conversation-stats">
          <span>{conversation.conversation.messageCount} messages</span>
          <span>{formatArchiveTimestamp(conversation.conversation.updateTime)}</span>
        </div>
      </div>

      <div className="conversation-thread">
        {conversation.messages.map((message) => (
          <article
            className={`message-card ${
              message.id === selectedMessageId ? "selected" : ""
            } message-card-${message.authorRole}`}
            key={message.id}
            style={{ marginLeft: `${Math.min(message.depth, 8) * 14}px` }}
          >
            <div className="message-meta">
              <span className={`role-badge role-${message.authorRole}`}>
                {message.authorRole}
              </span>
              <span>{formatArchiveTimestamp(message.createTime)}</span>
            </div>
            <div className="message-body">
              <MarkdownContent text={message.contentText} terms={highlightTerms} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
