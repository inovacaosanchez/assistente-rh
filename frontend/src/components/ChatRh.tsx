import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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

function cleanAssistantContent(content: string): string {
  return content
    .replace(/【[^】]+】/g, "")
    .replace(/\[\d+:\d+†[^\]]+\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }

      return part;
    });
}

function renderMessageContent(content: string): ReactNode {
  const lines = cleanAssistantContent(content).split("\n");
  const blocks: ReactNode[] = [];
  let orderedListItems: string[] = [];
  let unorderedListItems: string[] = [];

  function flushOrderedList() {
    if (orderedListItems.length === 0) return;

    blocks.push(
      <ol key={`ol-${blocks.length}`}>
        {orderedListItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ol>
    );
    orderedListItems = [];
  }

  function flushUnorderedList() {
    if (unorderedListItems.length === 0) return;

    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {unorderedListItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    unorderedListItems = [];
  }

  function flushLists() {
    flushOrderedList();
    flushUnorderedList();
  }

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushLists();
      return;
    }

    const numberedItem = trimmedLine.match(/^\d+\.\s+(.+)$/);
    const bulletItem = trimmedLine.match(/^[-*]\s+(.+)$/);

    if (numberedItem) {
      flushUnorderedList();
      orderedListItems.push(numberedItem[1]);
      return;
    }

    if (bulletItem) {
      flushOrderedList();
      unorderedListItems.push(bulletItem[1]);
      return;
    }

    flushLists();
    blocks.push(<p key={`p-${blocks.length}`}>{renderInlineMarkdown(trimmedLine)}</p>);
  });

  flushLists();

  return <div className="message-content">{blocks}</div>;
}

export function ChatRh() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [conversationId, setConversationId] = useState<string | undefined>();
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
      const response = await sendChatMessage(userMessage, previousMessages, conversationId);

      if (!response.success || !response.answer) {
        throw new Error(response.error ?? "Não foi possível processar sua solicitação no momento.");
      }

      if (response.conversationId) {
        setConversationId(response.conversationId);
      }

      setMessages((current) => [...current, { role: "assistant", content: cleanAssistantContent(response.answer ?? "") }]);
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
                {renderMessageContent(message.content)}
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
