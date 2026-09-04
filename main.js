require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');

let mainWindow = null;

// Credenciais protegidas diretamente do .env
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').trim().replace(/\/+$/, '');
const EVOLUTION_API_KEY = (process.env.EVOLUTION_API_KEY || '').trim();

/**
 * Cria a janela principal da aplicação Electron
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#080c16',
    title: 'FlashGroup WPP - Disparo Automatizado para Grupos',
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicialização do Electron
app.whenReady().then(() => {
  setupIpcHandlers();
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
   * Handler: Checar Estado da Conexão da Instância
   */
  ipcMain.handle('api:check-state', async (_event, { instanceName }) => {
    try {
      validateCredentials();
      if (!instanceName) {
        return { success: false, error: 'Nome da instância não informado.' };
      }

      const endpoint = `${EVOLUTION_API_URL}/instance/connectionState/${encodeURIComponent(instanceName.trim())}`;
      const response = await axios.get(endpoint, {
        headers: { apikey: EVOLUTION_API_KEY },
        timeout: 10000
      });

      const state = response.data?.instance?.state || response.data?.state || 'unknown';
      return { success: true, state, data: response.data };
    } catch (error) {
      const status = error.response?.status;
      return {
        success: false,
        status,
        error: error.response?.data?.message || error.message
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
      if (!instanceName) {
        return { success: false, error: 'Nome da instância não informado.' };
      }

      const endpoint = `${EVOLUTION_API_URL}/group/fetchAllGroups/${encodeURIComponent(instanceName.trim())}?getParticipants=false`;
      const response = await axios.get(endpoint, {
        headers: {
          apikey: EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 35000
      });

      let groups = [];
      if (Array.isArray(response.data)) {
        groups = response.data;
      } else if (response.data && Array.isArray(response.data.groups)) {
        groups = response.data.groups;
      } else if (response.data && typeof response.data === 'object') {
        groups = Object.values(response.data);
      }

      const normalizedGroups = groups
        .filter(item => item && (item.id || item.jid))
        .map(item => {
          const id = item.id || item.jid;
          const subject = item.subject || item.name || 'Grupo sem nome';
          return {
            id,
            subject,
            participantsCount: item.size || item.participants?.length || null,
            status: 'pending'
          };
        });

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
      if (!instanceName || !number || !text) {
        return { success: false, error: 'Parâmetros incompletos para envio.' };
      }

      let formattedNumber = String(number).trim();
      if (!formattedNumber.endsWith('@g.us') && !formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@g.us`;
      }

      const endpoint = `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(instanceName.trim())}`;
      const payload = {
        number: formattedNumber,
        text: text,
        delay: Number(delay) || 1200
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          apikey: EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      });

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

      return {
        success: false,
        status,
        error: `Falha no envio para ${number}: ${errorMsg}`
      };
    }
  });

  /**
   * Handler: Enviar Mídia (Imagem, Vídeo, Documento) com Legenda
   */
  ipcMain.handle('api:send-media', async (_event, { instanceName, number, media, mediatype, mimetype, fileName, caption, delay }) => {
    try {
      validateCredentials();
      if (!instanceName || !number || !media) {
        return { success: false, error: 'Parâmetros incompletos para envio de mídia.' };
      }

      let formattedNumber = String(number).trim();
      if (!formattedNumber.endsWith('@g.us') && !formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@g.us`;
      }

      const endpoint = `${EVOLUTION_API_URL}/message/sendMedia/${encodeURIComponent(instanceName.trim())}`;
      const payload = {
        number: formattedNumber,
        mediatype: mediatype || 'image',
        mimetype: mimetype || 'image/jpeg',
        caption: caption || '',
        media: media,
        fileName: fileName || 'arquivo',
        delay: Number(delay) || 1200
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          apikey: EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

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

      return {
        success: false,
        status,
        error: `Falha no envio de mídia para ${number}: ${errorMsg}`
      };
    }
  });
}
