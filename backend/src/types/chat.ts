export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  success: boolean;
  answer?: string;
  error?: string;
}

export interface AzureChatMessage {
  role: "system" | ChatRole;
  content: string;
}
