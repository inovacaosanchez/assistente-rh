import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { sendChatMessage } from "../services/chatService";
import { ChatMessage } from "../types/chat";

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content: "Olá! Sou o assistente virtual do RH da Sanchez. Como posso ajudar?"
};

const QUICK_QUESTIONS = [
  "Onde posso ver meu holerite?",
  "Como solicito férias?",
  "Como envio um atestado?",
  "Como funciona o banco de horas?",
  "Quais benefícios posso consultar?"
];

export function ChatRh() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const canSubmit = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  async function sendMessage(rawMessage: string) {
    const userMessage = rawMessage.trim();
    if (!userMessage || isLoading) return;

    const previousMessages = messages;
    const nextMessages: ChatMessage[] = [...previousMessages, { role: "user", content: userMessage }];

    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(userMessage, previousMessages);

      if (!response.success || !response.answer) {
        throw new Error(response.error ?? "Não foi possível processar sua solicitação no momento.");
      }

      setMessages((current) => [...current, { role: "assistant", content: response.answer ?? "" }]);
    } catch {
      setError("Não foi possível processar sua solicitação no momento.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Desculpe, não consegui responder agora. Tente novamente em instantes ou fale com o RH."
        }
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    void sendMessage(input);
  }

  function handleQuickQuestion(question: string) {
    void sendMessage(question);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <main className="chat-page">
      <header className="brand-header">
        {!logoUnavailable && (
          <div className="brand-logo-wrap">
            <img
              className="brand-logo"
              src="/logo-sanchez.png"
              alt="Sanchez & Sanchez sociedade de advogados"
              onError={() => setLogoUnavailable(true)}
            />
          </div>
        )}

        <div
          className={`brand-mark ${logoUnavailable ? "" : "brand-mark-fallback"}`}
          aria-label="Sanchez e Sanchez sociedade de advogados"
        >
          <span className="brand-name">Sanchez</span>
          <span className="brand-amp">&amp;</span>
          <span className="brand-name">Sanchez</span>
          <span className="brand-subtitle">sociedade de advogados</span>
        </div>

      </header>

      <section className="hero-band">
        <div className="hero-inner">
          <div>
            <p>Assistente RH Sanchez</p>
            <h1>Canal interno de atendimento</h1>
          </div>
        </div>
      </section>

      <section className="chat-layout" aria-label="Chat do RH Sanchez">
        <aside className="chat-intro">
          <p className="intro-kicker">Recursos Humanos</p>
          <h2>Tire suas dúvidas de forma rápida</h2>
          <p>
            Atendimento virtual para dúvidas gerais sobre processos de RH, com respostas baseadas nas orientações
            internas disponíveis.
          </p>

          <div className="quick-panel" aria-label="Perguntas frequentes">
            <p>Dúvidas frequentes</p>
            <div className="quick-list">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  className="quick-question"
                  type="button"
                  key={question}
                  disabled={isLoading}
                  onClick={() => handleQuickQuestion(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="chat-shell" aria-label="Mensagens do assistente">
          <header className="chat-header">
            <div>
              <p className="chat-kicker">Atendimento virtual</p>
              <h2>Conversa com o RH</h2>
            </div>
            <span className="status-pill">Online</span>
        </header>

          <div className="messages" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`message message-${message.role}`} key={`${message.role}-${index}`}>
                <div className="message-label">{message.role === "user" ? "Você" : "Assistente"}</div>
                <p>{message.content}</p>
              </article>
            ))}

            {isLoading && (
              <article className="message message-assistant loading-message">
                <div className="message-label">Assistente</div>
                <p>Pensando...</p>
              </article>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && <div className="error-banner">{error}</div>}

          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua dúvida sobre RH..."
              rows={2}
              maxLength={2000}
              disabled={isLoading}
              aria-label="Mensagem para o assistente"
            />
            <button type="submit" disabled={!canSubmit}>
              {isLoading ? "Enviando" : "Enviar"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
