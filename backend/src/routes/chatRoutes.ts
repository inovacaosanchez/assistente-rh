import { Router } from "express";
import { handleChat } from "../controllers/chatController";

export const chatRoutes = Router();

chatRoutes.post("/chat", handleChat);
chatRoutes.all("/chat", (_req, res) => {
  res.status(405).json({
    success: false,
    error: "Método não permitido."
  });
});
