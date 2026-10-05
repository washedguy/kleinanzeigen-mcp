export interface ConversationSummary {
  id: string;
  title?: string;
  listingId?: string;
  listingTitle?: string;
  otherParty?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unread?: boolean;
}

export interface ConversationMessage {
  id?: string;
  sender: "me" | "other";
  text: string;
  timestamp?: string;
}

export interface ConversationListing {
  id?: string;
  title?: string;
  url?: string;
  price?: number;
}

export interface Conversation {
  id: string;
  listing?: ConversationListing;
  otherParty?: string;
  messages: ConversationMessage[];
}
