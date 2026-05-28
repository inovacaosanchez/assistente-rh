import dotenv from "dotenv";

dotenv.config();

function parseFrontendUrls(value: string | undefined): string[] {
  const configuredUrls = (value ?? "http://localhost:5173")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  return Array.from(new Set(configuredUrls));
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;

  return ["1", "true", "yes", "sim"].includes(value.trim().toLowerCase());
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  frontendUrls: parseFrontendUrls(process.env.FRONTEND_URL),
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? "",
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY ?? "",
  azureOpenAIDeployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? "",
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21",
  azureOpenAIAssistantsApiVersion: process.env.AZURE_OPENAI_ASSISTANTS_API_VERSION ?? "2024-05-01-preview",
  azureOpenAIAssistantId: process.env.AZURE_OPENAI_ASSISTANT_ID ?? "",
  azureOpenAIAssistantName: process.env.AZURE_OPENAI_ASSISTANT_NAME ?? "AgenteRH",
  azureOpenAIVectorStoreIds: parseCsv(process.env.AZURE_OPENAI_VECTOR_STORE_IDS),
  azureOpenAIModel: process.env.AZURE_OPENAI_MODEL ?? "gpt-4o-mini",
  azureOpenAITimeoutMs: Number(process.env.AZURE_OPENAI_TIMEOUT_MS ?? 30000),
  azureOpenAIAssistantsTimeoutMs: Number(process.env.AZURE_OPENAI_ASSISTANTS_TIMEOUT_MS ?? 90000),
  azureOpenAIFastLocalFirst: parseBoolean(process.env.AZURE_OPENAI_FAST_LOCAL_FIRST, false),
  azureOpenAIAnswerCacheTtlMs: Number(process.env.AZURE_OPENAI_ANSWER_CACHE_TTL_MS ?? 3600000),
  azureOpenAIAnswerCacheMaxItems: Number(process.env.AZURE_OPENAI_ANSWER_CACHE_MAX_ITEMS ?? 100)
};

export function validateAzureConfig(options: { assistantMode?: boolean } = {}): void {
  const missing: string[] = [];

  if (!env.azureOpenAIEndpoint) missing.push("AZURE_OPENAI_ENDPOINT");
  if (!env.azureOpenAIApiKey) missing.push("AZURE_OPENAI_API_KEY");

  if (options.assistantMode) {
    if (!env.azureOpenAIAssistantId && !env.azureOpenAIDeployment) {
      missing.push("AZURE_OPENAI_DEPLOYMENT ou AZURE_OPENAI_ASSISTANT_ID");
    }
  } else if (!env.azureOpenAIDeployment) {
    missing.push("AZURE_OPENAI_DEPLOYMENT");
  }

  if (missing.length > 0) {
    throw new Error(`Azure OpenAI nao configurada: ${missing.join(", ")}`);
  }
}
