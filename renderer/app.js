/**
 * FlashGroup WPP - Ponto de Entrada Principal (Main Orchestrator)
 * Integra os submódulos modulares em renderer/js/:
 * - state.js: Estado e elementos do DOM
 * - storage.js: Persistência local (localStorage)
 * - logger.js: Terminal e logs
 * - navigation.js: Wizard de 4 etapas e resumo
 * - connection.js: Etapa 1 - Conexão e Sessão
 * - groups.js: Etapa 2 - Gerenciamento de Grupos
 * - variables.js: Modal de Variáveis Dinâmicas & Tags
 * - variations.js: Etapa 3 - Variações & Escopos
 * - dispatch.js: Etapa 4 - Disparos Cadenciados
 */

window.FGW = window.FGW || {};

FGW.setupEventListeners = function() {
  const elements = FGW.elements || {};

  // Inputs de Delays e Instância
  [elements.instanceName, elements.minDelay, elements.maxDelay, elements.presenceDelay]
    .filter(Boolean)
    .forEach(el => el.addEventListener('input', () => {
      FGW.saveSettings();
      if (FGW.updateDelayBadges) FGW.updateDelayBadges();
      if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
    }));

  // Cliques nas Abas do Stepper
  if (elements.stepTabs) {
    elements.stepTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const step = parseInt(tab.dataset.step, 10);
        FGW.goToStep(step);
      });
    });
  }

  // Botões de Navegação entre Etapas
  if (elements.btnGoToStep2) elements.btnGoToStep2.addEventListener('click', () => FGW.goToStep(2));
  if (elements.btnBackToStep1) elements.btnBackToStep1.addEventListener('click', () => FGW.goToStep(1));
  if (elements.btnGoToStep3) elements.btnGoToStep3.addEventListener('click', () => FGW.goToStep(3));
  if (elements.btnBackToStep2) elements.btnBackToStep2.addEventListener('click', () => FGW.goToStep(2));
  if (elements.btnGoToStep4) elements.btnGoToStep4.addEventListener('click', () => FGW.goToStep(4));
  if (elements.btnBackToStep3) elements.btnBackToStep3.addEventListener('click', () => FGW.goToStep(3));

  // Ações da Etapa 1 (Conexão)
  if (elements.btnOpenQrModal) elements.btnOpenQrModal.addEventListener('click', FGW.handleRequestQrCodeInline);
  if (elements.btnConnect) elements.btnConnect.addEventListener('click', FGW.handleConnectAndFetchGroups);
  if (elements.btnDeleteInstance) elements.btnDeleteInstance.addEventListener('click', FGW.handleDeleteInstance);
  if (elements.btnRefreshQr) elements.btnRefreshQr.addEventListener('click', FGW.handleRequestQrCodeInline);

  // Ações da Etapa 2 (Grupos)
  if (elements.btnSelectAll) elements.btnSelectAll.addEventListener('click', FGW.selectAllGroups);
  if (elements.btnClearSelection) elements.btnClearSelection.addEventListener('click', FGW.clearGroupSelection);
  if (elements.btnSelectRandom20) elements.btnSelectRandom20.addEventListener('click', FGW.selectRandom20Groups);
  if (elements.btnReloadGroupsStep2) elements.btnReloadGroupsStep2.addEventListener('click', FGW.handleConnectAndFetchGroups);
  if (elements.masterCheckbox) elements.masterCheckbox.addEventListener('change', FGW.handleMasterCheckboxToggle);
  if (elements.searchGroupInput) elements.searchGroupInput.addEventListener('input', FGW.handleSearchFilter);

  // Ações da Etapa 3 (Variações & Escopo)
  if (elements.variationScopeSelector) {
    elements.variationScopeSelector.addEventListener('change', (e) => FGW.handleScopeChange(e.target.value));
  }
  if (elements.chkEnableGroupCustomVars) {
    elements.chkEnableGroupCustomVars.addEventListener('change', FGW.handleToggleGroupCustomVars);
  }
  if (elements.btnCopyGlobalToGroup) {
    elements.btnCopyGlobalToGroup.addEventListener('click', FGW.handleCopyGlobalToGroup);
  }
  if (elements.btnAddVariation) elements.btnAddVariation.addEventListener('click', FGW.handleAddVariation);
  if (elements.btnInsertGroupIdTag) elements.btnInsertGroupIdTag.addEventListener('click', FGW.handleInsertGroupIdTag);

  // Ações da Etapa 4 (Disparo)
  if (elements.btnStartDispatch) elements.btnStartDispatch.addEventListener('click', FGW.handleStartDispatch);
  if (elements.btnCancelDispatch) elements.btnCancelDispatch.addEventListener('click', FGW.handleCancelDispatch);
  if (elements.btnClearLogs) {
    elements.btnClearLogs.addEventListener('click', () => {
      if (elements.terminalLogs) elements.terminalLogs.innerHTML = '';
      FGW.log('SISTEMA', 'Logs limpos.', 'sys');
    });
  }

  // Modal: Gerenciador de Variáveis Dinâmicas
  if (elements.btnManageVarsStep2) elements.btnManageVarsStep2.addEventListener('click', FGW.openVariablesModal);
  if (elements.btnOpenVariablesManager) elements.btnOpenVariablesManager.addEventListener('click', FGW.openVariablesModal);
  if (elements.btnCloseVariablesModal) elements.btnCloseVariablesModal.addEventListener('click', FGW.closeVariablesModal);
  if (elements.btnCloseVariablesModalBtn) elements.btnCloseVariablesModalBtn.addEventListener('click', FGW.closeVariablesModal);

  if (elements.variablesModal) {
    elements.variablesModal.addEventListener('click', (e) => {
      if (e.target === elements.variablesModal) {
        FGW.closeVariablesModal();
      }
    });
  }

  if (elements.btnSaveNewVariable) elements.btnSaveNewVariable.addEventListener('click', FGW.handleSaveNewVariable);

  if (elements.newVarName) {
    elements.newVarName.addEventListener('input', FGW.updateNewVarTagPreview);
    elements.newVarName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') FGW.handleSaveNewVariable();
    });
  }

  if (elements.newVarType) {
    elements.newVarType.addEventListener('change', FGW.handleNewVarTypeChange);
  }

  if (elements.newVarDefaultValue) {
    elements.newVarDefaultValue.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') FGW.handleSaveNewVariable();
    });
  }

  // Modal: Configuração de Delays
  if (elements.btnOpenDelaysModal) elements.btnOpenDelaysModal.addEventListener('click', FGW.openDelaysModal);
  if (elements.btnOpenDelaysModalSide) elements.btnOpenDelaysModalSide.addEventListener('click', FGW.openDelaysModal);
  if (elements.btnCloseDelaysModal) elements.btnCloseDelaysModal.addEventListener('click', FGW.closeDelaysModal);
  if (elements.btnSaveDelaysModal) elements.btnSaveDelaysModal.addEventListener('click', FGW.closeDelaysModal);
  if (elements.btnResetDefaultDelays) elements.btnResetDefaultDelays.addEventListener('click', FGW.resetDefaultDelays);

  if (elements.delaysModal) {
    elements.delaysModal.addEventListener('click', (e) => {
      if (e.target === elements.delaysModal) {
        FGW.closeDelaysModal();
      }
    });
  }

  // Tecla Escape para fechar modais abertos
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.delaysModal && !elements.delaysModal.classList.contains('hidden')) {
        FGW.closeDelaysModal();
      } else if (elements.variablesModal && !elements.variablesModal.classList.contains('hidden')) {
        FGW.closeVariablesModal();
      }
    }
  });

  // Estado Conectado Inteligente
  if (elements.btnActiveDisconnect) elements.btnActiveDisconnect.addEventListener('click', FGW.handleDeleteInstance);
  if (elements.btnActiveGoToGroups) elements.btnActiveGoToGroups.addEventListener('click', () => {
    if (FGW.state.groups.length === 0) {
      FGW.handleConnectAndFetchGroups();
    }
    FGW.goToStep(2);
  });
};

// ==========================================================================
// Inicialização do Aplicativo
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  FGW.initElements();
  FGW.loadSavedSettings();
  FGW.setupEventListeners();

  FGW.renderVariations();
  FGW.renderDynamicTagChips();
  FGW.renderGroupsTable();
  FGW.updateSelectionCounter();
  FGW.updateVariationsBadge();
  FGW.updateCampaignSummary();
  if (FGW.updateDelayBadges) FGW.updateDelayBadges();
  FGW.updateVariationScopeSelectorOptions();

  FGW.log('SISTEMA', 'FlashGroup WPP pronto. Navegue livremente pelas etapas no topo.', 'sys');
  FGW.checkActiveConnectionOnStartup();
});

