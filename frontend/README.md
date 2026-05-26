# Frontend - Chatbot RH Sanchez

Frontend React, Vite e TypeScript do MVP do assistente interno de RH da Sanchez. A interface conversa apenas com o backend Node.js e nunca acessa a Azure OpenAI diretamente.

## Instalação

```bash
npm install
```

## Configuração

Copie `.env.example` para `.env`:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

## Rodando com Vite

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:5173`.

## Gerando build

```bash
npm run build
```

Para visualizar o build localmente:

```bash
npm run preview
```

## Observações

- O histórico fica apenas em estado local do navegador.
- O frontend envia mensagens para `POST /api/chat` no backend.
- A chave da Azure OpenAI deve existir somente no `.env` do backend.
