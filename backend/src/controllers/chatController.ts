import { Request, Response } from "express";
import { getAzureOpenAIAnswer, shouldUseAzureAssistant } from "../services/azureOpenAIService";
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

function normalizeForComparison(value: string): string {
  return sanitizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isTransientAssistantFailure(message: ChatMessage): boolean {
  if (message.role !== "assistant") return false;

  const content = normalizeForComparison(message.content);
  return (
    content.includes("desculpe, nao consegui responder agora") ||
    content.includes("nao foi possivel processar sua solicitacao")
  );
}

function isInitialAssistantGreeting(message: ChatMessage): boolean {
  if (message.role !== "assistant") return false;

  const content = normalizeForComparison(message.content);
  return content.includes("sou o assistente virtual do rh da sanchez") && content.includes("como posso ajudar");
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

function normalizeHistory(history: unknown, currentMessage: string): ChatMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }

  const normalizedCurrentMessage = normalizeForComparison(currentMessage);
  const normalizedHistory = history
    .filter(isValidChatMessage)
    .filter((item) => !isTransientAssistantFailure(item))
    .filter((item) => !isInitialAssistantGreeting(item))
    .map((item) => ({
      role: item.role,
      content: sanitizeText(item.content).slice(0, MAX_MESSAGE_LENGTH)
    }))
    .slice(-MAX_HISTORY_MESSAGES);

  const lastMessage = normalizedHistory.at(-1);

  if (lastMessage?.role === "user" && normalizeForComparison(lastMessage.content) === normalizedCurrentMessage) {
    return normalizedHistory.slice(0, -1);
  }

  return normalizedHistory;
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

function buildAssistantPrompt(): string {
  return `Voce e o assistente virtual do RH da Sanchez.

Responda sempre em portugues do Brasil, com linguagem clara, profissional, objetiva e acolhedora.

Use exclusivamente as politicas, processos e diretrizes internas disponiveis no Assistant e no file_search.

Nao invente regras, prazos, valores, beneficios, excecoes ou procedimentos.

Se a informacao nao estiver prevista formalmente, informe isso de maneira transparente e oriente o colaborador a procurar o RH ou abrir um chamado no MySuite.

Nao compartilhe dados confidenciais, pessoais, salariais, medicos ou sensiveis de colaboradores.

Nao execute acoes como aprovar ferias, alterar ponto, consultar salario ou tomar decisoes em nome do RH ou da lideranca.`;
}

export async function handleChat(req: Request, res: Response<ChatResponse>): Promise<void> {
  const body = req.body as Partial<ChatRequest>;
  const message = typeof body.message === "string" ? sanitizeText(body.message) : "";
  const conversationId = typeof body.conversationId === "string" ? sanitizeText(body.conversationId) : undefined;

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
    const useAssistant = shouldUseAzureAssistant();
    const context = useAssistant ? "" : await loadRhContext();
    const history = normalizeHistory(body.history, message);
    const messages: AzureChatMessage[] = [
      {
        role: "system",
        content: useAssistant ? buildAssistantPrompt() : buildSystemPrompt(context)
      },
      ...history,
      {
        role: "user",
        content: message
      }
    ];

    const result = await getAzureOpenAIAnswer(messages, conversationId);
    await logChatQuestion(message, "success");

    res.json({
      success: true,
      answer: result.answer,
      conversationId: result.conversationId
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
