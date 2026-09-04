/**
 * FlashGroup WPP - Módulo: Connection
 * Gerencia a Etapa 1: status da conexão, geração de QR Code, polling e exclusão de instância.
 */

window.FGW = window.FGW || {};

FGW.setConnectionView = function(isConnected, instanceName) {
  const elements = FGW.elements || {};
  const nameToDisplay = instanceName || (elements.instanceName ? elements.instanceName.value.trim() : '') || 'zap-disparador';

  if (isConnected) {
    if (elements.connectionFormState) elements.connectionFormState.classList.add('hidden');
    if (elements.connectionActiveState) elements.connectionActiveState.classList.remove('hidden');
    if (elements.stage1NormalFooter) elements.stage1NormalFooter.classList.add('hidden');
    if (elements.connectedInstanceTitle) {
      elements.connectedInstanceTitle.textContent = nameToDisplay;
    }
    FGW.setConnectionStatus('connected', 'Conectado');
  } else {
    if (elements.connectionFormState) elements.connectionFormState.classList.remove('hidden');
    if (elements.connectionActiveState) elements.connectionActiveState.classList.add('hidden');
    if (elements.stage1NormalFooter) elements.stage1NormalFooter.classList.remove('hidden');
    FGW.setConnectionStatus('disconnected', 'Desconectado');
  }
};

FGW.checkActiveConnectionOnStartup = async function() {
  const elements = FGW.elements || {};
  const instanceName = elements.instanceName ? elements.instanceName.value.trim() : '';
  if (!instanceName) {
    FGW.setConnectionView(false);
    return;
  }

  FGW.setConnectionStatus('loading', 'Verificando...');
  FGW.log('INFO', `Verificando status de conexão da instância "${instanceName}"...`, 'info');

  try {
    const res = await window.electronAPI.checkConnectionState({ instanceName });
    if (res.success && res.state === 'open') {
      FGW.setConnectionView(true, instanceName);
      FGW.log('SUCESSO', `WhatsApp já está conectado e ativo na instância "${instanceName}"!`, 'success');

      // Busca os grupos silenciosamente em segundo plano
      const groupsResult = await window.electronAPI.fetchGroups({ instanceName });
      if (groupsResult.success && Array.isArray(groupsResult.data)) {
        FGW.state.groups = groupsResult.data.map(g => ({
          ...g,
          customId: FGW.state.groupCustomTags[g.id] || ''
        }));
        FGW.saveCachedGroups();
        if (FGW.renderGroupsTable) FGW.renderGroupsTable();
        if (FGW.updateSelectionCounter) FGW.updateSelectionCounter();
        if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
        FGW.log('SUCESSO', `${FGW.state.groups.length} grupos sincronizados com sucesso da instância ativa.`, 'success');
      }
    } else {
      FGW.setConnectionView(false);
      FGW.log('INFO', `Instância "${instanceName}" não está conectada no momento.`, 'info');
    }
  } catch (err) {
    console.warn('Erro na verificação de inicialização:', err);
    FGW.setConnectionView(false);
  }
};

FGW.handleRequestQrCodeInline = async function() {
  FGW.saveSettings();
  const elements = FGW.elements || {};
  const instanceName = elements.instanceName ? elements.instanceName.value.trim() : '';

  if (!instanceName) {
    alert('Por favor, informe o Nome da Instância para conectar o WhatsApp.');
    if (elements.instanceName) elements.instanceName.focus();
    return;
  }

  FGW.showQrLoadingState('Conectando e gerando QR Code...');
  FGW.log('INFO', `Iniciando pareamento para a instância "${instanceName}"...`, 'info');

  try {
    const result = await window.electronAPI.connectOrCreateInstance({ instanceName });

    if (!result.success) {
      if (elements.qrLoadingText) elements.qrLoadingText.textContent = `Erro: ${result.error}`;
      FGW.log('ERRO', result.error, 'error');
      alert(`Falha ao gerar QR Code:\n${result.error}`);
      return;
    }

    // Se já estiver conectado
    if (result.alreadyConnected || result.state === 'open') {
      if (elements.qrLoadingText) elements.qrLoadingText.textContent = '✓ Esta instância já está conectada!';
      FGW.setConnectionView(true, instanceName);
      FGW.log('SUCESSO', `Instância "${instanceName}" já está conectada ao WhatsApp!`, 'success');
      setTimeout(async () => {
        if (FGW.handleConnectAndFetchGroups) await FGW.handleConnectAndFetchGroups();
        FGW.goToStep(2);
      }, 1200);
      return;
    }

    // Exibe o QR Code
    if (result.base64) {
      let imgSrc = result.base64;
      if (!imgSrc.startsWith('data:image')) {
        imgSrc = `data:image/png;base64,${imgSrc}`;
      }

      if (elements.qrCodeImg) elements.qrCodeImg.src = imgSrc;
      if (elements.qrSpinner) elements.qrSpinner.classList.add('hidden');
      if (elements.qrCodeWrapper) elements.qrCodeWrapper.classList.remove('hidden');
      if (elements.qrExpiredOverlay) elements.qrExpiredOverlay.classList.add('hidden');

      if (result.pairingCode) {
        if (elements.pairingCodeArea) elements.pairingCodeArea.classList.remove('hidden');
        if (elements.pairingCodeValue) elements.pairingCodeValue.textContent = result.pairingCode;
      } else {
        if (elements.pairingCodeArea) elements.pairingCodeArea.classList.add('hidden');
      }

      if (elements.qrStatusLabel) elements.qrStatusLabel.textContent = 'Aguardando leitura pelo WhatsApp no celular...';
      FGW.log('INFO', 'QR Code exibido com sucesso. Aponte a câmera do WhatsApp para conectar.', 'info');

      FGW.startConnectionStatePolling(instanceName);
    } else {
      if (elements.qrLoadingText) elements.qrLoadingText.textContent = 'Aguardando status da conexão...';
      FGW.startConnectionStatePolling(instanceName);
    }
  } catch (err) {
    if (elements.qrLoadingText) elements.qrLoadingText.textContent = `Erro: ${err.message}`;
    FGW.log('ERRO', `Exceção ao solicitar QR Code: ${err.message}`, 'error');
  }
};

FGW.showQrLoadingState = function(text) {
  const elements = FGW.elements || {};
  if (elements.qrSpinner) elements.qrSpinner.classList.remove('hidden');
  if (elements.qrLoadingText) elements.qrLoadingText.textContent = text;
  if (elements.qrCodeWrapper) elements.qrCodeWrapper.classList.add('hidden');
  if (elements.qrExpiredOverlay) elements.qrExpiredOverlay.classList.add('hidden');
  if (elements.pairingCodeArea) elements.pairingCodeArea.classList.add('hidden');
  if (elements.qrStatusLabel) elements.qrStatusLabel.textContent = 'Gerando QR Code...';
};

FGW.startConnectionStatePolling = function(instanceName) {
  FGW.stopConnectionStatePolling();
  const elements = FGW.elements || {};

  FGW.state.qrPollingInterval = setInterval(async () => {
    try {
      const stateResult = await window.electronAPI.checkConnectionState({ instanceName });

      if (stateResult.success && stateResult.state === 'open') {
        FGW.stopConnectionStatePolling();
        FGW.setConnectionView(true, instanceName);
        if (elements.qrStatusLabel) elements.qrStatusLabel.textContent = '✓ WhatsApp conectado com sucesso!';
        FGW.log('SUCESSO', `WhatsApp conectado na instância "${instanceName}"!`, 'success');

        if (elements.qrCodeWrapper) elements.qrCodeWrapper.classList.add('hidden');
        if (elements.qrSpinner) elements.qrSpinner.classList.remove('hidden');
        if (elements.qrLoadingText) elements.qrLoadingText.textContent = '✓ Conectado com sucesso! Avançando para Grupos...';

        setTimeout(async () => {
          if (FGW.handleConnectAndFetchGroups) await FGW.handleConnectAndFetchGroups();
          FGW.goToStep(2); // Avanço automático para a Etapa 2
        }, 1300);
      }
    } catch (e) {
      console.warn('Polling checkConnectionState:', e);
    }
  }, 2500);
};

FGW.stopConnectionStatePolling = function() {
  if (FGW.state.qrPollingInterval) {
    clearInterval(FGW.state.qrPollingInterval);
    FGW.state.qrPollingInterval = null;
  }
};

FGW.setConnectionStatus = function(status, text) {
  const elements = FGW.elements || {};
  if (elements.connectionStatusBadge) elements.connectionStatusBadge.className = `status-badge ${status}`;
  if (elements.connectionStatusText) elements.connectionStatusText.textContent = text;
  if (elements.summaryConnectionVal) {
    elements.summaryConnectionVal.textContent = text;
    elements.summaryConnectionVal.style.color = status === 'connected' ? 'var(--whatsapp-green)' : (status === 'loading' ? 'var(--status-warning)' : 'var(--status-danger)');
  }
};

FGW.handleDeleteInstance = async function() {
  FGW.saveSettings();
  const elements = FGW.elements || {};
  const instanceName = elements.instanceName ? elements.instanceName.value.trim() : '';

  if (!instanceName) {
    alert('Por favor, informe o Nome da Instância que deseja deslogar e apagar.');
    if (elements.instanceName) elements.instanceName.focus();
    return;
  }

  const confirmDelete = confirm(
    `Tem certeza que deseja deslogar e APAGAR a instância "${instanceName}"?\n\nEsta ação desconectará o WhatsApp e removerá a instância por completo da Evolution API.`
  );
  if (!confirmDelete) return;

  if (elements.btnDeleteInstance) {
    elements.btnDeleteInstance.disabled = true;
    elements.btnDeleteInstance.querySelector('span').textContent = 'Apagando...';
  }
  if (elements.btnActiveDisconnect) {
    elements.btnActiveDisconnect.disabled = true;
    elements.btnActiveDisconnect.querySelector('span').textContent = 'Apagando...';
  }

  FGW.log('AVISO', `Solicitando desconexão e exclusão da instância "${instanceName}"...`, 'warn');

  try {
    const result = await window.electronAPI.deleteInstance({ instanceName });

    if (result.success) {
      FGW.setConnectionView(false);
      FGW.log('SUCESSO', `Instância "${instanceName}" foi deslogada e apagada com sucesso!`, 'success');

      FGW.state.groups = [];
      FGW.state.selectedGroupIds.clear();
      localStorage.removeItem(FGW.STORAGE_KEYS.CACHED_GROUPS);
      localStorage.removeItem(FGW.STORAGE_KEYS.SELECTED_GROUP_IDS);
      if (FGW.renderGroupsTable) FGW.renderGroupsTable();
      if (FGW.updateSelectionCounter) FGW.updateSelectionCounter();
      if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();

      if (elements.qrCodeWrapper) elements.qrCodeWrapper.classList.add('hidden');
      if (elements.qrSpinner) elements.qrSpinner.classList.remove('hidden');
      if (elements.qrLoadingText) elements.qrLoadingText.textContent = 'Instância apagada. Gere um novo QR Code para reconectar.';
      if (elements.qrStatusLabel) elements.qrStatusLabel.textContent = 'Desconectado.';

      alert(`Instância "${instanceName}" foi desconectada e apagada com sucesso!`);
    } else {
      FGW.log('ERRO', `Falha ao apagar instância: ${result.error}`, 'error');
      alert(`Erro ao apagar instância:\n${result.error}`);
    }
  } catch (err) {
    FGW.log('ERRO', `Exceção ao apagar instância: ${err.message}`, 'error');
    alert(`Erro inesperado:\n${err.message}`);
  } finally {
    if (elements.btnDeleteInstance) {
      elements.btnDeleteInstance.disabled = false;
      elements.btnDeleteInstance.querySelector('span').textContent = 'Deslogar / Apagar Instância';
    }
    if (elements.btnActiveDisconnect) {
      elements.btnActiveDisconnect.disabled = false;
      elements.btnActiveDisconnect.querySelector('span').textContent = 'Desconectar / Apagar Instância';
    }
  }
};

window.handleRequestQrCodeInline = FGW.handleRequestQrCodeInline;
window.handleDeleteInstance = FGW.handleDeleteInstance;
window.checkActiveConnectionOnStartup = FGW.checkActiveConnectionOnStartup;
