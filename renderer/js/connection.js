/**
 * FlashGroup WPP - Módulo: Connection
 * Gerencia a Etapa 1: status da conexão, geração de QR Code, polling e exclusão de instância.
 */

window.FGW = window.FGW || {};

FGW.setConnectionView = function(isConnected, instanceName) {
  const elements = FGW.elements || {};
  const nameToDisplay = instanceName || (elements.instanceName ? elements.instanceName.value.trim() : '') || 'zap-disparador';

  if (isConnected) {
    FGW.state.connectionStatus = 'connected';
    FGW.state.activeInstanceName = nameToDisplay;
    if (elements.connectionFormState) elements.connectionFormState.classList.add('hidden');
    if (elements.connectionActiveState) elements.connectionActiveState.classList.remove('hidden');
    if (elements.stage1NormalFooter) elements.stage1NormalFooter.classList.add('hidden');
    if (elements.connectedInstanceTitle) {
      elements.connectedInstanceTitle.textContent = nameToDisplay;
    }
    FGW.setConnectionStatus('connected', 'Conectado');

    // Revela o Chat Real e oculta o estado desconectado
    if (elements.chatDisconnectedState) elements.chatDisconnectedState.classList.add('hidden');
    if (elements.chatConnectedState) elements.chatConnectedState.classList.remove('hidden');

    // Carrega o chat real do grupo selecionado
    if (FGW.loadRealChatMessages) {
      const selectedGid = elements.chatTargetGroupSelect ? elements.chatTargetGroupSelect.value : null;
      FGW.loadRealChatMessages(selectedGid);
    }
  } else {
    if (elements.connectionFormState) elements.connectionFormState.classList.remove('hidden');
    if (elements.connectionActiveState) elements.connectionActiveState.classList.add('hidden');
    if (elements.stage1NormalFooter) elements.stage1NormalFooter.classList.remove('hidden');
    FGW.setConnectionStatus('disconnected', 'Desconectado');

    // Bloqueia e oculta o Chat Real, mostrando aviso pré-conexão
    if (elements.chatDisconnectedState) elements.chatDisconnectedState.classList.remove('hidden');
    if (elements.chatConnectedState) elements.chatConnectedState.classList.add('hidden');
  }
};

/**
 * Disparado assim que a conexão com o WhatsApp for estabelecida.
 * Se já existirem grupos salvos em cache, usa-os imediatamente sem esperar a API.
 * Se for a primeira vez (sem cache) ou com forceRefresh = true (botão Recarregar), busca da API.
 */
FGW.onConnectionEstablished = async function(instanceName, forceRefresh = false) {
  const elements = FGW.elements || {};
  const activeName = (instanceName || (elements.instanceName ? elements.instanceName.value.trim() : '')).trim();

  if (elements.instanceName) {
    elements.instanceName.value = activeName;
  }
  FGW.saveSettings();

  // 1. Atualiza visual para Conectado e revela a coluna de Chat
  FGW.setConnectionView(true, activeName);

  // 2. Fecha o modal de configurações automaticamente se estiver aberto
  if (FGW.closeSettingsModal) {
    FGW.closeSettingsModal();
  }

  // 3. Valida se a instância em cache é a mesma conectada atualmente
  const lastCachedInst = localStorage.getItem('fgw_cached_instance_name');
  if (lastCachedInst && lastCachedInst !== activeName) {
    // A instância mudou (ex: de outra conta para a conta atual)! Limpa o cache antigo para carregar os grupos reais
    FGW.state.groups = [];
    FGW.state.selectedGroupIds = new Set();
    localStorage.removeItem(FGW.STORAGE_KEYS.CACHED_GROUPS);
    localStorage.removeItem(FGW.STORAGE_KEYS.SELECTED_GROUP_IDS);
  }
  localStorage.setItem('fgw_cached_instance_name', activeName);

  // Se já temos grupos salvos em cache para esta mesma instância e NÃO foi solicitado forceRefresh, exibe de imediato
  const hasCachedGroups = Array.isArray(FGW.state.groups) && FGW.state.groups.length > 0;
  if (hasCachedGroups && !forceRefresh) {
    FGW.log('INFO', `WhatsApp conectado na instância "${activeName}". Usando ${FGW.state.groups.length} grupos em cache...`, 'info');

    // Se existirem grupos selecionados salvos, preserva e inicia na aba de selecionados
    if (FGW.state.selectedGroupIds && FGW.state.selectedGroupIds.size > 0) {
      if (FGW.setGroupsFilter) FGW.setGroupsFilter('selected');
    } else {
      FGW.state.selectedGroupIds = new Set();
      if (FGW.setGroupsFilter) FGW.setGroupsFilter('all');
    }

    FGW.renderGroupsTable();
    FGW.updateSelectionCounter();
    FGW.updateCampaignSummary();
    if (FGW.updateVariationScopeSelectorOptions) FGW.updateVariationScopeSelectorOptions();
    if (FGW.updateChatTargetGroupOptions) FGW.updateChatTargetGroupOptions();

    // Se os grupos em cache ainda não tiverem as fotos de perfil, busca silenciosamente em segundo plano
    if (!FGW.state.groups.some(g => Boolean(g.pictureUrl)) && FGW.refreshGroupPicturesSilently) {
      setTimeout(() => {
        FGW.refreshGroupPicturesSilently(activeName);
      }, 600);
    }

    // Sincroniza em segundo plano com a API para remover grupos antigos e incluir novos grupos reais da conta
    setTimeout(async () => {
      try {
        const bgRes = await window.electronAPI.fetchGroups({ instanceName: activeName });
        if (bgRes && bgRes.success && Array.isArray(bgRes.data) && bgRes.data.length > 0) {
          const newGroups = bgRes.data.map(g => ({
            ...g,
            customId: FGW.state.groupCustomTags[g.id] || g.customId || ''
          }));
          FGW.state.groups = newGroups;
          FGW.saveCachedGroups();

          const validIds = new Set(newGroups.map(g => g.id));
          const cleanedSelected = new Set();
          FGW.state.selectedGroupIds.forEach(id => {
            if (validIds.has(id)) cleanedSelected.add(id);
          });
          FGW.state.selectedGroupIds = cleanedSelected;
          FGW.saveSelectedGroupIds();

          FGW.renderGroupsTable();
          FGW.updateSelectionCounter();
          if (FGW.updateChatTargetGroupOptions) FGW.updateChatTargetGroupOptions();
        }
      } catch (bgErr) {
        console.warn('[onConnectionEstablished] Sincronização em segundo plano de grupos:', bgErr.message);
      }
    }, 1500);

    if (FGW.state.groups.length > 0 && FGW.focusGroupInChat) {
      const currentSelected = elements.chatTargetGroupSelect ? elements.chatTargetGroupSelect.value : null;
      const targetId = (currentSelected && currentSelected !== '__preview_default__') ? currentSelected : FGW.state.groups[0].id;
      FGW.focusGroupInChat(targetId);
    }

    FGW.setConnectionStatus('connected', 'Conectado');
    FGW.log('SUCESSO', `${FGW.state.groups.length} grupos carregados. Sincronização em segundo plano ativa.`, 'success');
    return;
  }

  // 4. Primeira vez (cache vazio) ou clique manual no botão Recarregar (forceRefresh): busca na Evolution API
  try {
    FGW.setConnectionStatus('loading', 'Sincronizando grupos...');
    if (FGW.showGroupsLoadingState) {
      FGW.showGroupsLoadingState('Sincronizando grupos do WhatsApp...');
    }
    FGW.log('INFO', `Sincronizando grupos da Evolution API para "${activeName}"...`, 'info');

    const groupsResult = await window.electronAPI.fetchGroups({ instanceName: activeName });

    if (groupsResult && groupsResult.success && Array.isArray(groupsResult.data)) {
      FGW.state.groups = groupsResult.data.map(g => ({
        ...g,
        customId: FGW.state.groupCustomTags[g.id] || ''
      }));
      FGW.saveCachedGroups();

      // Se o usuário já tinha grupos selecionados, preserva e ativa aba de selecionados
      if (FGW.state.selectedGroupIds && FGW.state.selectedGroupIds.size > 0) {
        if (FGW.setGroupsFilter) FGW.setGroupsFilter('selected');
      } else {
        FGW.state.selectedGroupIds = new Set();
        FGW.saveSelectedGroupIds();
        if (FGW.setGroupsFilter) FGW.setGroupsFilter('all');
      }

      FGW.renderGroupsTable();
      FGW.updateSelectionCounter();
      FGW.updateCampaignSummary();
      if (FGW.updateVariationScopeSelectorOptions) FGW.updateVariationScopeSelectorOptions();
      if (FGW.updateChatTargetGroupOptions) FGW.updateChatTargetGroupOptions();

      // Foca automaticamente no primeiro grupo para abrir o Chat Real com as mensagens em tempo real
      if (FGW.state.groups.length > 0 && FGW.focusGroupInChat) {
        FGW.focusGroupInChat(FGW.state.groups[0].id);
      }

      FGW.setConnectionStatus('connected', 'Conectado');
      FGW.log('SUCESSO', `Todos os ${FGW.state.groups.length} grupos foram sincronizados e salvos com sucesso!`, 'success');
    } else {
      const errMsg = groupsResult?.error || 'Nenhum grupo retornado pela API.';
      FGW.setConnectionStatus('connected', 'Conectado');
      if (hasCachedGroups) {
        FGW.renderGroupsTable();
        FGW.log('AVISO', `Usando grupos em cache salvos anteriormente (${errMsg}).`, 'warn');
      } else {
        if (FGW.showGroupsErrorState) {
          FGW.showGroupsErrorState(errMsg);
        }
        FGW.log('AVISO', `Aviso ao sincronizar grupos: ${errMsg}`, 'warn');
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar grupos pós-conexão:', err);
    FGW.setConnectionStatus('connected', 'Conectado');
    if (hasCachedGroups) {
      FGW.renderGroupsTable();
      FGW.log('AVISO', `Usando grupos em cache salvos anteriormente (${err.message}).`, 'warn');
    } else {
      if (FGW.showGroupsErrorState) {
        FGW.showGroupsErrorState(err.message);
      }
      FGW.log('ERRO', `Erro ao sincronizar grupos: ${err.message}`, 'error');
    }
  }
};

FGW.checkActiveConnectionOnStartup = async function() {
  const elements = FGW.elements || {};

  // 1. Carrega o nome da instância salvo especificamente para este aplicativo no IndexedDB
  let instanceName = '';
  if (FGW.loadInstanceNameFromIndexedDB) {
    instanceName = await FGW.loadInstanceNameFromIndexedDB();
  }
  if (!instanceName && elements.instanceName) {
    instanceName = elements.instanceName.value.trim();
  }
  if (elements.instanceName && instanceName) {
    elements.instanceName.value = instanceName;
  }

  if (!instanceName) {
    FGW.setConnectionView(false);
    FGW.log('INFO', 'Nenhuma instância configurada. Informe o nome da sua instância nas configurações.', 'info');
    return;
  }

  FGW.setConnectionStatus('loading', 'Verificando conexão...');
  FGW.log('INFO', `Consultando conexão da instância "${instanceName}" na Evolution API...`, 'info');

  try {
    // Consulta ESTRITAMENTE o status desta instância específica
    const res = await window.electronAPI.checkConnectionState({ instanceName });
    if (res.success && res.state === 'open') {
      FGW.log('SUCESSO', `Conexão positiva! Instância "${instanceName}" está conectada ao WhatsApp.`, 'success');
      await FGW.onConnectionEstablished(instanceName);
    } else {
      FGW.setConnectionView(false, instanceName);
      FGW.log('INFO', `Conexão negativa: Instância "${instanceName}" está desconectada.`, 'info');
    }
  } catch (err) {
    console.warn('Erro na verificação de inicialização:', err);
    FGW.setConnectionView(false, instanceName);
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

  // Persiste no IndexedDB imediatamente
  if (FGW.saveInstanceNameToIndexedDB) {
    await FGW.saveInstanceNameToIndexedDB(instanceName);
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
      if (elements.qrLoadingText) elements.qrLoadingText.textContent = '✓ Conectado! Carregando todos os grupos...';
      await FGW.onConnectionEstablished(instanceName);
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
        if (elements.qrStatusLabel) elements.qrStatusLabel.textContent = '✓ WhatsApp conectado com sucesso!';
        if (elements.qrCodeWrapper) elements.qrCodeWrapper.classList.add('hidden');
        if (elements.qrSpinner) elements.qrSpinner.classList.remove('hidden');
        if (elements.qrLoadingText) elements.qrLoadingText.textContent = '✓ Conectado com sucesso! Carregando todos os grupos...';

        await FGW.onConnectionEstablished(instanceName);
      }
    } catch (e) {
      console.warn('Polling checkConnectionState:', e);
    }
  }, 2200);
};

FGW.stopConnectionStatePolling = function() {
  if (FGW.state.qrPollingInterval) {
    clearInterval(FGW.state.qrPollingInterval);
    FGW.state.qrPollingInterval = null;
  }
};

FGW.setConnectionStatus = function(status, text) {
  FGW.state.connectionStatus = status;
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
