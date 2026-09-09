# 🗺️ Mapa Completo e Arquitetura do Projeto - FlashGroup WPP

> **FlashGroup WPP** é uma aplicação desktop de nível corporativo construída com **Electron**, **Node.js** e **JavaScript Vanilla**, projetada para a gestão profissional, automação e disparo cadenciado de mensagens e enquetes em massa para grupos do WhatsApp, operando em sincronia direta com a **Evolution API v2**.

---

## 📑 Sumário

1. [Ficha Técnica do Projeto](#1-ficha-técnica-do-projeto)
2. [Arquitetura Geral e Fluxo de Dados](#2-arquitetura-geral-e-fluxo-de-dados)
3. [Mapeamento Completo de Arquivos e Diretórios](#3-mapeamento-completo-de-arquivos-e-diretórios)
4. [Processo Principal (Main Process) e Canais IPC](#4-processo-principal-main-process-e-canais-ipc)
5. [Ponte de Contexto (Preload & Context Isolation)](#5-ponte-de-contexto-preload--context-isolation)
6. [Módulos da Interface (Renderer Process) em Detalhes](#6-módulos-da-interface-renderer-process-em-detalhes)
7. [Endpoints da Evolution API v2 Utilizados](#7-endpoints-da-evolution-api-v2-utilizados)
8. [Mecanismos Anti-Bloqueio e Regras de Segurança](#8-mecanismos-anti-bloqueio-e-regras-de-segurança)
9. [Persistência de Dados e Armazenamento Local](#9-persistência-de-dados-e-armazenamento-local)
10. [Sistema de Atualização Automática (Auto-Updater)](#10-sistema-de-atualização-automática-auto-updater)
11. [Roadmap Técnico para Próximas Implementações](#11-roadmap-técnico-para-próximas-implementações)

---

## 1. Ficha Técnica do Projeto

| Atributo | Descrição / Especificação |
| :--- | :--- |
| **Nome da Aplicação** | FlashGroup WPP |
| **Versão Atual** | `v1.0.4` |
| **Plataforma Alvo** | Windows (x64) com suporte nativo de empacotamento NSIS |
| **App User Model ID** | `com.flashgroupwpp.app` |
| **Tecnologias do Core** | Electron 35, Node.js, Axios, dotenv |
| **Interface do Usuário** | HTML5 Semântico, CSS3 Moderno (Vanilla CSS), JavaScript ES6+ Modular |
| **Motor de API WhatsApp** | Evolution API v2.3.x (Sessões Baileys) |
| **Repositório GitHub** | `WallisonDarisvan/FlashGroupWPP` |
| **Distribuição / Updates**| GitHub Releases via `electron-updater` |

---

## 2. Arquitetura Geral e Fluxo de Dados

A aplicação implementa o padrão de segurança recomendado pelo Electron com **Context Isolation** e **Sandbox**, separando o acesso ao sistema operacional e credenciais protegidas da interface visual.

```
                                 ┌──────────────────────────────────────────────┐
                                 │              EVOLUTION API v2                │
                                 │  https://meus-evolution-api...easypanel.host │
                                 └──────────────▲──────────────▲────────────────┘
                                                │              │
                                         HTTP / Axios    WebSockets / QR
                                                │              │
┌───────────────────────────────────────────────▼──────────────▼────────────────┐
│                          PROCESSO PRINCIPAL (MAIN)                            │
│  [main.js]                                                                    │
│  - Leitura do arquivo .env (EVOLUTION_API_URL, EVOLUTION_API_KEY)             │
│  - Criação da BrowserWindow (1320x880)                                        │
│  - Menu de contexto nativo (Copiar, Colar, Selecionar Tudo)                   │
│  - electron-updater (Verificação, Download em segundo plano e Instalação)     │
│  - Notificações nativas do Windows (Notification API)                         │
│  - nativeImage para processamento de miniaturas JPEG                          │
└───────────────────────────────────────▲───────────────────────────────────────┘
                                        │  IPC (invoke / handle)
┌───────────────────────────────────────▼───────────────────────────────────────┐
│                           PONTE SEGURA (PRELOAD)                              │
│  [preload.js]                                                                 │
│  - contextBridge.exposeInMainWorld('electronAPI', { ... })                    │
│  - Nenhuma credencial de API é exposta ao DOM da janela                       │
└───────────────────────────────────────▲───────────────────────────────────────┘
                                        │  window.electronAPI
┌───────────────────────────────────────▼───────────────────────────────────────┐
│                       INTERFACE GRÁFICA (RENDERER)                            │
│  [renderer/index.html] - Estrutura dividida em 3 colunas                      │
│  [renderer/styles.css] - Tema dark, componentes visuais e mockups             │
│  [renderer/app.js]     - Orquestrador de inicialização e ciclo de vida         │
│  [renderer/js/*.js]    - 12 Módulos especializados desacoplados               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mapeamento Completo de Arquivos e Diretórios

### Raiz do Repositório (`/`)
* **`.env`**: Armazena as credenciais sensíveis (`EVOLUTION_API_URL` e `EVOLUTION_API_KEY`). Nunca versionado no Git.
* **`.env.example`**: Modelo público indicando as chaves necessárias para execução.
* **`.gitignore`**: Exclui `node_modules/`, `dist/`, `.env` e arquivos de log temporários.
* **`package.json`**: Metadados do projeto, dependências (`axios`, `dotenv`, `electron-updater`) e scripts (`start`, `build:win`).
* **`main.js`**: Ponto de entrada do executável Electron e processamento seguro no backend.
* **`preload.js`**: Especificação da ponte de isolamento entre Node.js e o navegador.
* **`MAPA_DO_PROJETO.md`**: Este documento técnico oficial.
* **`README.md`**: Instruções de instalação, execução e empacotamento.

### Diretório `build/`
* **`icon.ico`**: Ícone em múltiplos tamanhos (256x256, 128x128, etc.) utilizado na barra de tarefas, janelas e instalador NSIS.

### Diretório `dist/` (Gerado em compilação)
* **`FlashGroupWPP Setup 1.0.4.exe`**: Instalador auto-executável para Windows.
* **`latest.yml`**: Manifesto com checksums SHA512, tamanho e versão para o sistema de auto-atualização.

### Diretório `renderer/` (Camada Visual)
* **`index.html`**: Página principal da aplicação contendo as 3 colunas, painéis modais, drawer de terminal e containers de formulário.
* **`styles.css`**: Design system completo (mais de 4.800 linhas) definindo variáveis de cores HSL, grid flexível, mockups de celular e estados visuais.
* **`app.js`**: Orquestrador que escuta o evento `DOMContentLoaded`, vincula listeners globais e faz o boot de todos os submódulos.

### Diretório `renderer/js/` (Submódulos Especializados)
* **`state.js`**: Central de estado reativo e seletores do DOM.
* **`storage.js`**: Gerenciador de persistência local (IndexedDB e localStorage).
* **`logger.js`**: Motor de registro de logs e controle da gaveta de terminal.
* **`navigation.js`**: Gestão de modais, abas internas e métricas da barra superior.
* **`connection.js`**: Gerenciador de conexão WhatsApp, polling de status e QR Code.
* **`groups.js`**: Tabela, carregamento, filtragem e contadores de grupos.
* **`variables.js`**: Motor de interpolação de variáveis dinâmicas e chips clicáveis.
* **`variations.js`**: Gerenciador de variações de mensagens e uploads multimídia.
* **`polls.js`**: Módulo isolado de Enquetes WhatsApp (perguntas, opções e preview).
* **`campaign-templates.js`**: Exportador e importador de modelos `.fgw`.
* **`reports.js`**: Gerador e exportador de relatórios em formato Excel (.csv).
* **`dispatch.js`**: Motor de disparo assíncrono cadenciado com anti-ban.

---

## 4. Processo Principal (Main Process) e Canais IPC

Localizado em [`main.js`](file:///c:/Users/TOP%20MIDIA/Documents/GitHub/FlashGroupWPP/main.js), opera diretamente no ambiente Node.js.

### 4.1. Handlers IPC Registrados (`ipcMain.handle`)

| Canal IPC | Parâmetros Recebidos | Ação / Endpoint de Destino | Resposta |
| :--- | :--- | :--- | :--- |
| `api:connect-or-create` | `{ instanceName }` | Consulta existência; se não existir, cria via `POST /instance/create`; gera QR Code via `GET /instance/connect/{inst}` | `{ success, qrcode, pairingCode, state }` |
| `api:check-state` | `{ instanceName }` | Consulta estado da sessão via `GET /instance/connectionState/{inst}` | `{ success, state: 'open'\|'close', instanceName }` |
| `api:delete-instance` | `{ instanceName }` | Executa logout via `DELETE /instance/logout/{inst}` e exclusão via `DELETE /instance/delete/{inst}` | `{ success, message }` |
| `api:fetch-groups` | `{ instanceName }` | Obtém lista via `GET /group/fetchAllGroups/{inst}?getParticipants=false` com fallback para `/chat/findChats/{inst}` | `{ success, data: Array<Group> }` |
| `api:send-message` | `{ instanceName, number, text, delay }` | Envia mensagem de texto puro via `POST /message/sendText/{inst}` com simulação de digitação | `{ success, data }` |
| `api:send-media` | `{ instanceName, number, media, mediatype, mimetype, fileName, caption, delay }` | Envia arquivos (imagens, vídeos, documentos, áudios PTT) via `POST /message/sendMedia/{inst}` | `{ success, data }` |
| `api:send-poll` | `{ instanceName, number, name, selectableCount, values, delay }` | Envia enquetes interativas via `POST /message/sendPoll/{inst}` | `{ success, data }` |
| `api:fetch-messages` | `{ instanceName, remoteJid, limit }` | Busca histórico real de mensagens do chat via `POST /chat/findMessages/{inst}` | `{ success, data: Array<Message> }` |
| `api:get-media-base64`| `{ instanceName, messageId }` | Converte e baixa o arquivo base64 de uma mensagem antiga via `POST /chat/getBase64FromMediaMessage/{inst}` | `{ success, base64 }` |
| `app:open-external` | `url` | Abre URLs externas com segurança no navegador padrão através de `shell.openExternal(url)` | `{ success }` |
| `app:show-notification`| `{ title, body }` | Dispara notificação nativa do Windows através da classe `Notification` do Electron | `{ success }` |
| `app:check-updates` | *(Nenhum)* | Aciona a busca manual por novas releases com `autoUpdater.checkForUpdates()` | `{ success, updateInfo }` |
| `app:download-update` | *(Nenhum)* | Dispara o download da versão identificada com `autoUpdater.downloadUpdate()` | `{ success }` |
| `app:quit-and-install`| *(Nenhum)* | Fecha o FlashGroup WPP e instala o novo pacote com `autoUpdater.quitAndInstall()` | *(Reinicia)* |

---

## 5. Ponte de Contexto (Preload & Context Isolation)

Localizado em [`preload.js`](file:///c:/Users/TOP%20MIDIA/Documents/GitHub/FlashGroupWPP/preload.js), expõe exclusivamente o objeto `window.electronAPI` para a interface web com Context Isolation:

```javascript
window.electronAPI = {
  connectOrCreateInstance: (params) => ipcRenderer.invoke('api:connect-or-create', params),
  checkConnectionState:    (params) => ipcRenderer.invoke('api:check-state', params),
  deleteInstance:          (params) => ipcRenderer.invoke('api:delete-instance', params),
  fetchGroups:             (params) => ipcRenderer.invoke('api:fetch-groups', params),
  sendMessage:             (params) => ipcRenderer.invoke('api:send-message', params),
  sendMediaMessage:        (params) => ipcRenderer.invoke('api:send-media', params),
  sendPoll:                (params) => ipcRenderer.invoke('api:send-poll', params),
  fetchChatMessages:       (params) => ipcRenderer.invoke('api:fetch-messages', params),
  getMediaBase64:          (params) => ipcRenderer.invoke('api:get-media-base64', params),
  openExternal:            (url) => ipcRenderer.invoke('app:open-external', url),
  showNotification:        (params) => ipcRenderer.invoke('app:show-notification', params),
  checkForUpdates:         () => ipcRenderer.invoke('app:check-updates'),
  downloadUpdate:          () => ipcRenderer.invoke('app:download-update'),
  quitAndInstall:          () => ipcRenderer.invoke('app:quit-and-install'),
  onUpdateEvent:           (callback) => ipcRenderer.on('app:update-event', (_event, data) => callback(data))
};
```

---

## 6. Módulos da Interface (Renderer Process) em Detalhes

### 6.1. `state.js` (Gerenciador de Estado)
Centraliza o estado reativo da aplicação em `window.FGW.state`:
* `connectionStatus`: Estado atual da sessão (`'disconnected'`, `'loading'`, `'connected'`).
* `activeInstanceName`: Nome da instância conectada.
* `campaignType`: Tipo de campanha em execução: `'messages'` (Texto/Mídia) ou `'polls'` (Enquetes WhatsApp).
* `groups`: Array de grupos carregados da Evolution API (`{ id, subject, pictureUrl, participantsCount }`).
* `selectedGroupIds`: Set de strings com os IDs dos grupos marcados para disparo.
* `groupCustomTags`: Mapeamento `{ [groupId]: 'Identificador do Grupo' }`.
* `customVariables`: Lista de variáveis personalizadas criadas pelo usuário (`[{ name, type, defaultValue }]`).
* `groupCustomVars`: Valores específicos das variáveis para cada grupo `{ [groupId]: { [varName]: 'valor' } }`.
* `messageVariations`: Lista de variações de mensagem gerais (`[{ text, media, mediaEnabled }]`).
* `pollVariations`: Lista de variações de enquete (`[{ id, name, selectableCount, values }]`).
* `isDispatching` & `cancelRequested`: Controle de concorrência e parada do motor de envio.
* `stats`: Métricas de progresso (`total`, `success`, `failed`, `remaining`).

### 6.2. `storage.js` (Persistência com IndexedDB e LocalStorage)
* Utiliza o **IndexedDB** (`FlashGroupDB`, object store `mediaStore`) para armazenar mídias pesadas (vídeos de alta resolução, áudios e imagens) evitando os limites de 5MB do `localStorage`.
* Salva e restaura automaticamente:
  * Delays padrão e de presença (`minDelay`, `maxDelay`, `presenceDelay`).
  * Último nome de instância utilizado.
  * Grupos selecionados e identificadores personalizados salvos.

### 6.3. `logger.js` (Console de Auditoria)
* Registra todas as ações da aplicação com timestamps no formato `[HH:MM:SS]`.
* Formata tags visuais coloridas: `[INFO]` (Azul), `[SUCESSO]` (Verde), `[AVISO]` (Amarelo), `[ERRO]` (Vermelho) e `[SISTEMA]` (Roxo).
* Controla a gaveta retrátil inferior (Terminal Drawer) com atalho no rodapé.

### 6.4. `navigation.js` (Abas e Resumo da Campanha)
* Atualiza a barra de resumo superior em tempo real: Modo de envio (`💬 Mensagens` vs `📊 Enquetes`), total de grupos selecionados, variações válidas e cadência.
* Controla a abertura do modal unificado de configurações (`#settingsModal`) e abas internas (Conexão WhatsApp e Delays).

### 6.5. `connection.js` (Ciclo de Conexão WhatsApp)
* Gerencia o polling inteligente de QR Code (checagem a cada 2,5 segundos do estado da sessão).
* Detecta quando a conexão foi estabelecida no celular e transiciona automaticamente para o estado conectado sem travamento de interface.
* Permite logout e exclusão total da instância na Evolution API.

### 6.6. `groups.js` (Gestão de Grupos)
* Renderiza a tabela de grupos com avatar oficial, título, contagem de participantes e identificador personalizado inline.
* Alternador de filtro: **Todos os Grupos** vs **Apenas Selecionados**.
* Busca em tempo real por nome ou ID do grupo com debounce.

### 6.7. `variables.js` (Variáveis Dinâmicas)
* Gerencia a substituição regex de tags no texto:
  * `{ID do Grupo}`: Substitui pelo identificador personalizado ou pelo nome do grupo.
  * `{Nome do Grupo}`: Substitui pelo título original do grupo no WhatsApp.
  * `{NomeVariavel}`: Substitui pelo valor personalizado para aquele grupo ou pelo valor padrão global.
* Barra de chips clicáveis que inserem as tags diretamente na posição exata do cursor onde o usuário estava digitando.

### 6.8. `variations.js` (Variações de Mensagens)
* Suporte a múltiplos formatos de mídia em cada variação:
  * **Imagens**: JPEG, PNG, WEBP.
  * **Vídeos**: MP4 com preview nativo.
  * **Áudios**: Gravação ou upload com conversão para PTT e player de reprodução interativo com onda sonora.
  * **Documentos**: PDF, planilhas, arquivos compactados com metadados de tamanho e formato.
* Geração automática de miniaturas JPEG (Thumbnail) via Canvas e Electron `nativeImage`.
* Botão **"Enviar ao Grupo"** em cada card para envio avulso de teste diretamente para o grupo ativo.

### 6.9. `polls.js` (Módulo Exclusivo de Enquetes)
* Totalmente segregado do envio de mensagens tradicionais.
* Permite definir:
  * Pergunta da enquete (com suporte a tags `{Nome do Grupo}` e `{ID do Grupo}`).
  * De 2 até 12 opções dinâmicas de voto.
  * Tipo de resposta: Voto Único (1 voto) ou Múltipla Escolha.
* Balão de simulação do WhatsApp no preview móvel exibindo a enquete exatamente como é recebida no smartphone.
* Botão dedicado **"Enviar ao Grupo"** para teste imediato de enquete.

### 6.10. `campaign-templates.js` (Modelos .fgw)
* Exporta o conjunto completo de variações, textos, configurações de mídia e tags em um arquivo JSON criptografado/estruturado com extensão `.fgw`.
* Importa modelos pré-configurados com validação de schema para agilizar a criação de novas campanhas.

### 6.11. `reports.js` (Relatórios em Excel)
* Coleta cada disparo em tempo real (Grupo, ID, Horário, Variação Utilizada, Tipo de Mídia, Status de Entrega, ID da Mensagem e Mensagem de Erro).
* Gera planilha em formato CSV com **UTF-8 com BOM (`\uFEFF`)**, garantindo abertura direta no Microsoft Excel com acentuação e caracteres especiais intactos.

### 6.12. `dispatch.js` (Motor de Disparo)
* Implementa o algoritmo de embaralhamento **Fisher-Yates** para distribuição aleatória da ordem de envio entre os grupos.
* Cadência humanizada: sorteio de tempo de espera aleatório entre `minDelay` e `maxDelay` antes de cada envio.
* Simulação de presença prévia (`presenceDelay`) com status "Digitando..." no grupo antes do disparo da mensagem.
* Trava de segurança anti-queda: se detectar 3 falhas consecutivas de conexão com o WhatsApp, pausa imediatamente a campanha para resguardar o chip.
* Emite notificação nativa do Windows ao concluir todos os disparos.

---

## 7. Endpoints da Evolution API v2 Utilizados

| Método | Endpoint | Função no Aplicativo |
| :--- | :--- | :--- |
| `GET` | `/instance/connectionState/{instancia}` | Verifica se a sessão está `open`, `connecting` ou `close`. |
| `POST` | `/instance/create` | Cria a instância com opções de webhook e integração desativadas. |
| `GET` | `/instance/connect/{instancia}` | Gera e renova o QR Code em base64 e código de pareamento. |
| `DELETE` | `/instance/logout/{instancia}` | Desconecta a sessão do WhatsApp ativa. |
| `DELETE` | `/instance/delete/{instancia}` | Remove completamente a instância da Evolution API. |
| `GET` | `/group/fetchAllGroups/{instancia}?getParticipants=false` | Retorna todos os grupos com ID, nome e imagem de perfil. |
| `POST` | `/message/sendText/{instancia}` | Disparo de mensagens de texto com delay de presença. |
| `POST` | `/message/sendMedia/{instancia}` | Disparo de arquivos multimídia (imagem, vídeo, áudio e doc). |
| `POST` | `/message/sendPoll/{instancia}` | Disparo nativo de enquetes com pergunta e lista de opções. |
| `POST` | `/chat/findMessages/{instancia}` | Carrega histórico de mensagens reais para visualização no chat. |
| `POST` | `/chat/getBase64FromMediaMessage/{instancia}` | Obtém arquivo base64 de áudio/imagem para visualização na UI. |

---

## 8. Mecanismos Anti-Bloqueio e Regras de Segurança

Para mitigar os riscos de restrição ou banimento pelo WhatsApp, o FlashGroup WPP implementa uma camada quádrupla de segurança:

1. **Variações Obrigatórias (Anti-Ban):** Bloqueio de disparo se o usuário cadastrar menos de 3 variações de conteúdo. Cada grupo recebe uma variação sorteada aleatoriamente.
2. **Intervalos Humanizados Variáveis:** Os disparos não seguem intervalos fixos. O usuário define uma faixa (exemplo: 20s a 50s), e a aplicação sorteia um tempo diferente a cada grupo.
3. **Presença e Simulação de Digitação:** O parâmetro `delay` instrui a Evolution API a emitir o evento "digitando..." no grupo pelo tempo estipulado antes de despachar a mensagem.
4. **Proteção Automática por Queda:** Caso a conexão oscile e 3 mensagens seguidas falhem por desconexão, a fila é imediatamente interrompida para evitar acúmulo de requisições rejeitadas.

---

## 9. Persistência de Dados e Armazenamento Local

A aplicação adota uma estratégia híbrida de armazenamento local:

```
┌───────────────────────────────────────────────────────────┐
│              ESTRATÉGIA HÍBRIDA DE ARMAZENAMENTO          │
├─────────────────────────────┬─────────────────────────────┤
│        LOCALSTORAGE         │         INDEXEDDB           │
│   (Configurações Rápidas)   │     (Mídias Pesadas)        │
├─────────────────────────────┼─────────────────────────────┤
│ - Nome da instância         │ - Fotos e Imagens em Base64 │
│ - Delays mínimo e máximo    │ - Vídeos MP4                │
│ - Filtros de exibição       │ - Áudios gravados (PTT)     │
│ - Enquetes cadastradas      │ - Documentos PDF            │
│ - IDs de grupos selecionados│ - Variações customizadas    │
└─────────────────────────────┴─────────────────────────────┘
```

---

## 10. Sistema de Atualização Automática (Auto-Updater)

O FlashGroup WPP possui integração nativa com o **GitHub Releases** por meio do `electron-updater`:

1. **Checagem Silenciosa e Manual:** Na inicialização e através do botão *"Verificar Atualizações"* no sub-rodapé.
2. **Download em Segundo Plano:** O download é realizado de forma não-bloqueante exibindo barra de progresso percentual na interface.
3. **Instalação com 1 Clique:** Ao concluir o download, o modal oferece o botão *"Reiniciar e Instalar Agora"*, aplicando o patch automaticamente sem necessidade de reinstalação manual pelo usuário.

---

## 11. Roadmap Técnico para Próximas Implementações

As seguintes funcionalidades estão mapeadas para desenvolvimento em novos módulos independentes:

### 1. Menção a Todos (@everyone / @todos)
* **Objetivo:** Adicionar funcionalidade para marcar todos os participantes do grupo no envio.
* **Mecanismo:** Consultar `participants` do grupo e injetar seus JIDs no campo `mentioned` da Evolution API.

### 2. Agendamento de Campanhas (Scheduler)
* **Objetivo:** Permitir programar o disparo para uma data e horário específicos.
* **Mecanismo:** Módulo em segundo plano utilizando `node-schedule` ou alarmes do Electron persistidos localmente.

### 3. Disparo de Figurinhas (Stickers)
* **Objetivo:** Envio de figurinhas animadas ou estáticas em formato WebP.
* **Mecanismo:** Endpoint `/message/sendSticker` com conversor automático de proporção 1:1.

### 4. Fixar Mensagem no Topo do Grupo (Pin Message)
* **Objetivo:** Fixar comunicados importantes diretamente no topo do grupo após o envio.
* **Mecanismo:** Utilizar endpoint `/chat/pinMessage` informando o ID da mensagem enviada e duração (24h, 7 dias ou 30 dias).

### 5. Reações com Emojis
* **Objetivo:** Reagir automaticamente com emojis a mensagens recentes nos grupos.
* **Mecanismo:** Endpoint `/message/sendReaction` associado ao ID da última mensagem.

### 6. Administração de Grupos em Massa
* **Objetivo:** Atualizar título, descrição, foto de perfil ou fechar/abrir grupos para administradores em lote.
* **Mecanismo:** Endpoints `/group/updateGroupSubject`, `/group/updateGroupDescription` e `/group/updateSetting`.

### 7. Envio de Contatos (vCard) e Localização
* **Objetivo:** Envio direto de cartões de contato comercial e coordenadas de mapas.
* **Mecanismo:** Endpoints `/message/sendContact` e `/message/sendLocation`.

### 8. Modo Aquecimento de Chip (Warm-up)
* **Objetivo:** Troca mútua e automatizada de mensagens entre duas ou mais instâncias conectadas para maturação de novos números.
* **Mecanismo:** Motor de conversa cruzada com intervalos inteligentes e diálogos pré-cadastrados.

### 9. Extrator de Contatos dos Grupos
* **Objetivo:** Baixar lista completa de participantes e administradores dos grupos selecionados em formato Excel.
* **Mecanismo:** Chamada a `/group/findGroupInfos/{inst}` e exportação estruturada em planilha CSV.
