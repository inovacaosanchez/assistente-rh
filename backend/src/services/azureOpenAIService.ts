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

type TokenLimitParameter = "max_completion_tokens" | "max_tokens";

export class AzureOpenAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AzureOpenAIError";
  }
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

export async function getAzureOpenAIAnswer(messages: AzureChatMessage[]): Promise<string> {
  validateAzureConfig();

  const endpoint = env.azureOpenAIEndpoint.replace(/\/+$/, "");
  const deployment = encodeURIComponent(env.azureOpenAIDeployment);
  const apiVersion = encodeURIComponent(env.azureOpenAIApiVersion);
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.azureOpenAITimeoutMs);

  try {
    let response = await requestAzureCompletion(url, messages, controller.signal, "max_completion_tokens");

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 400 && errorText.includes("max_completion_tokens")) {
        response = await requestAzureCompletion(url, messages, controller.signal, "max_tokens");

        if (response.ok) {
          const fallbackData = (await response.json()) as AzureCompletionResponse;
          const fallbackAnswer = fallbackData.choices?.[0]?.message?.content?.trim();

          if (!fallbackAnswer) {
            throw new AzureOpenAIError("Resposta invalida da Azure OpenAI");
          }

          return fallbackAnswer;
        }
      }

      throw new AzureOpenAIError(`Azure OpenAI retornou HTTP ${response.status}`);
    }

    const data = (await response.json()) as AzureCompletionResponse;
    const answer = data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new AzureOpenAIError("Resposta invalida da Azure OpenAI");
    }

    return answer;
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
