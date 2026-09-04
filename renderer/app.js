/**
 * FlashGroup WPP - Ponto de Entrada Principal (Main Orchestrator)
 * Integra os submódulos modulares em renderer/js/:
 * - state.js: Estado e elementos do DOM
 * - storage.js: Persistência local (localStorage)
 * - logger.js: Terminal e logs
 * - navigation.js: Modais, Tabs e Resumo
 * - connection.js: Conexão e Sessão WhatsApp
 * - groups.js: Gerenciamento e Seleção de Grupos
 * - variables.js: Modal de Variáveis Dinâmicas & Tags
 * - variations.js: Variações, Mídias & WhatsApp Mobile Live Preview
 * - dispatch.js: Motor de Disparos Cadenciados
 */

window.FGW = window.FGW || {};

FGW.setupEventListeners = function() {
  const elements = FGW.elements || {};

  // Inputs de Delays e Instância
  [elements.instanceName, elements.minDelay, elements.maxDelay, elements.presenceDelay]
    .filter(Boolean)
    .forEach(el => el.addEventListener('input', () => {
      FGW.saveSettings();
      if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
    }));

  // Ações da Navbar
  if (elements.btnOpenSettingsModal) {
    elements.btnOpenSettingsModal.addEventListener('click', () => FGW.openSettingsModal('tabWhatsApp'));
  }
  if (elements.btnOpenVariablesManagerNav) {
    elements.btnOpenVariablesManagerNav.addEventListener('click', FGW.openVariablesModal);
  }

  // Modal de Configuração (WhatsApp + Delays)
  if (elements.btnCloseSettingsModal) {
    elements.btnCloseSettingsModal.addEventListener('click', FGW.closeSettingsModal);
  }
  if (elements.btnSaveSettingsModal) {
    elements.btnSaveSettingsModal.addEventListener('click', FGW.closeSettingsModal);
  }
  if (elements.btnResetDefaultDelays) {
    elements.btnResetDefaultDelays.addEventListener('click', FGW.resetDefaultDelays);
  }

  // Abas internas do Modal de Configuração
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (tabId) FGW.switchSettingsTab(tabId);
    });
  });

  // Ações de Conexão (dentro do Modal de Configuração)
  if (elements.btnOpenQrModal) elements.btnOpenQrModal.addEventListener('click', FGW.handleRequestQrCodeInline);
  if (elements.btnConnect) elements.btnConnect.addEventListener('click', FGW.handleConnectAndFetchGroups);
  if (elements.btnDeleteInstance) elements.btnDeleteInstance.addEventListener('click', FGW.handleDeleteInstance);
  if (elements.btnRefreshQr) elements.btnRefreshQr.addEventListener('click', FGW.handleRequestQrCodeInline);
  if (elements.btnActiveDisconnect) elements.btnActiveDisconnect.addEventListener('click', FGW.handleDeleteInstance);

  // Filtros de Grupos (Todos vs Selecionados)
  if (elements.btnFilterAllGroups) {
    elements.btnFilterAllGroups.addEventListener('click', () => FGW.setGroupsFilter('all'));
  }
  if (elements.btnFilterSelectedGroups) {
    elements.btnFilterSelectedGroups.addEventListener('click', () => FGW.setGroupsFilter('selected'));
  }

  // Ações do Chat WhatsApp & Bloqueio Desconectado
  if (elements.btnConnectFromChat) {
    elements.btnConnectFromChat.addEventListener('click', () => FGW.openSettingsModal('tabWhatsApp'));
  }

  // Seletor do Grupo no Chat Central
  if (elements.chatTargetGroupSelect) {
    elements.chatTargetGroupSelect.addEventListener('change', () => {
      const val = elements.chatTargetGroupSelect.value;
      if (FGW.focusGroupInChat) {
        FGW.focusGroupInChat(val);
      } else {
        if (FGW.updateWhatsAppMobilePreview) FGW.updateWhatsAppMobilePreview();
        if (FGW.loadRealChatMessages) FGW.loadRealChatMessages(val);
      }
    });
  }

  // Recarregar histórico do Chat Real
  if (elements.btnRefreshRealChat) {
    elements.btnRefreshRealChat.addEventListener('click', () => {
      const val = elements.chatTargetGroupSelect ? elements.chatTargetGroupSelect.value : null;
      if (FGW.loadRealChatMessages) FGW.loadRealChatMessages(val);
    });
  }

  // Envio de mensagem direta no Chat Real
  if (elements.btnSendRealChatMessage) {
    elements.btnSendRealChatMessage.addEventListener('click', FGW.handleSendRealChatMessage);
  }
  if (elements.chatComposerInput) {
    elements.chatComposerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        FGW.handleSendRealChatMessage();
      }
    });
  }

  // Reprodução interativa de prévia de áudio PTT
  if (elements.btnPreviewAudioPlay) {
    elements.btnPreviewAudioPlay.addEventListener('click', () => {
      if (FGW.togglePreviewAudioPlayback) FGW.togglePreviewAudioPlayback();
    });
  }

  // Ações de Grupos (Coluna 1)
  if (elements.btnSelectAll) elements.btnSelectAll.addEventListener('click', FGW.selectAllGroups);
  if (elements.btnClearSelection) elements.btnClearSelection.addEventListener('click', FGW.clearGroupSelection);
  if (elements.btnReloadGroupsStep2) {
    elements.btnReloadGroupsStep2.addEventListener('click', () => FGW.handleConnectAndFetchGroups(true));
  }
  if (elements.btnManageVarsStep2) elements.btnManageVarsStep2.addEventListener('click', FGW.openVariablesModal);
  if (elements.masterCheckbox) elements.masterCheckbox.addEventListener('change', FGW.handleMasterCheckboxToggle);
  if (elements.searchGroupInput) elements.searchGroupInput.addEventListener('input', FGW.handleSearchFilter);

  // Ações de Mensagens & Variações (Painel Direito)
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
  if (elements.btnOpenVariablesManager) elements.btnOpenVariablesManager.addEventListener('click', FGW.openVariablesModal);

  // Ações de Disparo & Terminal (Barra Inferior)
  if (elements.btnStartDispatch) elements.btnStartDispatch.addEventListener('click', FGW.handleStartDispatch);
  if (elements.btnCancelDispatch) elements.btnCancelDispatch.addEventListener('click', FGW.handleCancelDispatch);
  if (elements.btnToggleTerminalDrawer) elements.btnToggleTerminalDrawer.addEventListener('click', FGW.toggleTerminalDrawer);
  if (elements.btnCloseTerminalDrawer) elements.btnCloseTerminalDrawer.addEventListener('click', FGW.closeTerminalDrawer);
  if (elements.btnClearLogs) {
    elements.btnClearLogs.addEventListener('click', () => {
      if (elements.terminalLogs) elements.terminalLogs.innerHTML = '';
      FGW.log('SISTEMA', 'Logs limpos.', 'sys');
    });
  }

  // Modal: Gerenciador de Variáveis Dinâmicas
  if (elements.btnCloseVariablesModal) elements.btnCloseVariablesModal.addEventListener('click', FGW.closeVariablesModal);
  if (elements.btnCloseVariablesModalBtn) elements.btnCloseVariablesModalBtn.addEventListener('click', FGW.closeVariablesModal);
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

  // Fechar modais ao clicar no fundo (backdrop)
  if (elements.settingsModal) {
    elements.settingsModal.addEventListener('click', (e) => {
      if (e.target === elements.settingsModal) FGW.closeSettingsModal();
    });
  }
  if (elements.variablesModal) {
    elements.variablesModal.addEventListener('click', (e) => {
      if (e.target === elements.variablesModal) FGW.closeVariablesModal();
    });
  }

  // Tecla Escape para fechar modais ou drawer abertos
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.settingsModal && !elements.settingsModal.classList.contains('hidden')) {
        FGW.closeSettingsModal();
      } else if (elements.variablesModal && !elements.variablesModal.classList.contains('hidden')) {
        FGW.closeVariablesModal();
      } else if (elements.terminalDrawer && !elements.terminalDrawer.classList.contains('hidden')) {
        FGW.closeTerminalDrawer();
      } else if (elements.updateNotificationModal && !elements.updateNotificationModal.classList.contains('hidden')) {
        elements.updateNotificationModal.classList.add('hidden');
      }
    }
  });
};

// ==========================================================================
// Gerenciamento de Sub-Rodapé e Atualizações Automáticas (GitHub Releases)
// ==========================================================================
FGW.setupAutoUpdateUI = function() {
  const elements = FGW.elements || {};

  // Link para o WhatsApp no rodapé
  if (elements.linkFooterWhatsApp) {
    elements.linkFooterWhatsApp.addEventListener('click', (e) => {
      e.preventDefault();
      const waUrl = 'https://wa.me/5583999010832';
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(waUrl);
      } else {
        window.open(waUrl, '_blank');
      }
    });
  }

  // Verificação manual de atualizações via botão do sub-rodapé
  if (elements.btnCheckUpdates) {
    elements.btnCheckUpdates.addEventListener('click', async () => {
      if (elements.btnCheckUpdates.classList.contains('checking')) return;

      elements.btnCheckUpdates.classList.add('checking');
      if (elements.updateBtnText) elements.updateBtnText.textContent = 'Verificando...';
      if (elements.updateStatusText) {
        elements.updateStatusText.className = 'update-status-text';
        elements.updateStatusText.textContent = '';
      }

      if (window.electronAPI && window.electronAPI.checkForUpdates) {
        try {
          const res = await window.electronAPI.checkForUpdates();
          if (!res || !res.success) {
            if (elements.updateStatusText) {
              elements.updateStatusText.className = 'update-status-text error';
              elements.updateStatusText.textContent = 'Falha ao buscar no GitHub';
            }
          }
        } catch (err) {
          if (elements.updateStatusText) {
            elements.updateStatusText.className = 'update-status-text error';
            elements.updateStatusText.textContent = 'Erro de conexão';
          }
        } finally {
          setTimeout(() => {
            elements.btnCheckUpdates.classList.remove('checking');
            if (elements.updateBtnText) elements.updateBtnText.textContent = 'Verificar Atualizações';
          }, 2500);
        }
      } else {
        elements.btnCheckUpdates.classList.remove('checking');
        if (elements.updateBtnText) elements.updateBtnText.textContent = 'Verificar Atualizações';
        if (elements.updateStatusText) {
          elements.updateStatusText.textContent = 'Disponível no app instalado.';
        }
      }
    });
  }

  // Modal de Atualização: Ações
  if (elements.btnStartDownloadUpdate) {
    elements.btnStartDownloadUpdate.addEventListener('click', async () => {
      elements.btnStartDownloadUpdate.disabled = true;
      elements.btnStartDownloadUpdate.classList.add('hidden');
      if (elements.updateDownloadProgressWrap) {
        elements.updateDownloadProgressWrap.classList.remove('hidden');
      }
      if (window.electronAPI && window.electronAPI.downloadUpdate) {
        await window.electronAPI.downloadUpdate();
      }
    });
  }

  if (elements.btnRestartAndInstall) {
    elements.btnRestartAndInstall.addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.quitAndInstall) {
        window.electronAPI.quitAndInstall();
      }
    });
  }

  const closeUpdateModal = () => {
    if (elements.updateNotificationModal) {
      elements.updateNotificationModal.classList.add('hidden');
    }
  };

  if (elements.btnCloseUpdateModal) elements.btnCloseUpdateModal.addEventListener('click', closeUpdateModal);
  if (elements.btnDismissUpdate) elements.btnDismissUpdate.addEventListener('click', closeUpdateModal);

  // Escuta eventos do electron-updater
  if (window.electronAPI && window.electronAPI.onUpdateEvent) {
    window.electronAPI.onUpdateEvent((data) => {
      if (!data) return;

      switch (data.type) {
        case 'checking':
          if (elements.updateStatusText) {
            elements.updateStatusText.className = 'update-status-text';
            elements.updateStatusText.textContent = 'Buscando atualizações...';
          }
          break;

        case 'available':
          if (elements.lblNewVersion) elements.lblNewVersion.textContent = `v${data.version || 'recente'}`;
          if (elements.updateReleaseNotesBox && elements.updateReleaseNotesContent) {
            if (data.releaseNotes) {
              elements.updateReleaseNotesContent.innerHTML = typeof data.releaseNotes === 'string'
                ? data.releaseNotes
                : JSON.stringify(data.releaseNotes);
              elements.updateReleaseNotesBox.classList.remove('hidden');
            } else {
              elements.updateReleaseNotesBox.classList.add('hidden');
            }
          }
          if (elements.updateDownloadProgressWrap) elements.updateDownloadProgressWrap.classList.add('hidden');
          if (elements.btnStartDownloadUpdate) {
            elements.btnStartDownloadUpdate.disabled = false;
            elements.btnStartDownloadUpdate.classList.remove('hidden');
          }
          if (elements.btnRestartAndInstall) elements.btnRestartAndInstall.classList.add('hidden');
          if (elements.updateNotificationModal) elements.updateNotificationModal.classList.remove('hidden');
          if (elements.updateStatusText) {
            elements.updateStatusText.className = 'update-status-text';
            elements.updateStatusText.textContent = `Nova v${data.version} disponível!`;
          }
          break;

        case 'not-available':
          if (elements.updateStatusText) {
            elements.updateStatusText.className = 'update-status-text';
            elements.updateStatusText.textContent = '✓ Versão mais recente (v1.0.0)';
            setTimeout(() => {
              if (elements.updateStatusText) elements.updateStatusText.textContent = '';
            }, 5000);
          }
          break;

        case 'progress':
          if (elements.updateDownloadProgressWrap) elements.updateDownloadProgressWrap.classList.remove('hidden');
          if (elements.lblUpdatePercent) elements.lblUpdatePercent.textContent = `${data.percent}%`;
          if (elements.updateProgressBarFill) elements.updateProgressBarFill.style.width = `${data.percent}%`;
          break;

        case 'downloaded':
          if (elements.updateDownloadProgressWrap) elements.updateDownloadProgressWrap.classList.add('hidden');
          if (elements.btnStartDownloadUpdate) elements.btnStartDownloadUpdate.classList.add('hidden');
          if (elements.btnRestartAndInstall) elements.btnRestartAndInstall.classList.remove('hidden');
          if (elements.updateNotificationModal) elements.updateNotificationModal.classList.remove('hidden');
          if (elements.updateStatusText) {
            elements.updateStatusText.className = 'update-status-text';
            elements.updateStatusText.textContent = 'Pronto para instalar!';
          }
          break;

        case 'error':
          if (elements.updateStatusText) {
            elements.updateStatusText.className = 'update-status-text error';
            elements.updateStatusText.textContent = 'Erro na checagem';
            setTimeout(() => {
              if (elements.updateStatusText) elements.updateStatusText.textContent = '';
            }, 5000);
          }
          break;
      }
    });
  }
};

// ==========================================================================
// Inicialização do Aplicativo (Boot do Workspace)
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  FGW.initElements();
  FGW.loadSavedSettings();

  // Carrega a instância gravada no IndexedDB para este aplicativo
  if (FGW.loadInstanceNameFromIndexedDB) {
    const savedIdb = await FGW.loadInstanceNameFromIndexedDB();
    if (savedIdb && FGW.elements?.instanceName) {
      FGW.elements.instanceName.value = savedIdb;
    }
  }

  FGW.setupEventListeners();
  FGW.setupAutoUpdateUI();

  // Se existirem grupos previamente selecionados, inicia diretamente na aba de selecionados
  if (FGW.state.selectedGroupIds && FGW.state.selectedGroupIds.size > 0) {
    if (FGW.setGroupsFilter) FGW.setGroupsFilter('selected');
  } else {
    if (FGW.setGroupsFilter) FGW.setGroupsFilter('all');
  }

  FGW.renderVariations();
  FGW.renderDynamicTagChips();
  FGW.renderGroupsTable();
  FGW.updateSelectionCounter();
  FGW.updateVariationsBadge();
  FGW.updateCampaignSummary();
  FGW.updateVariationScopeSelectorOptions();
  if (FGW.updateChatTargetGroupOptions) FGW.updateChatTargetGroupOptions();
  if (FGW.updateWhatsAppMobilePreview) FGW.updateWhatsAppMobilePreview();

  FGW.log('SISTEMA', 'FlashGroup WPP Workspace iniciado em tela cheia.', 'sys');
  FGW.checkActiveConnectionOnStartup();
});

