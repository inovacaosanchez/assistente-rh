import { Request, Response } from "express";
import { getAzureOpenAIAnswer } from "../services/azureOpenAIService";
import { ChatMessage, ChatRequest, ChatResponse, AzureChatMessage } from "../types/chat";
import { loadRhContext } from "../utils/loadContext";
import { logChatQuestion, logUserQuestionToFrontendRoot } from "../utils/logger";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;
const GENERIC_ERROR = "Não foi possível processar sua solicitação no momento.";

function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidChatMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") return false;

  const candidate = message as Partial<ChatMessage>;
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    sanitizeText(candidate.content).length > 0
  );
}

function normalizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(isValidChatMessage)
    .map((item) => ({
      role: item.role,
      content: sanitizeText(item.content).slice(0, MAX_MESSAGE_LENGTH)
    }))
    .slice(-MAX_HISTORY_MESSAGES);
}

function buildSystemPrompt(context: string): string {
  return `Voce e o assistente virtual do RH da Sanchez.

Seu objetivo e ajudar colaboradores com duvidas sobre processos internos de RH, beneficios, ferias, banco de horas, folha de pagamento, atestados, admissoes, desligamentos e politicas internas.

Use somente as informacoes fornecidas no contexto da empresa.

Se a resposta nao estiver no contexto, diga educadamente que nao possui essa informacao e oriente o colaborador a entrar em contato com o RH.

Nao invente regras, prazos, beneficios ou procedimentos.

Nao forneca informacoes pessoais, salariais, medicas ou sensiveis de colaboradores.

Nao execute acoes como aprovar ferias, alterar ponto, consultar salario ou acessar dados pessoais.

Responda sempre em portugues do Brasil, com linguagem clara, profissional, objetiva e acolhedora.

Quando fizer sentido, organize a resposta em passos simples.

Contexto da empresa:
${context}`;
}

export async function handleChat(req: Request, res: Response<ChatResponse>): Promise<void> {
  const body = req.body as Partial<ChatRequest>;
  const message = typeof body.message === "string" ? sanitizeText(body.message) : "";

  if (!message) {
    res.status(400).json({
      success: false,
      error: "Envie uma mensagem para continuar."
    });
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      success: false,
      error: `A mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`
    });
    return;
  }

  await logUserQuestionToFrontendRoot(message).catch(() => undefined);

  try {
    const context = await loadRhContext();
    const history = normalizeHistory(body.history);
    const messages: AzureChatMessage[] = [
      {
        role: "system",
        content: buildSystemPrompt(context)
      },
      ...history,
      {
        role: "user",
        content: message
      }
    ];

    const answer = await getAzureOpenAIAnswer(messages);
    await logChatQuestion(message, "success");

    res.json({
      success: true,
      answer
    });
  } catch (error) {
    await logChatQuestion(message, "error").catch(() => undefined);
    console.error("Erro ao processar chat:", error);

    res.status(500).json({
      success: false,
      error: GENERIC_ERROR
    });
  }
}
