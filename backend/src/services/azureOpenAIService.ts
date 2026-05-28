import { env, validateAzureConfig } from "../config/env";
import { AzureChatMessage } from "../types/chat";

interface AzureCompletionChoice {
  message?: {
    content?: string;
  };
}

interface AzureCompletionResponse {
  choices?: AzureCompletionChoice[];
}

interface AzureAssistantResponse {
  id?: string;
}

interface AzureThreadResponse {
  id?: string;
}

interface AzureRunResponse {
  id?: string;
  status?: string;
  last_error?: {
    message?: string;
  };
}

interface AzureThreadMessageTextContent {
  type?: "text";
  text?: {
    value?: string;
  };
}

interface AzureThreadMessage {
  role?: string;
  content?: AzureThreadMessageTextContent[];
}

interface AzureThreadMessagesResponse {
  data?: AzureThreadMessage[];
}

type TokenLimitParameter = "max_completion_tokens" | "max_tokens";

interface CachedAnswer {
  answer: string;
  expiresAt: number;
}

export class AzureOpenAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AzureOpenAIError";
  }
}

let cachedAssistantId: string | undefined;
let existingAssistantConfigured = false;
const answerCache = new Map<string, CachedAnswer>();

export function shouldUseAzureAssistant(): boolean {
  return Boolean(env.azureOpenAIAssistantId || env.azureOpenAIVectorStoreIds.length > 0);
}

function shouldFallbackToAssistant(answer: string): boolean {
  const normalizedAnswer = answer
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return [
    "nao possui essa informacao",
    "nao encontrei essa informacao",
    "nao consta no contexto",
    "nao esta no contexto",
    "procure o rh",
    "abrir um chamado"
  ].some((snippet) => normalizedAnswer.includes(snippet));
}

function normalizeCacheText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getLastUserMessage(messages: AzureChatMessage[]): string {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function getCacheKey(messages: AzureChatMessage[]): string {
  return normalizeCacheText(getLastUserMessage(messages));
}

function getCachedAnswer(cacheKey: string): string | undefined {
  const cached = answerCache.get(cacheKey);

  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    answerCache.delete(cacheKey);
    return undefined;
  }

  return cached.answer;
}

function setCachedAnswer(cacheKey: string, answer: string): void {
  if (!cacheKey || env.azureOpenAIAnswerCacheTtlMs <= 0 || shouldFallbackToAssistant(answer)) {
    return;
  }

  if (answerCache.size >= env.azureOpenAIAnswerCacheMaxItems) {
    const oldestKey = answerCache.keys().next().value as string | undefined;

    if (oldestKey) {
      answerCache.delete(oldestKey);
    }
  }

  answerCache.set(cacheKey, {
    answer,
    expiresAt: Date.now() + env.azureOpenAIAnswerCacheTtlMs
  });
}

function getAzureBaseUrl(apiVersion: string): string {
  const endpoint = env.azureOpenAIEndpoint.replace(/\/+$/, "");
  return `${endpoint}/openai`;
}

function buildAzureUrl(path: string, apiVersion: string): string {
  return `${getAzureBaseUrl(apiVersion)}${path}?api-version=${encodeURIComponent(apiVersion)}`;
}

function buildAssistantInstructions(messages: AzureChatMessage[]): string {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim();
}

function buildAssistantUserMessage(messages: AzureChatMessage[]): string {
  const dialog = messages.filter((message) => message.role !== "system");
  const currentMessageIndex = dialog.map((message) => message.role).lastIndexOf("user");
  const currentMessage = currentMessageIndex >= 0 ? dialog[currentMessageIndex]?.content ?? "" : "";
  const history = currentMessageIndex > 0 ? dialog.slice(0, currentMessageIndex) : [];

  if (history.length === 0) {
    return currentMessage;
  }

  const historyText = history
    .map((message) => `${message.role === "assistant" ? "Assistente" : "Colaborador"}: ${message.content}`)
    .join("\n");

  return `Historico recente da conversa:\n${historyText}\n\nMensagem atual do colaborador:\n${currentMessage}`;
}

function getAssistantAnswer(messages: AzureThreadMessagesResponse): string {
  const assistantMessage = messages.data?.find((message) => message.role === "assistant");
  const answer = assistantMessage?.content
    ?.map((content) => content.text?.value)
    .filter((value): value is string => Boolean(value))
    .join("\n")
    .trim();

  if (!answer) {
    throw new AzureOpenAIError("Resposta invalida da Azure OpenAI");
  }

  return answer;
}

async function readAzureError(response: Response): Promise<string> {
  const errorText = await response.text();
  return errorText ? `: ${errorText.slice(0, 500)}` : "";
}

async function requestAzureJson<T>(
  url: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    signal: AbortSignal;
  }
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.azureOpenAIApiKey
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  });

  if (!response.ok) {
    throw new AzureOpenAIError(`Azure OpenAI retornou HTTP ${response.status}${await readAzureError(response)}`);
  }

  return (await response.json()) as T;
}

async function requestAzureCompletion(
  url: string,
  messages: AzureChatMessage[],
  signal: AbortSignal,
  tokenLimitParameter: TokenLimitParameter
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.azureOpenAIApiKey
    },
    body: JSON.stringify({
      messages,
      temperature: 0.2,
      [tokenLimitParameter]: 700
    }),
    signal
  });
}

async function createAzureAssistant(instructions: string, signal: AbortSignal): Promise<string> {
  if (env.azureOpenAIAssistantId) {
    if (!existingAssistantConfigured && env.azureOpenAIVectorStoreIds.length > 0) {
      await requestAzureJson<AzureAssistantResponse>(
        buildAzureUrl(`/assistants/${encodeURIComponent(env.azureOpenAIAssistantId)}`, env.azureOpenAIAssistantsApiVersion),
        {
          method: "POST",
          body: {
            instructions,
            tools: [{ type: "file_search" }],
            tool_resources: {
              file_search: {
                vector_store_ids: env.azureOpenAIVectorStoreIds
              }
            }
          },
          signal
        }
      );

      existingAssistantConfigured = true;
    }

    return env.azureOpenAIAssistantId;
  }

  if (cachedAssistantId) {
    return cachedAssistantId;
  }

  const toolResources =
    env.azureOpenAIVectorStoreIds.length > 0
      ? {
          file_search: {
            vector_store_ids: env.azureOpenAIVectorStoreIds
          }
        }
      : undefined;

  const assistant = await requestAzureJson<AzureAssistantResponse>(
    buildAzureUrl("/assistants", env.azureOpenAIAssistantsApiVersion),
    {
      method: "POST",
      body: {
        name: env.azureOpenAIAssistantName,
        model: env.azureOpenAIDeployment,
        instructions,
        tools: [{ type: "file_search" }],
        tool_resources: toolResources,
        temperature: 1,
        top_p: 1
      },
      signal
    }
  );

  if (!assistant.id) {
    throw new AzureOpenAIError("Assistant invalido retornado pela Azure OpenAI");
  }

  cachedAssistantId = assistant.id;
  return assistant.id;
}

async function waitForRun(threadId: string, runId: string, signal: AbortSignal): Promise<void> {
  const terminalStatuses = new Set(["completed", "failed", "cancelled", "expired"]);

  while (true) {
    const run = await requestAzureJson<AzureRunResponse>(
      buildAzureUrl(`/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}`, env.azureOpenAIAssistantsApiVersion),
      { signal }
    );

    if (run.status && terminalStatuses.has(run.status)) {
      if (run.status === "completed") {
        return;
      }

      throw new AzureOpenAIError(run.last_error?.message ?? `Run da Azure OpenAI finalizou com status ${run.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

async function getAzureAssistantAnswer(messages: AzureChatMessage[], signal: AbortSignal): Promise<string> {
  validateAzureConfig({ assistantMode: true });

  const instructions = buildAssistantInstructions(messages);
  const assistantId = await createAzureAssistant(instructions, signal);
  const thread = await requestAzureJson<AzureThreadResponse>(
    buildAzureUrl("/threads", env.azureOpenAIAssistantsApiVersion),
    {
      method: "POST",
      body: {
        messages: [
          {
            role: "user",
            content: buildAssistantUserMessage(messages)
          }
        ]
      },
      signal
    }
  );

  if (!thread.id) {
    throw new AzureOpenAIError("Thread invalida retornada pela Azure OpenAI");
  }

  const run = await requestAzureJson<AzureRunResponse>(
    buildAzureUrl(`/threads/${encodeURIComponent(thread.id)}/runs`, env.azureOpenAIAssistantsApiVersion),
    {
      method: "POST",
      body: {
        assistant_id: assistantId
      },
      signal
    }
  );

  if (!run.id) {
    throw new AzureOpenAIError("Run invalido retornado pela Azure OpenAI");
  }

  await waitForRun(thread.id, run.id, signal);

  const threadMessages = await requestAzureJson<AzureThreadMessagesResponse>(
    `${buildAzureUrl(`/threads/${encodeURIComponent(thread.id)}/messages`, env.azureOpenAIAssistantsApiVersion)}&order=desc&limit=10`,
    { signal }
  );

  return getAssistantAnswer(threadMessages);
}

async function getAzureChatCompletionAnswer(messages: AzureChatMessage[], signal: AbortSignal): Promise<string> {
  validateAzureConfig();

  const endpoint = env.azureOpenAIEndpoint.replace(/\/+$/, "");
  const deployment = encodeURIComponent(env.azureOpenAIDeployment);
  const apiVersion = encodeURIComponent(env.azureOpenAIApiVersion);
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  let response = await requestAzureCompletion(url, messages, signal, "max_completion_tokens");

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 400 && errorText.includes("max_completion_tokens")) {
      response = await requestAzureCompletion(url, messages, signal, "max_tokens");

      if (response.ok) {
        const fallbackData = (await response.json()) as AzureCompletionResponse;
        const fallbackAnswer = fallbackData.choices?.[0]?.message?.content?.trim();

        if (!fallbackAnswer) {
          throw new AzureOpenAIError("Resposta invalida da Azure OpenAI");
        }

        return fallbackAnswer;
      }
    }

    throw new AzureOpenAIError(`Azure OpenAI retornou HTTP ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const data = (await response.json()) as AzureCompletionResponse;
  const answer = data.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new AzureOpenAIError("Resposta invalida da Azure OpenAI");
  }

  return answer;
}

export async function getAzureOpenAIAnswer(messages: AzureChatMessage[]): Promise<string> {
  const useAssistant = shouldUseAzureAssistant();
  const cacheKey = useAssistant ? getCacheKey(messages) : "";
  const cachedAnswer = useAssistant ? getCachedAnswer(cacheKey) : undefined;

  if (cachedAnswer) {
    return cachedAnswer;
  }

  const controller = new AbortController();
  const timeoutMs = useAssistant ? env.azureOpenAIAssistantsTimeoutMs : env.azureOpenAITimeoutMs;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (useAssistant && env.azureOpenAIFastLocalFirst) {
      try {
        const fastAnswer = await getAzureChatCompletionAnswer(messages, controller.signal);

        if (!shouldFallbackToAssistant(fastAnswer)) {
          return fastAnswer;
        }
      } catch {
        // If the fast path is unavailable, continue with the configured Assistant.
      }
    }

    if (useAssistant) {
      const assistantAnswer = await getAzureAssistantAnswer(messages, controller.signal);
      setCachedAnswer(cacheKey, assistantAnswer);
      return assistantAnswer;
    }

    return await getAzureChatCompletionAnswer(messages, controller.signal);
  } catch (error) {
    if (error instanceof AzureOpenAIError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AzureOpenAIError("Timeout na chamada para Azure OpenAI");
    }

    throw new AzureOpenAIError("Falha de rede ao chamar Azure OpenAI");
  } finally {
    clearTimeout(timeout);
  }
}
