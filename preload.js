const { contextBridge, ipcRenderer } = require('electron');

/**
 * Ponte de contexto segura (Context Isolation).
 * As credenciais da Evolution API ficam protegidas no processo principal (.env).
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Conecta ou cria instância e retorna QR Code
   * @param {Object} params { instanceName }
   */
  connectOrCreateInstance: (params) => ipcRenderer.invoke('api:connect-or-create', params),

  /**
   * Checa o estado da conexão da instância (open, close, connecting)
   * @param {Object} params { instanceName }
   */
  checkConnectionState: (params) => ipcRenderer.invoke('api:check-state', params),

  /**
   * Desloga e apaga a instância na Evolution API v2
   * @param {Object} params { instanceName }
   */
  deleteInstance: (params) => ipcRenderer.invoke('api:delete-instance', params),

  /**
   * Busca todos os grupos da instância na Evolution API v2
   * @param {Object} params { instanceName }
   */
  fetchGroups: (params) => ipcRenderer.invoke('api:fetch-groups', params),

  /**
   * Envia uma mensagem de texto para um grupo do WhatsApp
   * @param {Object} params { instanceName, number, text, delay }
   */
  sendMessage: (params) => ipcRenderer.invoke('api:send-message', params),

  /**
   * Envia uma mídia (imagem, vídeo, documento) para um grupo do WhatsApp
   * @param {Object} params { instanceName, number, media, mediatype, mimetype, fileName, caption, delay }
   */
  sendMediaMessage: (params) => ipcRenderer.invoke('api:send-media', params)
});
