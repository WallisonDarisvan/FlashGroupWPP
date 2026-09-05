const { app, BrowserWindow, ipcMain, shell, Menu, Notification, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Garante carregamento do .env tanto em desenvolvimento quanto no app empacotado (.exe)
const envCandidates = [
  path.join(process.resourcesPath || '', '.env'),
  path.join(__dirname, '.env'),
  path.join(process.cwd(), '.env')
];

for (const candidate of envCandidates) {
  if (candidate && fs.existsSync(candidate)) {
    require('dotenv').config({ path: candidate });
    break;
  }
}
require('dotenv').config();

let mainWindow = null;

// Credenciais protegidas diretamente do .env
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').trim().replace(/\/+$/, '');
const EVOLUTION_API_KEY = (process.env.EVOLUTION_API_KEY || '').trim();

// Identificador da aplicação para a barra de tarefas do Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.flashgroupwpp.app');
}

/**
 * Cria a janela principal da aplicação Electron
 */
function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#080c16',
    title: 'FlashGroup WPP - Disparo Automatizado para Grupos',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Menu de contexto com botão direito (Recortar, Copiar, Colar, Selecionar Tudo)
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const isEditable = params.isEditable;
    const menuTemplate = [];

    if (isEditable) {
      menuTemplate.push(
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Selecionar Tudo' }
      );
    } else {
      menuTemplate.push(
        { role: 'copy', label: 'Copiar' },
        { role: 'selectAll', label: 'Selecionar Tudo' }
      );
    }

    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup();
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicialização do Electron
app.whenReady().then(() => {
  setupIpcHandlers();
  setupAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Helper para validar se as credenciais do .env estão presentes
 */
function validateCredentials() {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    throw new Error('Credenciais da Evolution API não encontradas no arquivo .env.');
  }
}

/**
 * Configuração dos manipuladores de chamadas IPC
 */
function setupIpcHandlers() {
  /**
   * Handler: Checar Estado da Conexão da Instância Específica
   * Consulta na Evolution API estritamente a instância configurada para este aplicativo.
   */
  ipcMain.handle('api:check-state', async (_event, { instanceName } = {}) => {
    try {
      validateCredentials();

      const trimmed = (instanceName || '').trim();
      if (!trimmed) {
        return { success: true, state: 'close', instanceName: '', message: 'Nenhuma instância configurada.' };
      }

      const endpoint = `${EVOLUTION_API_URL}/instance/connectionState/${encodeURIComponent(trimmed)}`;
      try {
        const response = await axios.get(endpoint, {
          headers: { apikey: EVOLUTION_API_KEY },
          timeout: 10000
        });

        const state = response.data?.instance?.state || response.data?.state || 'close';
        const isConnected = state === 'open';

        console.log(`[api:check-state] Instância "${trimmed}": ${isConnected ? 'POSITIVA (open)' : 'NEGATIVA (' + state + ')'}`);
        return {
          success: true,
          state: isConnected ? 'open' : 'close',
          instanceName: trimmed,
          data: response.data
        };
      } catch (err) {
        // 404 (instância não existe ainda) ou qualquer erro de conexão = NEGATIVO (desconectado)
        console.log(`[api:check-state] Instância "${trimmed}": NEGATIVA (não encontrada ou desconectada - ${err.message})`);
        return {
          success: true,
          state: 'close',
          instanceName: trimmed,
          error: err.response?.data?.message || err.message
        };
      }
    } catch (error) {
      return {
        success: false,
        state: 'close',
        instanceName: instanceName || '',
        error: error.message
      };
    }
  });

  /**
   * Handler: Deslogar e Apagar Instância da Evolution API
   */
  ipcMain.handle('api:delete-instance', async (_event, { instanceName }) => {
    try {
      validateCredentials();
      if (!instanceName) {
        return { success: false, error: 'Nome da instância não informado.' };
      }

      const trimmedName = instanceName.trim();

      // 1. Tenta logout primeiro (caso esteja conectado)
      try {
        await axios.delete(`${EVOLUTION_API_URL}/instance/logout/${encodeURIComponent(trimmedName)}`, {
          headers: { apikey: EVOLUTION_API_KEY },
          timeout: 10000
        });
      } catch (logoutErr) {
        // Ignora erro se já estiver deslogado
      }

      // 2. Apaga a instância da Evolution API
      const response = await axios.delete(`${EVOLUTION_API_URL}/instance/delete/${encodeURIComponent(trimmedName)}`, {
        headers: { apikey: EVOLUTION_API_KEY },
        timeout: 15000
      });

      return {
        success: true,
        data: response.data,
        message: `Instância "${trimmedName}" apagada com sucesso.`
      };
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      let errorMsg = error.message;

      if (responseData && typeof responseData === 'object') {
        errorMsg = responseData.message || responseData.error || JSON.stringify(responseData);
      }

      return {
        success: false,
        status,
        error: `Falha ao apagar instância: ${errorMsg}`
      };
    }
  });

  /**
   * Handler: Conectar ou Criar Instância e Obter QR Code
   */
  ipcMain.handle('api:connect-or-create', async (_event, { instanceName }) => {
    try {
      validateCredentials();
      if (!instanceName) {
        return { success: false, error: 'Nome da instância é obrigatório.' };
      }

      const trimmedName = instanceName.trim();
      let instanceExists = false;
      let currentState = 'close';

      // 1. Checa se já existe e qual o estado
      try {
        const stateRes = await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${encodeURIComponent(trimmedName)}`, {
          headers: { apikey: EVOLUTION_API_KEY },
          timeout: 10000
        });
        instanceExists = true;
        currentState = stateRes.data?.instance?.state || stateRes.data?.state || 'close';

        if (currentState === 'open') {
          return {
            success: true,
            alreadyConnected: true,
            state: 'open',
            message: 'Instância já está conectada ao WhatsApp!'
          };
        }
      } catch (checkErr) {
        if (checkErr.response?.status === 404) {
          instanceExists = false;
        }
      }

      // 2. Cria a instância se não existir
      if (!instanceExists) {
        const createRes = await axios.post(`${EVOLUTION_API_URL}/instance/create`, {
          instanceName: trimmedName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        }, {
          headers: {
            apikey: EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        });

        const qrcodeData = createRes.data?.qrcode;
        const base64 = qrcodeData?.base64 || createRes.data?.base64;
        const pairingCode = qrcodeData?.pairingCode;

        if (base64) {
          return {
            success: true,
            base64,
            pairingCode,
            state: 'connecting',
            message: 'Escaneie o QR Code no seu WhatsApp.'
          };
        }
      }

      // 3. Conecta e busca o QR Code
      const connectRes = await axios.get(`${EVOLUTION_API_URL}/instance/connect/${encodeURIComponent(trimmedName)}`, {
        headers: { apikey: EVOLUTION_API_KEY },
        timeout: 20000
      });

      const base64 = connectRes.data?.base64 || connectRes.data?.qrcode?.base64;
      const pairingCode = connectRes.data?.pairingCode || connectRes.data?.qrcode?.pairingCode;
      const state = connectRes.data?.instance?.state || 'connecting';

      if (connectRes.data?.instance?.state === 'open') {
        return {
          success: true,
          alreadyConnected: true,
          state: 'open',
          message: 'Instância conectada com sucesso!'
        };
      }

      return {
        success: true,
        base64,
        pairingCode,
        state,
        message: 'Escaneie o QR Code abaixo com seu WhatsApp.'
      };
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      let errorMsg = error.message;

      if (responseData && typeof responseData === 'object') {
        errorMsg = responseData.message || responseData.error || JSON.stringify(responseData);
      }

      return {
        success: false,
        status,
        error: `Falha ao gerar QR Code: ${errorMsg}`
      };
    }
  });

  /**
   * Handler: Buscar Todos os Grupos da Instância
   */
  ipcMain.handle('api:fetch-groups', async (_event, { instanceName }) => {
    try {
      validateCredentials();
      const trimmedName = (instanceName || '').trim();
      if (!trimmedName) {
        return { success: false, error: 'Nome da instância não informado.' };
      }

      const endpoint = `${EVOLUTION_API_URL}/group/fetchAllGroups/${encodeURIComponent(trimmedName)}?getParticipants=false`;
      
      let response;
      try {
        response = await axios.get(endpoint, {
          headers: {
            apikey: EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 75000
        });
      } catch (firstErr) {
        // Se a instância acabou de se conectar, tenta fallback para /chat/findChats ou retry
        console.warn(`[fetchAllGroups] Primeira tentativa para "${trimmedName}" falhou, tentando /chat/findChats...`, firstErr.message);
        try {
          response = await axios.get(`${EVOLUTION_API_URL}/chat/findChats/${encodeURIComponent(trimmedName)}`, {
            headers: { apikey: EVOLUTION_API_KEY },
            timeout: 60000
          });
        } catch (secondErr) {
          throw firstErr;
        }
      }

      let groups = [];
      if (Array.isArray(response.data)) {
        groups = response.data;
      } else if (response.data && Array.isArray(response.data.groups)) {
        groups = response.data.groups;
      } else if (response.data && typeof response.data === 'object') {
        groups = Object.values(response.data);
      }

      const normalizedGroups = groups
        .filter(item => {
          if (!item) return false;
          const id = item.id || item.jid || item.remoteJid;
          return id && (String(id).endsWith('@g.us') || Boolean(item.isGroup));
        })
        .map(item => {
          const id = item.id || item.jid || item.remoteJid;
          const subject = item.subject || item.name || item.pushName || 'Grupo WhatsApp';
          return {
            id,
            subject,
            pictureUrl: item.pictureUrl || item.profilePicUrl || item.imgUrl || null,
            participantsCount: item.size || item.participants?.length || null,
            status: 'pending'
          };
        });

      console.log(`[api:fetch-groups] Retornados ${normalizedGroups.length} grupos da instância "${trimmedName}".`);
      return {
        success: true,
        data: normalizedGroups
      };
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      let errorMsg = error.message;

      if (responseData && typeof responseData === 'object') {
        errorMsg = responseData.message || responseData.error || JSON.stringify(responseData);
      }

      return {
        success: false,
        status,
        error: `Erro ao buscar grupos: ${errorMsg}`
      };
    }
  });

  /**
   * Handler: Enviar Mensagem para Grupo
   */
  ipcMain.handle('api:send-message', async (_event, { instanceName, number, text, delay }) => {
    try {
      validateCredentials();
      const trimmedName = (instanceName || '').trim();
      if (!trimmedName || !number || !text) {
        return { success: false, error: 'Parâmetros incompletos para envio.' };
      }

      let formattedNumber = String(number).trim();
      if (!formattedNumber.endsWith('@g.us') && !formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@g.us`;
      }

      const endpoint = `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(trimmedName)}`;
      const payload = {
        number: formattedNumber,
        text: text,
        delay: Number(delay) || 1200
      };

      console.log(`[api:send-message] Enviando mensagem para ${formattedNumber} usando instância "${trimmedName}"...`);
      const response = await axios.post(endpoint, payload, {
        headers: {
          apikey: EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      });

      console.log(`[api:send-message] Sucesso no envio para ${formattedNumber}! ID: ${response.data?.key?.id || 'OK'}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      let errorMsg = error.message;

      if (responseData && typeof responseData === 'object') {
        errorMsg = responseData.message || responseData.error || JSON.stringify(responseData);
      }

      console.warn(`[api:send-message] Falha no envio para ${number}: ${errorMsg} (HTTP ${status})`);
      return {
        success: false,
        status,
        error: `Falha no envio para ${number}: ${errorMsg}`
      };
    }
  });

  /**
   * Handler: Enviar Enquete (Poll) para Grupo
   */
  ipcMain.handle('api:send-poll', async (_event, { instanceName, number, name, selectableCount, values, delay }) => {
    try {
      validateCredentials();
      const trimmedName = (instanceName || '').trim();
      if (!trimmedName || !number || !name || !Array.isArray(values) || values.length < 2) {
        return { success: false, error: 'Parâmetros incompletos para envio da enquete (mínimo de 2 opções exigidas).' };
      }

      let formattedNumber = String(number).trim();
      if (!formattedNumber.endsWith('@g.us') && !formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@g.us`;
      }

      const endpoint = `${EVOLUTION_API_URL}/message/sendPoll/${encodeURIComponent(trimmedName)}`;
      const cleanValues = values.map(v => String(v).trim()).filter(Boolean);
      if (cleanValues.length < 2) {
        return { success: false, error: 'A enquete precisa de pelo menos 2 opções válidas preenchidas.' };
      }

      const payload = {
        number: formattedNumber,
        name: String(name).trim(),
        selectableCount: Math.max(1, parseInt(selectableCount, 10) || 1),
        values: cleanValues,
        delay: Number(delay) || 1200
      };

      console.log(`[api:send-poll] Enviando enquete "${payload.name}" (${payload.values.length} opções) para ${formattedNumber} via "${trimmedName}"...`);
      const response = await axios.post(endpoint, payload, {
        headers: {
          apikey: EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      });

      console.log(`[api:send-poll] Sucesso no envio da enquete para ${formattedNumber}! ID: ${response.data?.key?.id || 'OK'}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      let errorMsg = error.message;

      if (responseData && typeof responseData === 'object') {
        errorMsg = responseData.message || responseData.error || JSON.stringify(responseData);
      }

      console.warn(`[api:send-poll] Falha no envio da enquete para ${number}: ${errorMsg} (HTTP ${status})`);
      return {
        success: false,
        status,
        error: `Falha no envio da enquete para ${number}: ${errorMsg}`
      };
    }
  });

  /**
   * Handler: Buscar Mensagens Reais de um Chat / Grupo
   */
  ipcMain.handle('api:fetch-messages', async (_event, { instanceName, remoteJid, limit = 30 }) => {
    try {
      validateCredentials();
      const trimmedName = (instanceName || '').trim();
      if (!trimmedName || !remoteJid) {
        return { success: false, error: 'Parâmetros incompletos para buscar mensagens.' };
      }

      let formattedJid = String(remoteJid).trim();
      if (!formattedJid.endsWith('@g.us') && !formattedJid.includes('@')) {
        formattedJid = `${formattedJid}@g.us`;
      }

      const endpoint = `${EVOLUTION_API_URL}/chat/findMessages/${encodeURIComponent(trimmedName)}`;
      let rawMessages = [];

      try {
        const response = await axios.post(
          endpoint,
          {
            where: {
              key: {
                remoteJid: formattedJid
              }
            },
            limit: Number(limit) || 30
          },
          {
            headers: {
              apikey: EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        if (Array.isArray(response.data)) {
          rawMessages = response.data;
        } else if (response.data?.messages?.records && Array.isArray(response.data.messages.records)) {
          rawMessages = response.data.messages.records;
        } else if (response.data && Array.isArray(response.data.messages)) {
          rawMessages = response.data.messages;
        } else if (response.data && Array.isArray(response.data.records)) {
          rawMessages = response.data.records;
        }
      } catch (postErr) {
        try {
          const getRes = await axios.get(
            `${endpoint}?remoteJid=${encodeURIComponent(formattedJid)}&limit=${Number(limit) || 30}`,
            {
              headers: { apikey: EVOLUTION_API_KEY },
              timeout: 10000
            }
          );
          if (Array.isArray(getRes.data)) {
            rawMessages = getRes.data;
          } else if (getRes.data?.messages?.records && Array.isArray(getRes.data.messages.records)) {
            rawMessages = getRes.data.messages.records;
          } else if (getRes.data && Array.isArray(getRes.data.messages)) {
            rawMessages = getRes.data.messages;
          } else if (getRes.data && Array.isArray(getRes.data.records)) {
            rawMessages = getRes.data.records;
          }
        } catch (getErr) {
          console.warn('[findMessages] Nenhuma mensagem anterior retornada pela Evolution API:', getErr.message);
        }
      }

      // Normaliza as mensagens para a interface
      const normalizedMessages = rawMessages
        .map(msg => {
          const key = msg.key || {};
          const fromMe = Boolean(key.fromMe);
          const pushName = msg.pushName || (fromMe ? 'Você' : 'Participante');
          
          let text = '';
          let mediaType = null;
          let mediaDetails = null;
          const m = msg.message || {};

          if (m.conversation) {
            text = m.conversation;
          } else if (m.extendedTextMessage?.text) {
            text = m.extendedTextMessage.text;
          } else if (m.imageMessage) {
            text = m.imageMessage.caption || '';
            mediaType = 'image';
            mediaDetails = {
              mimetype: m.imageMessage.mimetype || 'image/jpeg',
              caption: m.imageMessage.caption || '',
              jpegThumbnail: m.imageMessage.jpegThumbnail ? `data:image/jpeg;base64,${Buffer.from(m.imageMessage.jpegThumbnail).toString('base64')}` : null
            };
          } else if (m.videoMessage) {
            text = m.videoMessage.caption || '';
            mediaType = 'video';
            mediaDetails = {
              mimetype: m.videoMessage.mimetype || 'video/mp4',
              caption: m.videoMessage.caption || '',
              seconds: m.videoMessage.seconds || 0
            };
          } else if (m.audioMessage) {
            text = '';
            mediaType = 'audio';
            mediaDetails = {
              mimetype: m.audioMessage.mimetype || 'audio/ogg; codecs=opus',
              seconds: m.audioMessage.seconds || 0,
              ptt: Boolean(m.audioMessage.ptt)
            };
          } else if (m.documentMessage) {
            text = m.documentMessage.caption || '';
            const fn = m.documentMessage.fileName || m.documentMessage.title || 'Documento';
            const isVideoDoc = (m.documentMessage.mimetype || '').startsWith('video/') || fn.match(/\.(mp4|mov|avi|mkv)$/i);
            const isImageDoc = (m.documentMessage.mimetype || '').startsWith('image/') || fn.match(/\.(jpg|jpeg|png|webp|gif)$/i);
            const isAudioDoc = (m.documentMessage.mimetype || '').startsWith('audio/') || fn.match(/\.(mp3|ogg|wav|m4a|aac)$/i);
            
            if (isImageDoc) {
              mediaType = 'image';
            } else if (isVideoDoc) {
              mediaType = 'video';
            } else if (isAudioDoc) {
              mediaType = 'audio';
            } else {
              mediaType = 'document';
            }

            mediaDetails = {
              fileName: fn,
              mimetype: m.documentMessage.mimetype || 'application/octet-stream',
              fileLength: m.documentMessage.fileLength?.low || m.documentMessage.fileLength || 0
            };
          } else if (m.stickerMessage) {
            text = '';
            mediaType = 'sticker';
            mediaDetails = {
              mimetype: m.stickerMessage.mimetype || 'image/webp'
            };
          } else if (typeof msg.content === 'string') {
            text = msg.content;
          }

          const rawTs = Number(msg.messageTimestamp);
          const timestamp = (!isNaN(rawTs) && rawTs > 0)
            ? (rawTs < 10000000000 ? rawTs * 1000 : rawTs)
            : (msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now());

          return {
            id: key.id || msg.id || Math.random().toString(36).substring(7),
            fromMe,
            pushName,
            text,
            mediaType,
            mediaDetails,
            timestamp,
            status: msg.status || (fromMe ? 'SENT' : 'READ')
          };
        })
        .filter(m => (m.text && m.text.trim().length > 0) || m.mediaType)
        .sort((a, b) => a.timestamp - b.timestamp);

      return {
        success: true,
        data: normalizedMessages
      };
    } catch (error) {
      console.warn('Erro ao buscar mensagens do chat:', error.message);
      return {
        success: true,
        data: [],
        warning: error.message
      };
    }
  });

  /**
   * Cache em memória para mídias baixadas (evita requisições repetidas)
   */
  const chatMediaCache = new Map();

  /**
   * Handler: Obter Mídia em Base64 de uma Mensagem para Visualização / Áudio no Chat
   */
  ipcMain.handle('api:get-media-base64', async (_event, { instanceName, messageId }) => {
    try {
      validateCredentials();
      const trimmedName = (instanceName || '').trim();
      const msgId = String(messageId || '').trim();
      if (!trimmedName || !msgId) {
        return { success: false, error: 'Parâmetros incompletos para obter mídia.' };
      }

      const cacheKey = `${trimmedName}:${msgId}`;
      if (chatMediaCache.has(cacheKey)) {
        return { success: true, ...chatMediaCache.get(cacheKey) };
      }

      const endpoint = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${encodeURIComponent(trimmedName)}`;
      const response = await axios.post(
        endpoint,
        {
          message: {
            key: {
              id: msgId
            }
          },
          convertToMp4: false
        },
        {
          headers: {
            apikey: EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 25000
        }
      );

      if (response.data && response.data.base64) {
        const rawBase64 = response.data.base64;
        const mimetype = response.data.mimetype || 'application/octet-stream';
        const mediaType = response.data.mediaType || '';
        const fileName = response.data.fileName || '';
        
        const dataUrl = rawBase64.startsWith('data:')
          ? rawBase64
          : `data:${mimetype};base64,${rawBase64}`;

        const resultData = {
          base64: dataUrl,
          mimetype,
          mediaType,
          fileName
        };

        if (chatMediaCache.size > 80) {
          const firstKey = chatMediaCache.keys().next().value;
          chatMediaCache.delete(firstKey);
        }
        chatMediaCache.set(cacheKey, resultData);

        return {
          success: true,
          ...resultData
        };
      }

      return {
        success: false,
        error: 'Nenhum base64 retornado para esta mídia.'
      };
    } catch (error) {
      console.warn(`[api:get-media-base64] Erro ao obter mídia ${messageId}:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Falha ao baixar mídia.'
      };
    }
  });

  /**
   * Handler: Enviar Mídia (Imagem, Vídeo, Documento) com Legenda
   */
  ipcMain.handle('api:send-media', async (_event, { instanceName, number, media, mediatype, mimetype, fileName, caption, thumbnail, delay }) => {
    try {
      validateCredentials();
      const trimmedName = (instanceName || '').trim();
      if (!trimmedName || !number || !media) {
        return { success: false, error: 'Parâmetros incompletos para envio de mídia.' };
      }

      let formattedNumber = String(number).trim();
      if (!formattedNumber.endsWith('@g.us') && !formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@g.us`;
      }

      const isAudio = mediatype === 'audio' ||
        (mimetype && mimetype.startsWith('audio/')) ||
        (fileName && /\.(mp3|wav|ogg|m4a|aac|opus|wma|amr)$/i.test(fileName));

      // Limpa qualquer prefixo dataUrl (ex: data:image/jpeg;base64,) para entregar base64 puro exigido pela Evolution API
      const base64Clean = String(media).replace(/^data:[^;]+;base64,/, '');

      // Se for áudio, converte e envia no formato nativo de áudio gravado do WhatsApp (PTT)
      if (isAudio) {
        const audioEndpoint = `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${encodeURIComponent(trimmedName)}`;

        const audioPayload = {
          number: formattedNumber,
          audio: base64Clean,
          encoding: true, // Converte qualquer áudio (MP3, WAV, M4A, etc.) para o codec OGG Opus gravado na hora
          delay: Number(delay) || 1200
        };

        console.log(`[api:send-media] Enviando áudio PTT para ${formattedNumber} na instância "${trimmedName}"...`);
        const response = await axios.post(audioEndpoint, audioPayload, {
          headers: {
            apikey: EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 45000
        });

        // Caso haja texto associado a este áudio na variação, envia como mensagem complementar
        if (caption && caption.trim()) {
          try {
            await axios.post(`${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(trimmedName)}`, {
              number: formattedNumber,
              text: caption.trim(),
              delay: 600
            }, {
              headers: {
                apikey: EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
              },
              timeout: 25000
            });
          } catch (textErr) {
            console.warn('Falha ao enviar texto complementar do áudio:', textErr.message);
          }
        }

        const sentAudioId = response.data?.key?.id;
        if (sentAudioId) {
          const cacheKey = `${trimmedName}:${sentAudioId}`;
          const fullAudioDataUrl = String(media).startsWith('data:') ? media : `data:${mimetype || 'audio/ogg; codecs=opus'};base64,${base64Clean}`;
          chatMediaCache.set(cacheKey, {
            base64: fullAudioDataUrl,
            mimetype: mimetype || 'audio/ogg; codecs=opus',
            mediaType: 'audio',
            fileName: fileName || 'audio.ogg'
          });
        }

        console.log(`[api:send-media] Sucesso no envio de áudio PTT para ${formattedNumber}! ID: ${response.data?.key?.id || 'OK'}`);
        return {
          success: true,
          data: response.data
        };
      }

      // Gera ou obtém thumbnail em alta compatibilidade para o WhatsApp
      let thumbBase64 = thumbnail ? String(thumbnail).replace(/^data:[^;]+;base64,/, '') : null;
      if (!thumbBase64 && (mediatype === 'image' || (mimetype && mimetype.startsWith('image/')))) {
        try {
          const fullDataUrl = String(media).startsWith('data:') ? media : `data:${mimetype || 'image/jpeg'};base64,${base64Clean}`;
          const nImg = nativeImage.createFromDataURL(fullDataUrl);
          if (!nImg.isEmpty()) {
            const resized = nImg.resize({ width: 72, height: 72, quality: 'good' });
            thumbBase64 = resized.toJPEG(60).toString('base64');
          }
        } catch (thumbErr) {
          console.warn('Aviso: Não foi possível gerar thumbnail nativo:', thumbErr.message);
        }
      }

      // Envio padrão de Imagem, Vídeo ou Documento
      const endpoint = `${EVOLUTION_API_URL}/message/sendMedia/${encodeURIComponent(trimmedName)}`;
      const payload = {
        number: formattedNumber,
        mediatype: mediatype || 'image',
        mimetype: mimetype || 'image/jpeg',
        caption: caption || '',
        media: base64Clean,
        fileName: fileName || 'arquivo',
        delay: Number(delay) || 1200
      };

      if (thumbBase64) {
        payload.thumbnail = thumbBase64;
        payload.jpegThumbnail = thumbBase64;
      }

      console.log(`[api:send-media] Enviando ${mediatype || 'mídia'} para ${formattedNumber} na instância "${trimmedName}"...`);
      const response = await axios.post(endpoint, payload, {
        headers: {
          apikey: EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      const sentMediaId = response.data?.key?.id;
      if (sentMediaId) {
        const cacheKey = `${trimmedName}:${sentMediaId}`;
        const fullMediaDataUrl = String(media).startsWith('data:') ? media : `data:${mimetype || 'application/octet-stream'};base64,${base64Clean}`;
        chatMediaCache.set(cacheKey, {
          base64: fullMediaDataUrl,
          mimetype: mimetype || 'application/octet-stream',
          mediaType: mediatype || 'image',
          fileName: fileName || '',
          jpegThumbnail: thumbBase64 ? `data:image/jpeg;base64,${thumbBase64}` : null
        });
      }

      console.log(`[api:send-media] Sucesso no envio de mídia para ${formattedNumber}! ID: ${response.data?.key?.id || 'OK'}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      let errorMsg = error.message;

      if (responseData && typeof responseData === 'object') {
        errorMsg = responseData.message || responseData.error || (Array.isArray(responseData.response?.message) ? responseData.response.message.join(', ') : JSON.stringify(responseData));
      }

      console.warn(`[api:send-media] Falha no envio para ${number}: ${errorMsg} (HTTP ${status})`);
      return {
        success: false,
        status,
        error: `Falha no envio de mídia para ${number}: ${errorMsg}`
      };
    }
  });

  /**
   * Handler: Abrir URLs externas com segurança no navegador padrão do sistema
   */
  ipcMain.handle('app:open-external', async (_event, url) => {
    try {
      if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
        await shell.openExternal(url);
        return { success: true };
      }
      return { success: false, error: 'URL inválida ou insegura.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  /**
   * Handler: Exibir notificação nativa do sistema operacional (Windows)
   */
  ipcMain.handle('app:show-notification', async (_event, { title, body } = {}) => {
    try {
      if (Notification.isSupported()) {
        const iconPath = path.join(__dirname, 'build', 'icon.ico');
        const notif = new Notification({
          title: title || 'FlashGroup WPP',
          body: body || '',
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          silent: false
        });
        notif.show();
        return { success: true };
      }
      return { success: false, error: 'Notificações não suportadas nesta plataforma.' };
    } catch (err) {
      console.warn('Falha ao emitir notificação nativa:', err.message);
      return { success: false, error: err.message };
    }
  });
}

/**
 * Configura o autoUpdater do GitHub Releases (electron-updater)
 */
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  function sendUpdateEvent(type, payload = {}) {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('app:update-event', { type, ...payload });
    }
  }

  autoUpdater.on('checking-for-update', () => {
    sendUpdateEvent('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateEvent('available', {
      version: info?.version,
      releaseNotes: info?.releaseNotes,
      releaseDate: info?.releaseDate
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateEvent('not-available', {
      version: info?.version
    });
  });

  autoUpdater.on('error', (err) => {
    sendUpdateEvent('error', {
      message: err == null ? 'Erro desconhecido ao verificar atualizações.' : (err.message || String(err))
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdateEvent('progress', {
      percent: Math.round(progressObj.percent || 0),
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateEvent('downloaded', {
      version: info?.version
    });
  });

  // Handler para checagem manual
  ipcMain.handle('app:check-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Handler para iniciar download
  ipcMain.handle('app:download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Handler para reiniciar e instalar
  ipcMain.handle('app:quit-and-install', () => {
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { success: true };
  });

  // Checagem automática 6 segundos após o início quando empacotado em produção
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('Verificação automática de atualização falhou:', err.message);
      });
    }, 6000);
  }
}

