import { ChatMessage, ChatResponse } from "../types/chat";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const GENERIC_ERROR = "Não foi possível processar sua solicitação no momento.";

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  conversationId?: string
): Promise<ChatResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        history,
        conversationId
      })
    });

    const data = (await response.json()) as ChatResponse;

    if (!response.ok) {
      return {
        success: false,
        error: data.error ?? GENERIC_ERROR
      };
    }

    return data;
  } catch {
    return {
      success: false,
      error: GENERIC_ERROR
    };
  }
}
