import fs from "node:fs/promises";
import path from "node:path";

type LogStatus = "success" | "error";

function maskSensitiveData(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]")
    .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g, "[telefone]")
    .replace(/\b\d{8,}\b/g, "[numero]");
}

export async function logChatQuestion(question: string, status: LogStatus): Promise<void> {
  const logsDir = path.resolve(process.cwd(), "logs");
  const logPath = path.join(logsDir, "chat.log");
  const safeQuestion = maskSensitiveData(question).replace(/\s+/g, " ").slice(0, 180);
  const line = JSON.stringify({
    date: new Date().toISOString(),
    question: safeQuestion,
    status
  });

  await fs.mkdir(logsDir, { recursive: true });
  await fs.appendFile(logPath, `${line}\n`, "utf-8");
}

export async function logUserQuestionToFrontendRoot(question: string): Promise<void> {
  const frontendRoot = path.resolve(__dirname, "../../../frontend");
  const logPath = path.join(frontendRoot, "perguntas-usuarios.txt");
  const safeQuestion = maskSensitiveData(question).replace(/\s+/g, " ").slice(0, 500);
  const line = `[${new Date().toISOString()}] ${safeQuestion}`;

  await fs.appendFile(logPath, `${line}\n`, "utf-8");
}
