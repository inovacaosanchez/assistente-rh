import { ChatMessage, ChatResponse } from "../types/chat";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const GENERIC_ERROR = "Nao foi possivel processar sua solicitacao no momento.";
type UserProfile = "gestor" | "colaborador";

function enrichMessageWithProfile(message: string, profile: UserProfile): string {
  const profilePhrase = profile === "gestor" ? "Sou gestor" : "Sou colaborador";
  return `${profilePhrase}.\nPergunta: ${message}`;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  profile: UserProfile,
  conversationId?: string
): Promise<ChatResponse> {
  try {
    const enrichedHistory = history.map((item) =>
      item.role === "user"
        ? {
            ...item,
            content: enrichMessageWithProfile(item.content, profile)
          }
        : item
    );

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: enrichMessageWithProfile(message, profile),
        history: enrichedHistory,
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
