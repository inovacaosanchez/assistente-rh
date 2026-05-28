export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  conversationId?: string;
}

export interface ChatResponse {
  success: boolean;
  answer?: string;
  conversationId?: string;
  error?: string;
}

export interface AzureChatMessage {
  role: "system" | ChatRole;
  content: string;
}
