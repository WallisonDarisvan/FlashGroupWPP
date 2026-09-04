/**
 * FlashGroup WPP - Módulo: Dispatch
 * Gerencia a Etapa 4: fila de disparo cadenciado, simulação humana de digitação e métricas de envio.
 */

window.FGW = window.FGW || {};

FGW.shuffleArray = function(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

FGW.interruptibleSleep = function(ms) {
  return new Promise(resolve => {
    const step = 250;
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += step;
      if (elapsed >= ms || FGW.state.cancelRequested) {
        clearInterval(interval);
        resolve();
      }
    }, step);
  });
};

FGW.updateProgressUI = function() {
  const elements = FGW.elements || {};
  const { total, success, failed, remaining } = FGW.state.stats;
  if (elements.statTotal) elements.statTotal.textContent = total;
  if (elements.statSuccess) elements.statSuccess.textContent = success;
  if (elements.statFailed) elements.statFailed.textContent = failed;
  if (elements.statRemaining) elements.statRemaining.textContent = remaining;

  const processed = success + failed;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  if (elements.progressBarFill) elements.progressBarFill.style.width = `${percent}%`;
  if (elements.progressPercentage) elements.progressPercentage.textContent = `${percent}%`;
};

FGW.setExecutionUIState = function(isRunning) {
  const elements = FGW.elements || {};
  if (elements.btnConnect) elements.btnConnect.disabled = isRunning;
  if (elements.btnOpenQrModal) elements.btnOpenQrModal.disabled = isRunning;
  if (elements.btnDeleteInstance) elements.btnDeleteInstance.disabled = isRunning;
  if (elements.instanceName) elements.instanceName.disabled = isRunning;
  if (elements.minDelay) elements.minDelay.disabled = isRunning;
  if (elements.maxDelay) elements.maxDelay.disabled = isRunning;
  if (elements.presenceDelay) elements.presenceDelay.disabled = isRunning;
  if (elements.btnAddVariation) elements.btnAddVariation.disabled = isRunning;
  if (elements.btnSelectAll) elements.btnSelectAll.disabled = isRunning;
  if (elements.btnClearSelection) elements.btnClearSelection.disabled = isRunning;
  if (elements.btnInsertGroupIdTag) elements.btnInsertGroupIdTag.disabled = isRunning;
  if (elements.btnManageVarsStep2) elements.btnManageVarsStep2.disabled = isRunning;
  if (elements.btnOpenVariablesManager) elements.btnOpenVariablesManager.disabled = isRunning;

  if (elements.dynamicTagsChipsContainer) {
    elements.dynamicTagsChipsContainer.querySelectorAll('button').forEach(btn => btn.disabled = isRunning);
  }

  if (elements.variationsList) {
    elements.variationsList.querySelectorAll('textarea, button, input').forEach(el => el.disabled = isRunning);
  }
  if (elements.groupsTableBody) {
    elements.groupsTableBody.querySelectorAll('.group-checkbox, .custom-id-input, .custom-var-input').forEach(el => el.disabled = isRunning);
  }
  if (elements.masterCheckbox) elements.masterCheckbox.disabled = isRunning;

  if (elements.btnStartDispatch) elements.btnStartDispatch.disabled = isRunning;
  if (elements.btnCancelDispatch) {
    elements.btnCancelDispatch.disabled = !isRunning;
    const span = elements.btnCancelDispatch.querySelector('span');
    if (span) span.textContent = 'Parar / Cancelar';
  }

  if (isRunning) {
    if (elements.executionStateBadge) elements.executionStateBadge.className = 'status-badge running';
    if (elements.executionStateText) elements.executionStateText.textContent = 'Enviando...';
  } else {
    if (elements.executionStateBadge) elements.executionStateBadge.className = 'status-badge idle';
    if (elements.executionStateText) elements.executionStateText.textContent = 'Pronto';
  }
};

FGW.handleStartDispatch = async function() {
  FGW.saveSettings();
  const elements = FGW.elements || {};
  const state = FGW.state;

  const validVariations = FGW.getValidVariations ? FGW.getValidVariations() : [];
  if (validVariations.length < 3) {
    alert(`Você possui apenas ${validVariations.length} variação(ões) válida(s). Cadastre pelo menos 3 variações na Etapa 3 antes de disparar!`);
    FGW.log('AVISO', 'Disparo bloqueado: mínimo de 3 variações de mensagem exigidas.', 'warn');
    FGW.goToStep(3);
    return;
  }

  if (state.selectedGroupIds.size === 0) {
    alert('Selecione pelo menos 1 grupo na Etapa 2 para iniciar os disparos.');
    FGW.log('AVISO', 'Nenhum grupo selecionado para envio.', 'warn');
    FGW.goToStep(2);
    return;
  }

  const minDelay = parseInt(elements.minDelay ? elements.minDelay.value : 20, 10) || 20;
  const maxDelay = parseInt(elements.maxDelay ? elements.maxDelay.value : 50, 10) || 50;
  const presenceDelay = parseInt(elements.presenceDelay ? elements.presenceDelay.value : 1200, 10) || 1200;

  if (minDelay <= 0 || maxDelay <= 0 || minDelay > maxDelay) {
    alert('Configuração de delays inválida. O delay mínimo deve ser maior que 0 e menor ou igual ao máximo.');
    FGW.goToStep(3);
    return;
  }

  const instanceName = elements.instanceName ? elements.instanceName.value.trim() : '';
  if (!instanceName) {
    alert('Preencha o Nome da Instância.');
    FGW.goToStep(1);
    return;
  }

  const selectedGroups = state.groups.filter(g => state.selectedGroupIds.has(g.id));
  const dispatchQueue = FGW.shuffleArray(selectedGroups);

  state.isDispatching = true;
  state.cancelRequested = false;
  state.stats = {
    total: dispatchQueue.length,
    success: 0,
    failed: 0,
    remaining: dispatchQueue.length
  };

  dispatchQueue.forEach(g => FGW.updateGroupStatusInDOM(g.id, 'pending'));
  FGW.updateProgressUI();
  FGW.setExecutionUIState(true);

  FGW.log('INFO', `Iniciando disparos para ${dispatchQueue.length} grupos em ordem aleatória (Fisher-Yates)...`, 'info');
  FGW.log('INFO', `Cadência: ${minDelay}s a ${maxDelay}s | Digitação: ${presenceDelay}ms`, 'info');

  for (let i = 0; i < dispatchQueue.length; i++) {
    if (state.cancelRequested) {
      FGW.log('AVISO', 'Operação de disparos cancelada pelo usuário.', 'warn');
      break;
    }

    const currentGroup = dispatchQueue[i];
    FGW.updateGroupStatusInDOM(currentGroup.id, 'sending');

    const groupVarsData = FGW.getVariationsForGroup(currentGroup);
    const pool = groupVarsData.variations;
    const chosenVariation = pool[Math.floor(Math.random() * pool.length)];
    const processedText = FGW.applyDynamicTags(chosenVariation.text, currentGroup);
    const scopeTag = groupVarsData.isCustom ? '[EXCLUSIVA DO GRUPO]' : '[PADRÃO GERAL]';
    const groupIdentifierLabel = (currentGroup.customId && currentGroup.customId.trim())
      ? `"${currentGroup.subject}" [ID/Nome: ${currentGroup.customId.trim()}]`
      : `"${currentGroup.subject}"`;

    try {
      let result;

      // Disparo com Mídia ou Texto Puro (respeitando a chave individual de mídia)
      const hasActiveMedia = Boolean(chosenVariation.media && chosenVariation.media.dataUrl && chosenVariation.mediaEnabled !== false);

      if (hasActiveMedia) {
        FGW.log('INFO', `[${i + 1}/${dispatchQueue.length}] ${scopeTag} Enviando com mídia (${chosenVariation.media.fileName}) para ${groupIdentifierLabel}...`, 'info');
        result = await window.electronAPI.sendMediaMessage({
          instanceName,
          number: currentGroup.id,
          media: chosenVariation.media.dataUrl,
          mediatype: chosenVariation.media.mediatype,
          mimetype: chosenVariation.media.mimetype,
          fileName: chosenVariation.media.fileName,
          caption: processedText,
          delay: presenceDelay
        });
      } else {
        const sendNote = (chosenVariation.media && chosenVariation.mediaEnabled === false) ? ' [Mídia pausada: enviando apenas texto]' : '';
        FGW.log('INFO', `[${i + 1}/${dispatchQueue.length}] ${scopeTag} Enviando mensagem de texto para ${groupIdentifierLabel}${sendNote}...`, 'info');
        result = await window.electronAPI.sendMessage({
          instanceName,
          number: currentGroup.id,
          text: processedText,
          delay: presenceDelay
        });
      }

      if (result.success) {
        state.stats.success++;
        FGW.updateGroupStatusInDOM(currentGroup.id, 'success');
        FGW.log('SUCESSO', `Mensagem enviada com sucesso para "${currentGroup.subject}".`, 'success');

        // Registra e persiste a mensagem no histórico do chat do grupo
        if (FGW.addRealChatMessage) {
          let mediaIcon = '📷';
          if (chosenVariation.media?.mediatype === 'audio') mediaIcon = '🎤';
          else if (chosenVariation.media?.mediatype === 'video') mediaIcon = '🎥';
          else if (chosenVariation.media?.mediatype === 'document') mediaIcon = '📄';

          const sentText = (hasActiveMedia && chosenVariation.media && chosenVariation.media.fileName)
            ? (processedText ? `${mediaIcon} ${chosenVariation.media.fileName}\n${processedText}` : `${mediaIcon} ${chosenVariation.media.fileName}`)
            : processedText;

          const realCampaignMsgId = result.data?.key?.id || ('campaign_' + Date.now() + '_' + Math.random().toString(36).substring(7));
          FGW.addRealChatMessage(currentGroup.id, {
            id: realCampaignMsgId,
            fromMe: true,
            pushName: 'Você (Disparo)',
            text: sentText,
            timestamp: Date.now(),
            status: 'SENT'
          });
        }
      } else {
        state.stats.failed++;
        FGW.updateGroupStatusInDOM(currentGroup.id, 'error');
        FGW.log('ERRO', `Falha ao enviar para "${currentGroup.subject}": ${result.error}`, 'error');
      }
    } catch (err) {
      state.stats.failed++;
      FGW.updateGroupStatusInDOM(currentGroup.id, 'error');
      FGW.log('ERRO', `Exceção na requisição para "${currentGroup.subject}": ${err.message}`, 'error');
    }

    state.stats.remaining--;
    FGW.updateProgressUI();

    if (i < dispatchQueue.length - 1 && !state.cancelRequested) {
      const delaySeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      FGW.log('INFO', `Aguardando intervalo cadenciado de ${delaySeconds}s antes do próximo envio...`, 'info');
      await FGW.interruptibleSleep(delaySeconds * 1000);
    }
  }

  state.isDispatching = false;
  FGW.setExecutionUIState(false);

  if (state.cancelRequested) {
    FGW.log('AVISO', `Disparos interrompidos. Resumo: ${state.stats.success} enviados, ${state.stats.failed} falhas.`, 'warn');
  } else {
    FGW.log('SUCESSO', `Disparos finalizados com sucesso! Total: ${state.stats.total} | Enviados: ${state.stats.success} | Falhas: ${state.stats.failed}`, 'success');
    alert(`Disparos finalizados!\n\nEnviados: ${state.stats.success}\nFalhas: ${state.stats.failed}\nTotal: ${state.stats.total}`);
  }
};

FGW.handleCancelDispatch = function() {
  if (!FGW.state.isDispatching) return;
  FGW.state.cancelRequested = true;
  const elements = FGW.elements || {};
  if (elements.btnCancelDispatch) {
    elements.btnCancelDispatch.disabled = true;
    const span = elements.btnCancelDispatch.querySelector('span');
    if (span) span.textContent = 'Cancelando...';
  }
  FGW.log('AVISO', 'Solicitação de cancelamento recebida. Aguardando término da requisição em curso...', 'warn');
};

window.handleStartDispatch = FGW.handleStartDispatch;
window.handleCancelDispatch = FGW.handleCancelDispatch;
window.shuffleArray = FGW.shuffleArray;
window.updateProgressUI = FGW.updateProgressUI;
window.setExecutionUIState = FGW.setExecutionUIState;
