# Backend - Chatbot RH Sanchez

Backend Node.js, Express e TypeScript do MVP do assistente interno de RH da Sanchez. Ele recebe mensagens do frontend, carrega o contexto local em TXT e encaminha a conversa para a Azure OpenAI.

## Instalação

```bash
npm install
```

## Configuração

Copie `.env.example` para `.env` e preencha as variáveis da Azure OpenAI:

```bash
PORT=3001
HOST=0.0.0.0
FRONTEND_URL=http://localhost:5173
AZURE_OPENAI_ENDPOINT=https://SEU_RECURSO.openai.azure.com
AZURE_OPENAI_API_KEY=sua-chave-aqui
AZURE_OPENAI_DEPLOYMENT=nome-do-deployment
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_ASSISTANTS_API_VERSION=2024-05-01-preview
AZURE_OPENAI_ASSISTANT_ID=
AZURE_OPENAI_ASSISTANT_NAME=AgenteRH
AZURE_OPENAI_VECTOR_STORE_IDS=vs_Sx3XjRGcZOYzW5JHpJWBuD8V
AZURE_OPENAI_MODEL=gpt-4o-mini
AZURE_OPENAI_ASSISTANTS_TIMEOUT_MS=90000
AZURE_OPENAI_FAST_LOCAL_FIRST=false
AZURE_OPENAI_ANSWER_CACHE_TTL_MS=3600000
AZURE_OPENAI_ANSWER_CACHE_MAX_ITEMS=100
```

## Rodando localmente

```bash
npm run dev
```

Para liberar na rede local, mantenha `HOST=0.0.0.0` no `.env` e configure `FRONTEND_URL` com o endereço usado pelos colaboradores, por exemplo:

```bash
FRONTEND_URL=http://192.168.0.50:5173
```

Se quiser permitir acesso local e pela rede ao mesmo tempo, informe as origens separadas por vírgula:

```bash
FRONTEND_URL=http://localhost:5173,http://192.168.0.50:5173
```

Para build e execução em modo compilado:

```bash
npm run build
npm start
```

## Testando o endpoint

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Como solicito férias?\",\"history\":[]}"
```

Resposta esperada:

```json
{
  "success": true,
  "answer": "..."
}
```

## Editando o contexto do RH

O contexto fica em `contextos/rh_sanchez.txt`. Edite esse arquivo para atualizar a base fixa usada pelo assistente. Neste MVP, o contexto é carregado do arquivo local, sem banco de dados e sem RAG.

## Configurando a Azure OpenAI

No Azure AI Foundry ou portal da Azure, crie um recurso Azure OpenAI, faça o deploy de um modelo compatível e preencha:

- `AZURE_OPENAI_ENDPOINT`: endpoint do recurso.
- `AZURE_OPENAI_API_KEY`: chave do recurso.
- `AZURE_OPENAI_DEPLOYMENT`: nome do deployment.
- `AZURE_OPENAI_API_VERSION`: versão da API.
- `AZURE_OPENAI_MODEL`: modelo usado como referência.

A chave nunca deve ser exposta no frontend.

### Usando Azure Assistants com file_search

O backend mantem o mesmo endpoint `/api/chat`, mas passa a usar o fluxo de Assistants quando uma destas variaveis estiver preenchida:

- `AZURE_OPENAI_ASSISTANT_ID`: id de um Assistant ja criado na Azure.
- `AZURE_OPENAI_VECTOR_STORE_IDS`: um ou mais vector stores separados por virgula.

Se `AZURE_OPENAI_ASSISTANT_ID` estiver vazio e `AZURE_OPENAI_VECTOR_STORE_IDS` estiver preenchido, o backend cria um Assistant em memoria no primeiro uso com este payload:

```json
{
  "name": "AgenteRH",
  "model": "nome-do-deployment",
  "tools": [
    {
      "type": "file_search"
    }
  ],
  "tool_resources": {
    "file_search": {
      "vector_store_ids": ["vs_Sx3XjRGcZOYzW5JHpJWBuD8V"]
    }
  },
  "temperature": 1,
  "top_p": 1
}
```

Para evitar criar um novo Assistant a cada reinicio do servidor, crie o Assistant uma vez na Azure e salve o id retornado em `AZURE_OPENAI_ASSISTANT_ID`.

Na Azure, o campo `model` deve ser o nome do deployment configurado em `AZURE_OPENAI_DEPLOYMENT`.

Como respostas com `file_search` podem demorar mais do que chat completions simples, `AZURE_OPENAI_ASSISTANTS_TIMEOUT_MS` controla apenas o timeout do fluxo de Assistants.

Para reduzir latencia em bases locais completas, `AZURE_OPENAI_FAST_LOCAL_FIRST=true` tenta primeiro responder com o contexto local via chat completions. Neste projeto, como a base principal esta no vector store, o valor recomendado e `false`.

Respostas bem-sucedidas do Assistant ficam em cache de memoria por `AZURE_OPENAI_ANSWER_CACHE_TTL_MS`, limitado por `AZURE_OPENAI_ANSWER_CACHE_MAX_ITEMS`. Isso acelera perguntas repetidas e frequentes sem mudar o contrato do frontend.

Se o frontend estiver rodando em outro host local, como `http://127.0.0.1:5173` ou no IP da máquina, ajuste `FRONTEND_URL` no `.env` do backend. Também é possível informar mais de uma origem separando por vírgula.

## Limitações do MVP

- Não possui autenticação.
- Não usa banco de dados.
- Não possui RAG ou busca semântica.
- Mantém histórico apenas no frontend.
- Logs são simples e locais.
- O assistente não consulta, altera ou confirma dados pessoais.
