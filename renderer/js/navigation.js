/**
 * FlashGroup WPP - Módulo: Navigation & Wizard (Stepper)
 * Controla a navegação entre as 4 etapas e a atualização do resumo da campanha.
 */

window.FGW = window.FGW || {};

FGW.goToStep = function(stepNumber) {
  const state = FGW.state;
  state.currentStep = stepNumber;

  // Atualiza exibição dos painéis
  document.querySelectorAll('.step-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const targetPanel = document.getElementById(`panelStep${stepNumber}`);
  if (targetPanel) targetPanel.classList.add('active');

  // Atualiza as abas de navegação do topo
  document.querySelectorAll('.step-tab').forEach(tab => {
    const stepVal = parseInt(tab.dataset.step, 10);
    tab.classList.remove('active');
    if (stepVal === stepNumber) {
      tab.classList.add('active');
    }
    if (stepVal < stepNumber) {
      tab.classList.add('completed');
    } else {
      tab.classList.remove('completed');
    }
  });

  // Ações contextuais de cada etapa
  if (stepNumber === 2) {
    // Se a tabela estiver vazia, carrega grupos automaticamente
    if (state.groups.length === 0 && FGW.handleConnectAndFetchGroups) {
      FGW.handleConnectAndFetchGroups();
    }
  } else if (stepNumber === 3) {
    if (FGW.updateVariationScopeSelectorOptions) {
      FGW.updateVariationScopeSelectorOptions();
    }
    if (FGW.updateWhatsAppMobilePreview) {
      FGW.updateWhatsAppMobilePreview();
    }
  } else if (stepNumber === 4) {
    FGW.updateCampaignSummary();
  }

  // Rola para o topo suavemente
  const wizardContainer = document.querySelector('.wizard-container');
  if (wizardContainer) wizardContainer.scrollTo({ top: 0, behavior: 'smooth' });
};

FGW.updateCampaignSummary = function() {
  const state = FGW.state;
  const elements = FGW.elements || {};
  const selectedCount = state.selectedGroupIds.size;
  const validVariations = FGW.getValidVariations ? FGW.getValidVariations().length : 0;
  const minDelay = elements.minDelay ? elements.minDelay.value : 20;
  const maxDelay = elements.maxDelay ? elements.maxDelay.value : 50;

  if (elements.summaryGroupsCount) elements.summaryGroupsCount.textContent = selectedCount;
  if (elements.summaryVariationsCount) elements.summaryVariationsCount.textContent = validVariations;
  if (elements.summaryIntervalVal) elements.summaryIntervalVal.textContent = `${minDelay}s - ${maxDelay}s`;
  if (elements.summaryConnectionVal) {
    elements.summaryConnectionVal.textContent = (elements.connectionStatusText && elements.connectionStatusText.textContent) || 'Desconectado';
  }

  FGW.updateDelayBadges();
};

FGW.updateDelayBadges = function() {
  const elements = FGW.elements || {};
  const min = elements.minDelay ? elements.minDelay.value : 20;
  const max = elements.maxDelay ? elements.maxDelay.value : 50;
  const text = `${min}s - ${max}s`;
  if (elements.delayBadgeVal) elements.delayBadgeVal.textContent = text;
  if (elements.sideDelayPill) elements.sideDelayPill.textContent = text;
};

FGW.openDelaysModal = function() {
  const elements = FGW.elements || {};
  if (elements.delaysModal) {
    elements.delaysModal.classList.remove('hidden');
    FGW.updateDelayBadges();
  }
};

FGW.closeDelaysModal = function() {
  const elements = FGW.elements || {};
  if (elements.delaysModal) {
    elements.delaysModal.classList.add('hidden');
    if (FGW.saveSettings) FGW.saveSettings();
    FGW.updateDelayBadges();
    if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
  }
};

FGW.resetDefaultDelays = function() {
  const elements = FGW.elements || {};
  if (elements.minDelay) elements.minDelay.value = 20;
  if (elements.maxDelay) elements.maxDelay.value = 50;
  if (elements.presenceDelay) elements.presenceDelay.value = 1200;
  if (FGW.saveSettings) FGW.saveSettings();
  FGW.updateDelayBadges();
  if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
  if (FGW.log) FGW.log('SISTEMA', 'Delays restaurados para o padrão (20s - 50s, 1200ms).', 'info');
};

window.goToStep = FGW.goToStep;
window.updateCampaignSummary = FGW.updateCampaignSummary;
window.openDelaysModal = FGW.openDelaysModal;
window.closeDelaysModal = FGW.closeDelaysModal;
window.resetDefaultDelays = FGW.resetDefaultDelays;
window.updateDelayBadges = FGW.updateDelayBadges;

