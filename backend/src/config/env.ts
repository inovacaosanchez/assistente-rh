import dotenv from "dotenv";

dotenv.config();

function parseFrontendUrls(value: string | undefined): string[] {
  const configuredUrls = (value ?? "http://localhost:5173")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  return Array.from(new Set(configuredUrls));
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
  azureOpenAIModel: process.env.AZURE_OPENAI_MODEL ?? "gpt-4o-mini",
  azureOpenAITimeoutMs: Number(process.env.AZURE_OPENAI_TIMEOUT_MS ?? 30000)
};

export function validateAzureConfig(): void {
  const missing: string[] = [];

  if (!env.azureOpenAIEndpoint) missing.push("AZURE_OPENAI_ENDPOINT");
  if (!env.azureOpenAIApiKey) missing.push("AZURE_OPENAI_API_KEY");
  if (!env.azureOpenAIDeployment) missing.push("AZURE_OPENAI_DEPLOYMENT");

  if (missing.length > 0) {
    throw new Error(`Azure OpenAI nao configurada: ${missing.join(", ")}`);
  }
}
