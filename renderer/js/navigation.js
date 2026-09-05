/**
 * FlashGroup WPP - Módulo: Workspace Navigation, Modals & Terminal Drawer
 * Gerencia a abertura/fechamento do Modal de Configuração, abas internas,
 * gaveta retrátil de logs e atualização do resumo da campanha.
 */

window.FGW = window.FGW || {};

/**
 * Abre o Modal de Configuração unificado (WhatsApp + Delays)
 * @param {string} [tabId='tabWhatsApp'] - Aba inicial a ser exibida
 */
FGW.openSettingsModal = function(tabId) {
  const elements = FGW.elements || {};
  if (elements.settingsModal) {
    elements.settingsModal.classList.remove('hidden');
    if (tabId) {
      FGW.switchSettingsTab(tabId);
    }
  }
};

/**
 * Fecha o Modal de Configuração e persiste quaisquer alterações
 */
FGW.closeSettingsModal = function() {
  const elements = FGW.elements || {};
  if (elements.settingsModal) {
    elements.settingsModal.classList.add('hidden');
    if (FGW.stopConnectionStatePolling) FGW.stopConnectionStatePolling();
    if (FGW.saveSettings) FGW.saveSettings();
    if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
  }
};

/**
 * Alterna entre as abas internas do modal de configuração
 * @param {string} targetTabId - 'tabWhatsApp' ou 'tabDelays'
 */
FGW.switchSettingsTab = function(targetTabId) {
  const modal = FGW.elements?.settingsModal || document.getElementById('settingsModal');
  if (!modal) return;

  // Atualiza botões das abas
  modal.querySelectorAll('.settings-tab-btn').forEach(btn => {
    if (btn.dataset.tab === targetTabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Atualiza painéis de conteúdo
  modal.querySelectorAll('.settings-tab-pane').forEach(pane => {
    if (pane.id === targetTabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
};

/**
 * Alterna a visualização da gaveta retrátil de logs
 */
FGW.toggleTerminalDrawer = function() {
  const elements = FGW.elements || {};
  if (!elements.terminalDrawer) return;

  const isHidden = elements.terminalDrawer.classList.contains('hidden');
  if (isHidden) {
    elements.terminalDrawer.classList.remove('hidden');
    if (elements.terminalToggleText) elements.terminalToggleText.textContent = 'Ocultar Terminal';
    // Rola os logs para o final
    if (elements.terminalLogs) {
      elements.terminalLogs.scrollTop = elements.terminalLogs.scrollHeight;
    }
  } else {
    elements.terminalDrawer.classList.add('hidden');
    if (elements.terminalToggleText) elements.terminalToggleText.textContent = 'Terminal de Logs';
  }
};

/**
 * Fecha a gaveta retrátil de logs
 */
FGW.closeTerminalDrawer = function() {
  const elements = FGW.elements || {};
  if (elements.terminalDrawer) {
    elements.terminalDrawer.classList.add('hidden');
    if (elements.terminalToggleText) elements.terminalToggleText.textContent = 'Terminal de Logs';
  }
};

/**
 * Restaura os padrões de delays
 */
FGW.resetDefaultDelays = function() {
  const elements = FGW.elements || {};
  if (elements.minDelay) elements.minDelay.value = 20;
  if (elements.maxDelay) elements.maxDelay.value = 50;
  if (elements.presenceDelay) elements.presenceDelay.value = 1200;
  if (FGW.saveSettings) FGW.saveSettings();
  if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
  if (FGW.log) FGW.log('SISTEMA', 'Delays restaurados para o padrão (20s - 50s, 1200ms).', 'info');
};

/**
 * Atualiza o resumo da campanha e contadores em tempo real na barra inferior
 */
FGW.updateCampaignSummary = function() {
  const state = FGW.state;
  const elements = FGW.elements || {};
  const selectedCount = state.selectedGroupIds ? state.selectedGroupIds.size : 0;
  const isPolls = (state.campaignType === 'polls');
  const validVariations = isPolls
    ? (FGW.getValidPollVariations ? FGW.getValidPollVariations().length : 0)
    : (FGW.getValidVariations ? FGW.getValidVariations().length : 0);
  const minDelay = elements.minDelay ? elements.minDelay.value : 20;
  const maxDelay = elements.maxDelay ? elements.maxDelay.value : 50;

  if (elements.summaryCampaignTypeVal) {
    elements.summaryCampaignTypeVal.textContent = isPolls ? '📊 Enquetes' : '💬 Mensagens';
  }
  if (elements.summaryGroupsCount) elements.summaryGroupsCount.textContent = selectedCount;
  if (elements.summaryVariationsCount) elements.summaryVariationsCount.textContent = validVariations;
  if (elements.summaryIntervalVal) elements.summaryIntervalVal.textContent = `${minDelay}s - ${maxDelay}s`;
  if (elements.summaryConnectionVal) {
    elements.summaryConnectionVal.textContent = (elements.connectionStatusText && elements.connectionStatusText.textContent) || 'Desconectado';
  }
};

/**
 * Função de retrocompatibilidade (para componentes legados)
 */
FGW.goToStep = function(stepNumber) {
  if (stepNumber === 1) {
    FGW.openSettingsModal('tabWhatsApp');
  }
};

window.openSettingsModal = FGW.openSettingsModal;
window.closeSettingsModal = FGW.closeSettingsModal;
window.switchSettingsTab = FGW.switchSettingsTab;
window.toggleTerminalDrawer = FGW.toggleTerminalDrawer;
window.closeTerminalDrawer = FGW.closeTerminalDrawer;
window.resetDefaultDelays = FGW.resetDefaultDelays;
window.updateCampaignSummary = FGW.updateCampaignSummary;
window.goToStep = FGW.goToStep;
