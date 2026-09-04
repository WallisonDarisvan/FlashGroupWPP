# FlashGroup WPP ⚡

Aplicação desktop profissional desenvolvida com **Electron**, **Node.js** e integrada com a **Evolution API v2** para envio automatizado, cadenciado e inteligente de mensagens em massa para grupos do WhatsApp.

---

## 🚀 Novidades desta Versão

- **🔐 Credenciais Protegidas via `.env`:**
  - URL Base e API Key Global gerenciadas de forma transparente pelo arquivo `.env`.
  - Chave de API oculta/protegida no backend (`main.js`), nunca trafegando em texto puro desnecessariamente no frontend.
- **📱 Conexão com WhatsApp via QR Code:**
  - Botão destacado **"Conectar WhatsApp (QR Code)"**.
  - Criação automática da instância via Evolution API v2 (`WHATSAPP-BAILEYS`).
  - Modal elegante com o QR Code nítido e instruções passo a passo para escanear no celular.
  - Detecção automática da leitura do QR Code via polling em tempo real.
  - Carregamento automático dos grupos da instância logo após a leitura do QR Code.
- **🗑️ Deslogar e Apagar Instância:**
  - Botão **"Deslogar / Apagar Instância"** com confirmação de segurança.
  - Executa o logout no WhatsApp e apaga completamente a instância da Evolution API via `DELETE /instance/delete/${instanceName}`.
- **📎 Mídia Individual por Variação (Imagens, Vídeos, PDFs):**
  - Cada variação de mensagem pode conter sua própria mídia independente (anexo exclusivo de imagem, vídeo ou PDF).
  - Variações com mídia são enviadas com o arquivo e o texto correspondente como legenda (*caption*).
  - Variações sem mídia são enviadas automaticamente como texto puro.
  - Pré-visualização compacta, botão para trocar ou remover anexo de cada variação de forma individual.
- **🏷️ Identificação Personalizada de Grupos & Variáveis Dinâmicas (`{ID do Grupo}`):**
  - Nomeie cada grupo diretamente na tabela (ex: "Grupo 1", "Grupo VIP", etc.).
  - As identificações personalizadas são salvas automaticamente.
  - No texto da mensagem ou na legenda da mídia, use a tag `{ID do Grupo}` (ou o botão rápido de atalho).
  - Durante os disparos, o sistema substitui automaticamente a tag `{ID do Grupo}` pelo nome/identificador que você definiu para aquele grupo específico.

---

## 🚀 Funcionalidades Principais

- **Arquitetura Segura Electron:**
  - `contextIsolation: true` e `nodeIntegration: false`.
  - Requisições HTTP executadas no processo principal (`main.js`) via IPC, eliminando restrições de CORS.
- **Variações de Mensagem (Anti-Spam / Anti-Ban):**
  - Cadastro dinâmico de múltiplas variações de mensagens.
  - Bloqueio de disparo caso não haja pelo menos **3 variações** cadastradas.
  - Seleção pseudoaleatória de variação a cada envio.
- **Cadência e Delays Configuráveis:**
  - Intervalo mínimo e máximo aleatório entre envios (padrão: 20s a 50s).
  - Digitação simulada (`presence delay` em ms, padrão: 1200ms).
- **Gerenciador de Grupos com Ações Rápidas:**
  - Tabela responsiva com status individual de envio.
  - Filtro e busca em tempo real por nome ou ID do grupo.
  - Botões rápidos: **"Selecionar Todos"**, **"Limpar Seleção"** e **"20 Aleatórios"**.
  - Embaralhamento da fila de envio com algoritmo **Fisher-Yates**.
- **Painel de Execução & Terminal em Tempo Real:**
  - Barra de progresso percentual e contadores (Enviados, Falhas, Restantes).
  - Terminal de logs com timestamps e cores indicativas.
  - Botão de parada e cancelamento imediato a qualquer momento.

---

## 🛠️ Como Executar

### 1. Configurar o arquivo `.env`
O arquivo `.env` na raiz já contém as credenciais configuradas:
```env
EVOLUTION_API_URL=https://meus-evolution-api.8bzkpj.easypanel.host
EVOLUTION_API_KEY=429683C4C977415CAAFCCE10F7D57F15
```

### 2. Iniciar a aplicação
```bash
npm start
```

### 3. Conectar seu WhatsApp
1. No painel esquerdo, defina um nome para sua instância (ex: `zap-disparador`).
2. Clique no botão verde **"Conectar WhatsApp (QR Code)"**.
3. Abra o WhatsApp no seu smartphone > **Aparelhos conectados** > **Conectar um aparelho**.
4. Aponte a câmera para o QR Code na tela.
5. A aplicação detectará a conexão e carregará os seus grupos automaticamente!
