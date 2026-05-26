import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env";
import { chatRoutes } from "./routes/chatRoutes";

export const app = express();

app.disable("x-powered-by");

interface HttpError extends Error {
  status?: number;
  type?: string;
}

function isHttpError(error: Error): error is HttpError {
  return "status" in error || "type" in error;
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendUrls.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem não permitida pelo CORS."));
    },
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json({ limit: "32kb" }));

app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  if (isHttpError(error) && error.status === 413) {
    res.status(413).json({
      success: false,
      error: "Requisição muito grande."
    });
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(400).json({
      success: false,
      error: "JSON inválido na requisição."
    });
    return;
  }

  next(error);
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api", chatRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Rota não encontrada."
  });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Erro inesperado:", error);

  res.status(500).json({
    success: false,
    error: "Não foi possível processar sua solicitação no momento."
  });
});
