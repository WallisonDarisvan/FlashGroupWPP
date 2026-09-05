/**
 * FlashGroup WPP - Módulo: Variations
 * Gerencia a Etapa 3: variações de mensagem com mídia individual e alternância de escopo (Geral vs. Exclusivo por Grupo).
 */

window.FGW = window.FGW || {};

FGW.getActiveInstanceName = function() {
  const elements = FGW.elements || {};
  return (
    FGW.state.activeInstanceName ||
    (elements.connectedInstanceTitle && elements.connectedInstanceTitle.textContent.trim() !== '---' ? elements.connectedInstanceTitle.textContent.trim() : '') ||
    (elements.instanceName ? elements.instanceName.value.trim() : '') ||
    localStorage.getItem(FGW.STORAGE_KEYS?.INSTANCE_NAME) ||
    ''
  ).trim();
};

FGW.getCurrentActiveVariationsList = function() {
  const state = FGW.state;
  if (state.activeMessageScope === '__global__') {
    return state.messageVariations;
  }
  const gId = state.activeMessageScope;
  if (!state.groupCustomVariations[gId]) {
    state.groupCustomVariations[gId] = {
      enabled: false,
      variations: []
    };
  }
  return state.groupCustomVariations[gId].variations;
};

FGW.saveActiveVariations = function() {
  if (FGW.state.activeMessageScope === '__global__') {
    FGW.saveSettings();
  } else {
    FGW.saveGroupCustomVariations();
  }
};

FGW.updateVariationScopeSelectorOptions = function() {
  const elements = FGW.elements || {};
  if (!elements.variationScopeSelector) return;
  const currentVal = FGW.state.activeMessageScope || '__global__';

  let html = `<option value="__global__">🌐 Mensagens Gerais da Campanha (Padrão para todos)</option>`;

  if (Array.isArray(FGW.state.groups) && FGW.state.groups.length > 0) {
    html += `<optgroup label="Mensagens Individuais por Grupo">`;
    FGW.state.groups.forEach(g => {
      const customConfig = FGW.state.groupCustomVariations[g.id];
      const isCustomActive = customConfig && customConfig.enabled && Array.isArray(customConfig.variations) && customConfig.variations.length > 0;
      const count = (customConfig && customConfig.variations) ? customConfig.variations.length : 0;
      const label = isCustomActive 
        ? `💬 ${g.subject} (${count} exclusiva${count === 1 ? '' : 's'})`
        : `👥 ${g.subject} (Usa padrão geral)`;
      html += `<option value="${FGW.escapeHtml(g.id)}">${FGW.escapeHtml(label)}</option>`;
    });
    html += `</optgroup>`;
  }

  elements.variationScopeSelector.innerHTML = html;
  elements.variationScopeSelector.value = currentVal;
};

FGW.handleScopeChange = function(newScopeId) {
  FGW.state.activeMessageScope = newScopeId;
  FGW.state.previewVariationIndex = 0;
  const elements = FGW.elements || {};

  if (newScopeId === '__global__') {
    if (elements.scopeGroupStatusBox) elements.scopeGroupStatusBox.style.display = 'none';
  } else {
    if (elements.scopeGroupStatusBox) elements.scopeGroupStatusBox.style.display = 'flex';
    const customConfig = FGW.state.groupCustomVariations[newScopeId] || { enabled: false, variations: [] };
    if (elements.chkEnableGroupCustomVars) {
      elements.chkEnableGroupCustomVars.checked = !!customConfig.enabled;
    }
  }

  FGW.renderVariations();
  FGW.updateVariationsBadge();
  FGW.updateVariationScopeSelectorOptions();
};

FGW.handleToggleGroupCustomVars = function() {
  if (FGW.state.activeMessageScope === '__global__') return;
  const gId = FGW.state.activeMessageScope;
  if (!FGW.state.groupCustomVariations[gId]) {
    FGW.state.groupCustomVariations[gId] = { enabled: false, variations: [] };
  }

  const elements = FGW.elements || {};
  const isChecked = elements.chkEnableGroupCustomVars ? elements.chkEnableGroupCustomVars.checked : false;
  FGW.state.groupCustomVariations[gId].enabled = isChecked;

  // Se ativou e ainda não tem mensagens, clona as gerais como base para agilizar o usuário
  if (isChecked && (!FGW.state.groupCustomVariations[gId].variations || FGW.state.groupCustomVariations[gId].variations.length === 0)) {
    FGW.state.groupCustomVariations[gId].variations = JSON.parse(JSON.stringify(FGW.state.messageVariations));
    FGW.log('INFO', `Mensagens gerais clonadas como base para o grupo "${gId}".`, 'info');
  }

  FGW.saveGroupCustomVariations();
  FGW.renderVariations();
  FGW.updateVariationsBadge();
  if (FGW.renderGroupsTable) FGW.renderGroupsTable();
  FGW.updateVariationScopeSelectorOptions();
};

FGW.handleCopyGlobalToGroup = function() {
  if (FGW.state.activeMessageScope === '__global__') return;
  const gId = FGW.state.activeMessageScope;

  if (FGW.state.groupCustomVariations[gId]?.variations?.length > 0) {
    const ok = confirm('Deseja substituir as mensagens deste grupo pelas mensagens gerais da campanha?');
    if (!ok) return;
  }

  if (!FGW.state.groupCustomVariations[gId]) {
    FGW.state.groupCustomVariations[gId] = { enabled: true, variations: [] };
  }

  FGW.state.groupCustomVariations[gId].variations = JSON.parse(JSON.stringify(FGW.state.messageVariations));
  FGW.state.groupCustomVariations[gId].enabled = true;
  if (FGW.elements && FGW.elements.chkEnableGroupCustomVars) FGW.elements.chkEnableGroupCustomVars.checked = true;

  FGW.saveGroupCustomVariations();
  FGW.renderVariations();
  FGW.updateVariationsBadge();
  if (FGW.renderGroupsTable) FGW.renderGroupsTable();
  FGW.updateVariationScopeSelectorOptions();
  FGW.log('SUCESSO', 'Mensagens gerais copiadas para este grupo com sucesso.', 'success');
};

FGW.getVariationsForGroup = function(group) {
  const customConfig = FGW.state.groupCustomVariations[group.id];
  if (customConfig && customConfig.enabled && Array.isArray(customConfig.variations)) {
    const valid = customConfig.variations.filter(v => {
      if (!v) return false;
      const hasText = (v.text || '').trim().length > 0;
      const hasActiveMedia = !!(v.media && v.media.dataUrl && v.mediaEnabled !== false);
      return hasText || hasActiveMedia;
    });
    if (valid.length > 0) {
      return { isCustom: true, variations: valid };
    }
  }
  return { isCustom: false, variations: FGW.getValidVariations() };
};

FGW.formatWhatsAppPreviewText = function(rawText) {
  if (!rawText || !rawText.trim()) {
    return '<span style="opacity: 0.6; font-style: italic;">(Mensagem sem texto)</span>';
  }

  // 1. Escapa HTML para prevenir injeção
  let text = FGW.escapeHtml(rawText);

  // 2. Destaca e formata variáveis dinâmicas {Tag}
  text = text.replace(/\{([^}]+)\}/g, '<span class="tag-highlight">{$1}</span>');

  // 3. Formatação tradicional do WhatsApp
  // Monoespaçado: ```código```
  text = text.replace(/```([^`]+)```/g, '<code>$1</code>');
  // Negrito: *texto*
  text = text.replace(/(?:\*([^*\n]+)\*)/g, '<strong>$1</strong>');
  // Itálico: _texto_
  text = text.replace(/(?:_([^_\n]+)_)/g, '<em>$1</em>');
  // Tachado: ~texto~
  text = text.replace(/(?:~([^~\n]+)~)/g, '<del>$1</del>');

  // 4. Quebras de linha
  text = text.replace(/\n/g, '<br>');

  return text;
};

FGW._previewAudioPlayer = null;

FGW.setPreviewAudioPlayingState = function(isPlaying) {
  const elements = FGW.elements || {};
  const btn = elements.btnPreviewAudioPlay;
  const box = elements.waPreviewAudioBox;
  if (!btn) return;

  if (isPlaying) {
    btn.classList.add('is-playing');
    if (box) box.classList.add('is-playing');
    btn.title = 'Pausar reprodução de áudio';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1"/>
        <rect x="14" y="4" width="4" height="16" rx="1"/>
      </svg>
    `;
  } else {
    btn.classList.remove('is-playing');
    if (box) box.classList.remove('is-playing');
    btn.title = 'Reproduzir áudio gravado';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    `;
  }
};

FGW.togglePreviewAudioPlayback = function() {
  const activeList = FGW.getCurrentActiveVariationsList();
  const current = activeList[FGW.state.previewVariationIndex];
  if (!current || !current.media || current.media.mediatype !== 'audio' || !current.media.dataUrl) {
    return;
  }

  // Se já estiver tocando, pausa
  if (FGW._previewAudioPlayer && !FGW._previewAudioPlayer.paused) {
    FGW._previewAudioPlayer.pause();
    FGW.setPreviewAudioPlayingState(false);
    return;
  }

  try {
    if (!FGW._previewAudioPlayer || FGW._previewAudioPlayer.src !== current.media.dataUrl) {
      if (FGW._previewAudioPlayer) {
        FGW._previewAudioPlayer.pause();
      }
      FGW._previewAudioPlayer = new Audio(current.media.dataUrl);
      FGW._previewAudioPlayer.onended = () => FGW.setPreviewAudioPlayingState(false);
      FGW._previewAudioPlayer.onerror = () => FGW.setPreviewAudioPlayingState(false);
    }

    FGW._previewAudioPlayer.play()
      .then(() => FGW.setPreviewAudioPlayingState(true))
      .catch(err => {
        console.warn('Falha ao reproduzir áudio de preview:', err);
        FGW.setPreviewAudioPlayingState(false);
      });
  } catch (err) {
    console.warn('Exceção ao inicializar áudio:', err);
    FGW.setPreviewAudioPlayingState(false);
  }
};

FGW.updateWhatsAppMobilePreview = function() {
  const elements = FGW.elements || {};
  const activeList = FGW.getCurrentActiveVariationsList();

  // Pausa player de áudio anterior se estiver tocando
  if (FGW._previewAudioPlayer && !FGW._previewAudioPlayer.paused) {
    FGW._previewAudioPlayer.pause();
    FGW.setPreviewAudioPlayingState(false);
  }

  // Relógio do Celular e da Mensagem
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (elements.phoneStatusTime) elements.phoneStatusTime.textContent = timeStr;
  if (elements.waMessageTime) elements.waMessageTime.textContent = timeStr;

  // Grupo em foco no Chat Central
  const selectedChatGroupId = FGW.state.currentChatGroupId
    || (elements.chatTargetGroupSelect && elements.chatTargetGroupSelect.value !== '__preview_default__' ? elements.chatTargetGroupSelect.value : null);
  const targetGroup = (selectedChatGroupId && selectedChatGroupId !== '__preview_default__')
    ? (FGW.state.groups || []).find(g => g.id === selectedChatGroupId)
    : null;

  if (elements.waPreviewTargetStatus) {
    if (targetGroup) {
      const count = targetGroup.participantsCount !== null ? `${targetGroup.participantsCount} membros • ` : '';
      elements.waPreviewTargetStatus.textContent = `${count}online`;
    } else {
      elements.waPreviewTargetStatus.textContent = 'online • modelo geral para os grupos selecionados';
    }
  }

  // Atualiza a foto do avatar no cabeçalho do chat
  const chatAvatar = document.getElementById('chatHeaderAvatar');
  if (chatAvatar) {
    if (targetGroup && targetGroup.pictureUrl) {
      chatAvatar.innerHTML = `<img src="${FGW.escapeHtml(targetGroup.pictureUrl)}" alt="" onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\' width=\\'20\\' height=\\'20\\' fill=\\'currentColor\\'><path d=\\'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z\\'/></svg>';">`;
    } else {
      chatAvatar.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>`;
    }
  }

  // Se a lista estiver vazia
  if (!activeList || activeList.length === 0) {
    if (elements.previewVariationIndicator) elements.previewVariationIndicator.textContent = 'Sem variações';
    if (elements.waPreviewText) elements.waPreviewText.innerHTML = '<em>Nenhuma variação cadastrada neste escopo.</em>';
    if (elements.waPreviewMediaContainer) elements.waPreviewMediaContainer.classList.add('hidden');
    return;
  }

  // Ajusta o índice ativo caso esteja fora dos limites
  if (FGW.state.previewVariationIndex >= activeList.length) {
    FGW.state.previewVariationIndex = 0;
  } else if (FGW.state.previewVariationIndex < 0) {
    FGW.state.previewVariationIndex = 0;
  }

  const curIdx = FGW.state.previewVariationIndex;
  const item = activeList[curIdx] || { text: '', media: null };

  // Atualiza Badge do Topo do Chat
  if (elements.previewVariationIndicator) {
    elements.previewVariationIndicator.textContent = `Variação #${curIdx + 1}`;
  }

  // Atualiza Texto da Mensagem: se houver grupo em foco, resolve variáveis dinâmicas!
  if (elements.waPreviewText) {
    let displayText = item.text || '';
    if (targetGroup && FGW.applyDynamicTags) {
      displayText = FGW.applyDynamicTags(displayText, targetGroup);
    }
    elements.waPreviewText.innerHTML = FGW.formatWhatsAppPreviewText(displayText);
  }

  // Atualiza Mídia Anexa
  if (elements.waPreviewMediaContainer) {
    if (item.media && item.media.dataUrl) {
      elements.waPreviewMediaContainer.classList.remove('hidden');

      if (item.media.mediatype === 'image') {
        if (elements.waPreviewImage) {
          elements.waPreviewImage.src = item.media.dataUrl;
          elements.waPreviewImage.classList.remove('hidden');
        }
        if (elements.waPreviewVideoBox) elements.waPreviewVideoBox.classList.add('hidden');
        if (elements.waPreviewDocBox) elements.waPreviewDocBox.classList.add('hidden');
        if (elements.waPreviewAudioBox) elements.waPreviewAudioBox.classList.add('hidden');
      } else if (item.media.mediatype === 'video') {
        if (elements.waPreviewImage) elements.waPreviewImage.classList.add('hidden');
        if (elements.waPreviewVideoBox) {
          elements.waPreviewVideoBox.classList.remove('hidden');
          if (elements.waPreviewVideoName) elements.waPreviewVideoName.textContent = item.media.fileName || 'video.mp4';
        }
        if (elements.waPreviewDocBox) elements.waPreviewDocBox.classList.add('hidden');
        if (elements.waPreviewAudioBox) elements.waPreviewAudioBox.classList.add('hidden');
      } else if (item.media.mediatype === 'audio') {
        if (elements.waPreviewImage) elements.waPreviewImage.classList.add('hidden');
        if (elements.waPreviewVideoBox) elements.waPreviewVideoBox.classList.add('hidden');
        if (elements.waPreviewDocBox) elements.waPreviewDocBox.classList.add('hidden');
        if (elements.waPreviewAudioBox) {
          elements.waPreviewAudioBox.classList.remove('hidden');
          if (elements.waPreviewAudioName) elements.waPreviewAudioName.textContent = item.media.fileName || 'audio.mp3';
        }
      } else {
        // Documento PDF
        if (elements.waPreviewImage) elements.waPreviewImage.classList.add('hidden');
        if (elements.waPreviewVideoBox) elements.waPreviewVideoBox.classList.add('hidden');
        if (elements.waPreviewAudioBox) elements.waPreviewAudioBox.classList.add('hidden');
        if (elements.waPreviewDocBox) {
          elements.waPreviewDocBox.classList.remove('hidden');
          if (elements.waPreviewDocName) elements.waPreviewDocName.textContent = item.media.fileName || 'documento.pdf';
          if (elements.waPreviewDocMeta) {
            elements.waPreviewDocMeta.textContent = `${item.media.fileSizeStr || ''} • ${(item.media.mediatype || 'DOC').toUpperCase()}`;
          }
        }
      }
    } else {
      elements.waPreviewMediaContainer.classList.add('hidden');
      if (elements.waPreviewImage) elements.waPreviewImage.classList.add('hidden');
      if (elements.waPreviewVideoBox) elements.waPreviewVideoBox.classList.add('hidden');
      if (elements.waPreviewDocBox) elements.waPreviewDocBox.classList.add('hidden');
      if (elements.waPreviewAudioBox) elements.waPreviewAudioBox.classList.add('hidden');
    }
  }

  // Destaca o card ativo na lista de variações
  if (elements.variationsList) {
    elements.variationsList.querySelectorAll('.variation-item').forEach((card, i) => {
      if (i === curIdx) {
        if (!card.classList.contains('is-active-preview')) {
          card.classList.add('is-active-preview');
        }
        const headerLeft = card.querySelector('.variation-header-left');
        if (headerLeft && !headerLeft.querySelector('.badge-previewing')) {
          const b = document.createElement('span');
          b.className = 'badge-previewing';
          b.innerHTML = '👁️ No Preview';
          headerLeft.appendChild(b);
        }
      } else {
        if (card.classList.contains('is-active-preview')) {
          card.classList.remove('is-active-preview');
        }
        const b = card.querySelector('.badge-previewing');
        if (b) b.remove();
      }
    });
  }
};

FGW.renderVariations = function() {
  const elements = FGW.elements || {};
  if (!elements.variationsList) return;
  elements.variationsList.innerHTML = '';

  const activeList = FGW.getCurrentActiveVariationsList();
  const isGroupScope = FGW.state.activeMessageScope !== '__global__';
  const groupCustomConfig = isGroupScope ? FGW.state.groupCustomVariations[FGW.state.activeMessageScope] : null;
  const isGroupCustomDisabled = isGroupScope && (!groupCustomConfig || !groupCustomConfig.enabled);

  if (isGroupCustomDisabled) {
    const banner = document.createElement('div');
    banner.className = 'group-inherited-state';
    banner.innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <div>
        <strong>Mensagens Exclusivas Desativadas</strong>
        <p>Este grupo está utilizando automaticamente as <strong>Mensagens Gerais da Campanha</strong> no momento do disparo. Ative o interruptor acima se desejar definir mensagens ou mídias específicas para este grupo.</p>
      </div>
    `;
    elements.variationsList.appendChild(banner);
  }

  activeList.forEach((item, index) => {
    const textValue = item?.text || '';
    const hasMedia = !!(item?.media && item.media.dataUrl);
    const isMediaEnabled = item?.mediaEnabled !== false;
    const isCurrentlyPreviewed = (index === FGW.state.previewVariationIndex);

    const card = document.createElement('div');
    card.className = `variation-item ${isCurrentlyPreviewed ? 'is-active-preview' : ''}`;
    card.id = `variation-card-${index}`;
    card.dataset.index = index;

    let mediaBadgeHtml = '';
    if (hasMedia) {
      const typeLabel = (item.media.mediatype || 'mídia').toUpperCase();
      if (isMediaEnabled) {
        mediaBadgeHtml = `<span class="badge-var-media active" title="Mídia ativada: será enviada no disparo">📷 ${FGW.escapeHtml(typeLabel)}</span>`;
      } else {
        mediaBadgeHtml = `<span class="badge-var-media paused" title="Mídia desligada: será enviado apenas o texto">⏸️ ${FGW.escapeHtml(typeLabel)} (DESLIGADA)</span>`;
      }
    }

    const previewBadgeHtml = isCurrentlyPreviewed
      ? `<span class="badge-previewing">👁️ No Preview</span>`
      : '';

    const attachBtnClass = hasMedia ? 'btn-var-media has-media' : 'btn-var-media';
    const attachBtnTitle = hasMedia ? 'Substituir mídia desta variação' : 'Anexar imagem, vídeo ou PDF a esta variação';
    const attachBtnText = hasMedia ? 'Trocar Mídia' : '+ Mídia';

    let mediaPreviewHtml = '';
    if (hasMedia) {
      const m = item.media;
      let thumbContent = '';
      let typeLabel = (m.mediatype || '').toUpperCase();

      if (m.mediatype === 'image') {
        thumbContent = `<img src="${m.dataUrl}" alt="Preview">`;
      } else if (m.mediatype === 'audio') {
        thumbContent = `<div class="var-audio-mic-thumb" title="Áudio Gravado na Hora (PTT)"><svg viewBox="0 0 24 24" width="18" height="18" fill="#25d366"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg></div>`;
        typeLabel = '🎤 ÁUDIO GRAVADO (PTT)';
      } else if (m.mediatype === 'video') {
        thumbContent = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      } else {
        thumbContent = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
             <polyline points="14 2 14 8 20 8"/>
           </svg>`;
      }

      mediaPreviewHtml = `
        <div class="variation-media-preview ${isMediaEnabled ? '' : 'is-paused'}">
          <div class="var-media-left">
            <div class="var-media-thumb">${thumbContent}</div>
            <div class="var-media-details">
              <div class="var-media-name-row">
                <span class="var-media-name" title="${FGW.escapeHtml(m.fileName)}">${FGW.escapeHtml(m.fileName)}</span>
                ${!isMediaEnabled ? '<span class="badge-paused-tag">Apenas Texto</span>' : ''}
              </div>
              <span class="var-media-size">${FGW.escapeHtml(m.fileSizeStr || '')} • ${typeLabel}</span>
            </div>
          </div>
          <div class="var-media-right-tools">
            <label class="media-toggle-switch" title="${isMediaEnabled ? 'Mídia ativada: será enviada junto com o texto. Clique para enviar apenas o texto.' : 'Mídia pausada: apenas o texto será enviado. Clique para ativar o envio da mídia.'}">
              <input type="checkbox" class="chk-toggle-media-send" data-index="${index}" ${isMediaEnabled ? 'checked' : ''}>
              <span class="media-toggle-slider"></span>
              <span class="media-toggle-label">${isMediaEnabled ? 'Enviar Mídia' : 'Apenas Texto'}</span>
            </label>
            <button type="button" class="btn-remove-var-media" data-index="${index}" title="Remover mídia desta variação">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="variation-header">
        <div class="variation-header-left">
          <span class="variation-num">Variação #${index + 1}</span>
          ${mediaBadgeHtml}
          ${previewBadgeHtml}
        </div>
        <div class="variation-actions">
          <button type="button" class="btn-var-send-now" data-index="${index}" title="Enviar esta variação agora para o grupo ativo">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
            <span>Enviar ao Grupo</span>
          </button>
          <button type="button" class="${attachBtnClass}" data-index="${index}" title="${attachBtnTitle}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            <span>${attachBtnText}</span>
          </button>
          <input type="file" class="var-file-input" data-index="${index}" accept="image/*,video/*,audio/*,.mp3,.wav,.ogg,.m4a,.aac,.opus,.pdf" style="display: none;">
          <button type="button" class="btn-delete-variation" data-index="${index}" title="Excluir esta variação">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <textarea class="variation-textarea" placeholder="Digite a mensagem ou legenda da mídia..." data-index="${index}" spellcheck="false">${FGW.escapeHtml(textValue)}</textarea>

      ${mediaPreviewHtml}
    `;

    // Clique no Card ativa o preview desta variação e foca o textarea se o clique foi no card
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('.variation-media-preview')) return;
      
      const textarea = card.querySelector('textarea');
      if (textarea && e.target !== textarea) {
        textarea.focus();
      }

      if (FGW.state.previewVariationIndex !== index) {
        FGW.state.previewVariationIndex = index;
        FGW.updateWhatsAppMobilePreview();
      }
    });

    elements.variationsList.appendChild(card);
  });

  // Função de auto-redimensionamento para textareas (mantém o texto visível ao colar)
  const autoResizeTextarea = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    const targetHeight = Math.min(Math.max(el.scrollHeight, 68), 260);
    el.style.height = targetHeight + 'px';
  };

  // Event Listeners dos Textareas (atualizam o preview em tempo real com alta performance)
  elements.variationsList.querySelectorAll('textarea').forEach(textarea => {
    // Garante que não esteja bloqueado se não estiver disparando
    textarea.disabled = Boolean(FGW.state.isDispatching);

    // Ajusta a altura inicial do campo com base no texto
    autoResizeTextarea(textarea);

    textarea.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(textarea.dataset.index, 10);
      FGW.state.lastFocusedTextarea = textarea;
      if (FGW.state.previewVariationIndex !== idx) {
        FGW.state.previewVariationIndex = idx;
        FGW.updateWhatsAppMobilePreview();
      }
    });

    textarea.addEventListener('paste', () => {
      setTimeout(() => {
        autoResizeTextarea(textarea);
      }, 0);
    });

    textarea.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      const list = FGW.getCurrentActiveVariationsList();
      if (list[idx]) {
        list[idx].text = e.target.value;
        FGW.state.previewVariationIndex = idx;

        // Auto-expande imediatamente a altura ao digitar ou colar
        autoResizeTextarea(e.target);

        // Debounce suave para evitar travamentos de I/O e DOM durante digitação rápida
        clearTimeout(textarea._saveTimeout);
        textarea._saveTimeout = setTimeout(() => {
          FGW.saveActiveVariations();
          FGW.updateVariationsBadge();
          FGW.updateWhatsAppMobilePreview();
        }, 120);
      }
    });

    textarea.addEventListener('focus', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      FGW.state.lastFocusedTextarea = e.target;
      if (FGW.state.previewVariationIndex !== idx) {
        FGW.state.previewVariationIndex = idx;
        FGW.updateWhatsAppMobilePreview();
      }
    });

    textarea.addEventListener('blur', () => {
      clearTimeout(textarea._saveTimeout);
      FGW.saveActiveVariations();
      FGW.updateVariationsBadge();
      FGW.updateWhatsAppMobilePreview();

      if (FGW.state.activeMessageScope !== '__global__') {
        if (FGW.renderGroupsTable) FGW.renderGroupsTable();
        FGW.updateVariationScopeSelectorOptions();
      }
    });
  });

  // Botões de Envio Direto da Variação para o Grupo Ativo
  elements.variationsList.querySelectorAll('.btn-var-send-now').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const targetBtn = e.target.closest('.btn-var-send-now');
      const idx = parseInt(targetBtn.dataset.index, 10);
      if (FGW.handleSendVariationToActiveGroup) {
        await FGW.handleSendVariationToActiveGroup(idx, targetBtn);
      }
    });
  });

  // Botões de Mídia (+ Mídia / Trocar Mídia)
  elements.variationsList.querySelectorAll('.btn-var-media').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.btn-var-media');
      const idx = parseInt(targetBtn.dataset.index, 10);
      FGW.state.previewVariationIndex = idx;
      const fileInput = elements.variationsList.querySelector(`.var-file-input[data-index="${idx}"]`);
      if (fileInput) fileInput.click();
    });
  });

  // Helper para geração rápida de thumbnail de imagens no padrão do WhatsApp
  if (!FGW.generateMediaThumbnail) {
    FGW.generateMediaThumbnail = function(dataUrl, mediatype) {
      return new Promise((resolve) => {
        if (!dataUrl) return resolve(null);
        try {
          if (mediatype === 'image' || String(dataUrl).startsWith('data:image/')) {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let w = img.width || 72;
              let h = img.height || 72;
              const max = 72;
              if (w > h) {
                h = Math.round((h * max) / w);
                w = max;
              } else {
                w = Math.round((w * max) / h);
                h = max;
              }
              canvas.width = Math.max(1, w);
              canvas.height = Math.max(1, h);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              const thumb = canvas.toDataURL('image/jpeg', 0.6);
              resolve(thumb);
            };
            img.onerror = () => resolve(null);
            img.src = dataUrl;
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    };
  }

  // File Inputs das Variações
  elements.variationsList.querySelectorAll('.var-file-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      let mediatype = 'document';
      if (file.type.startsWith('image/')) {
        mediatype = 'image';
      } else if (file.type.startsWith('video/')) {
        mediatype = 'video';
      } else if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|opus|wma|amr)$/i.test(file.name)) {
        mediatype = 'audio';
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const sizeFormatted = file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

        const list = FGW.getCurrentActiveVariationsList();
        if (!list[idx]) {
          list[idx] = { text: '', media: null };
        }

        const thumbnail = await FGW.generateMediaThumbnail(dataUrl, mediatype);

        list[idx].media = {
          dataUrl,
          mediatype,
          mimetype: file.type || 'application/octet-stream',
          fileName: file.name,
          fileSizeStr: sizeFormatted,
          thumbnail
        };
        list[idx].mediaEnabled = true;

        FGW.state.previewVariationIndex = idx;
        FGW.saveActiveVariations();
        FGW.renderVariations();
        FGW.updateVariationsBadge();
        FGW.updateWhatsAppMobilePreview();
        if (FGW.renderGroupsTable) FGW.renderGroupsTable();
        FGW.updateVariationScopeSelectorOptions();
        FGW.log('INFO', `Mídia anexada à Variação #${idx + 1}: "${file.name}" (${sizeFormatted}) - tipo: ${mediatype}.`, 'info');
      };

      reader.onerror = () => {
        FGW.log('ERRO', `Falha ao ler o arquivo de mídia para a Variação #${idx + 1}.`, 'error');
        alert('Erro ao carregar o arquivo de mídia.');
      };

      reader.readAsDataURL(file);
    });
  });

  // Chave Toggle: Ligar / Desligar envio da mídia por variação
  elements.variationsList.querySelectorAll('.chk-toggle-media-send').forEach(chk => {
    chk.addEventListener('change', (e) => {
      e.stopPropagation();
      const idx = parseInt(e.target.dataset.index, 10);
      const list = FGW.getCurrentActiveVariationsList();
      if (list[idx]) {
        list[idx].mediaEnabled = e.target.checked;
        FGW.saveActiveVariations();
        FGW.renderVariations();
        FGW.updateVariationsBadge();
        FGW.updateWhatsAppMobilePreview();
        if (FGW.renderGroupsTable) FGW.renderGroupsTable();
        FGW.updateVariationScopeSelectorOptions();
        FGW.log('INFO', `Variação #${idx + 1}: envio de mídia ${e.target.checked ? 'ATIVADO (irá com o texto)' : 'DESATIVADO (irá apenas o texto)'}.`, 'info');
      }
    });
  });

  // Remover Mídia da Variação
  elements.variationsList.querySelectorAll('.btn-remove-var-media').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.btn-remove-var-media');
      const idx = parseInt(targetBtn.dataset.index, 10);
      const list = FGW.getCurrentActiveVariationsList();
      if (list[idx]) {
        list[idx].media = null;
        FGW.state.previewVariationIndex = idx;
        FGW.saveActiveVariations();
        FGW.renderVariations();
        FGW.updateVariationsBadge();
        FGW.updateWhatsAppMobilePreview();
        if (FGW.renderGroupsTable) FGW.renderGroupsTable();
        FGW.updateVariationScopeSelectorOptions();
        FGW.log('INFO', `Mídia removida da Variação #${idx + 1}.`, 'info');
      }
    });
  });

  // Excluir a Variação Completa
  elements.variationsList.querySelectorAll('.btn-delete-variation').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.btn-delete-variation');
      const idx = parseInt(targetBtn.dataset.index, 10);
      const list = FGW.getCurrentActiveVariationsList();
      list.splice(idx, 1);
      if (FGW.state.previewVariationIndex >= list.length) {
        FGW.state.previewVariationIndex = Math.max(0, list.length - 1);
      }
      FGW.saveActiveVariations();
      FGW.renderVariations();
      FGW.updateVariationsBadge();
      FGW.updateWhatsAppMobilePreview();
      if (FGW.renderGroupsTable) FGW.renderGroupsTable();
      FGW.updateVariationScopeSelectorOptions();
    });
  });

  // Atualiza o Mockup do WhatsApp Mobile
  FGW.updateWhatsAppMobilePreview();
};

FGW.handleAddVariation = function() {
  const list = FGW.getCurrentActiveVariationsList();
  list.push({ text: '', media: null, mediaEnabled: true });
  FGW.state.previewVariationIndex = list.length - 1;

  if (FGW.state.activeMessageScope !== '__global__') {
    if (!FGW.state.groupCustomVariations[FGW.state.activeMessageScope]) {
      FGW.state.groupCustomVariations[FGW.state.activeMessageScope] = { enabled: true, variations: list };
    }
    FGW.state.groupCustomVariations[FGW.state.activeMessageScope].enabled = true;
    if (FGW.elements && FGW.elements.chkEnableGroupCustomVars) FGW.elements.chkEnableGroupCustomVars.checked = true;
  }

  FGW.saveActiveVariations();
  FGW.renderVariations();
  FGW.updateVariationsBadge();
  FGW.updateWhatsAppMobilePreview();
  if (FGW.renderGroupsTable) FGW.renderGroupsTable();
  FGW.updateVariationScopeSelectorOptions();

  const allTextareas = FGW.elements ? FGW.elements.variationsList.querySelectorAll('textarea') : [];
  if (allTextareas.length > 0) {
    allTextareas[allTextareas.length - 1].focus();
  }
};

FGW.getValidVariations = function() {
  return FGW.state.messageVariations.filter(v => {
    if (!v) return false;
    const hasText = (v.text || '').trim().length > 0;
    const hasActiveMedia = !!(v.media && v.media.dataUrl && v.mediaEnabled !== false);
    return hasText || hasActiveMedia;
  });
};

FGW.updateVariationsBadge = function() {
  const elements = FGW.elements || {};
  const isGroupScope = FGW.state.activeMessageScope !== '__global__';
  const globalValidCount = FGW.getValidVariations().length;

  if (!isGroupScope) {
    if (elements.variationsCountBadge) {
      if (globalValidCount < 3) {
        elements.variationsCountBadge.className = 'count-badge warning';
        elements.variationsCountBadge.textContent = `${globalValidCount} / mín. 3 (Gerais)`;
      } else {
        elements.variationsCountBadge.className = 'count-badge success';
        elements.variationsCountBadge.textContent = `${globalValidCount} cadastradas (Gerais)`;
      }
    }
  } else {
    const customConfig = FGW.state.groupCustomVariations[FGW.state.activeMessageScope];
    const isCustomActive = customConfig && customConfig.enabled;
    const list = FGW.getCurrentActiveVariationsList();
    const groupValidCount = list.filter(v => {
      if (!v) return false;
      const hasText = (v.text || '').trim().length > 0;
      const hasActiveMedia = !!(v.media && v.media.dataUrl && v.mediaEnabled !== false);
      return hasText || hasActiveMedia;
    }).length;

    if (elements.variationsCountBadge) {
      if (!isCustomActive) {
        elements.variationsCountBadge.className = 'count-badge';
        elements.variationsCountBadge.textContent = 'Padrão Geral (Herdando)';
      } else {
        elements.variationsCountBadge.className = 'count-badge success';
        elements.variationsCountBadge.textContent = `${groupValidCount} exclusiva(s) ativa(s)`;
      }
    }
  }

  if (elements.stepVariationsSub) {
    elements.stepVariationsSub.textContent = `${globalValidCount} variações gerais`;
  }
  if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
};

FGW.state.realMessages = FGW.state.realMessages || {};

/**
 * Adiciona uma mensagem ao histórico do grupo e persiste no localStorage
 */
FGW.addRealChatMessage = function(groupId, msg) {
  if (!groupId || !msg) return;
  FGW.state.realMessages = FGW.state.realMessages || {};
  FGW.state.realMessages[groupId] = FGW.state.realMessages[groupId] || [];

  const existingIdx = FGW.state.realMessages[groupId].findIndex(m => m.id === msg.id);
  if (existingIdx >= 0) {
    FGW.state.realMessages[groupId][existingIdx] = { ...FGW.state.realMessages[groupId][existingIdx], ...msg };
  } else {
    // Evita duplicar se já existir mensagem com mesmo texto/mídia, mesmo remetente e timestamp próximo (< 90s)
    const duplicateIdx = FGW.state.realMessages[groupId].findIndex(m => {
      const sameText = (m.text || '').trim() === (msg.text || '').trim();
      const sameMedia = Boolean(m.mediaType) && m.mediaType === msg.mediaType;
      const sameFromMe = Boolean(m.fromMe) === Boolean(msg.fromMe);
      const timeDiff = Math.abs((m.timestamp || 0) - (msg.timestamp || 0));
      return (sameText || sameMedia) && sameFromMe && timeDiff < 90000;
    });

    if (duplicateIdx >= 0) {
      // Atualiza com dados oficiais em vez de duplicar
      FGW.state.realMessages[groupId][duplicateIdx] = { ...FGW.state.realMessages[groupId][duplicateIdx], ...msg };
    } else {
      FGW.state.realMessages[groupId].push(msg);
    }
  }

  // Deduplicação geral de segurança (preserva mensagens de texto OU de mídia/áudio)
  const cleanList = [];
  const seenKeys = new Set();
  FGW.state.realMessages[groupId].forEach(m => {
    if (!m) return;
    if (!m.text && !m.mediaType) return;
    const textKey = m.text ? m.text.trim() : (m.mediaType + '_' + (m.mediaDetails?.fileName || m.id || 'media'));
    const key = m.id ? m.id : `${m.fromMe ? 'out' : 'in'}_${textKey}_${Math.floor((m.timestamp || 0) / 45000)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    cleanList.push(m);
  });

  // Ordena por timestamp cronológico
  cleanList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  FGW.state.realMessages[groupId] = cleanList;

  // Persiste no localStorage permanentemente
  if (FGW.saveRealMessages) FGW.saveRealMessages();

  // Se o grupo está em foco no chat, atualiza a interface imediatamente
  const currentFocused = FGW.state.currentChatGroupId || (FGW.elements?.chatTargetGroupSelect?.value);
  if (currentFocused === groupId) {
    FGW.renderRealMessages(FGW.state.realMessages[groupId], groupId);
  }
};
window.addRealChatMessage = FGW.addRealChatMessage;

/**
 * Busca histórico real de mensagens do grupo via Evolution API
 * @param {string} targetGroupId
 * @param {boolean} isSilent - Se true, não substitui o conteúdo por "Carregando..." para auto-refresh contínuo
 */
FGW.loadRealChatMessages = async function(targetGroupId, isSilent = false) {
  const elements = FGW.elements || {};
  if (!elements.realChatMessagesList) return;

  const isConnected = FGW.state.connectionStatus === 'connected' ||
    (elements.connectionStatusBadge && elements.connectionStatusBadge.classList.contains('connected')) ||
    (elements.chatConnectedState && !elements.chatConnectedState.classList.contains('hidden'));

  // Se o WhatsApp não estiver conectado, apenas renderiza o histórico local salvo
  let groupId = targetGroupId || FGW.state.currentChatGroupId || (elements.chatTargetGroupSelect ? elements.chatTargetGroupSelect.value : null);
  if (!groupId || groupId === '__preview_default__') {
    const selectedGroups = (FGW.state.groups || []).filter(g => FGW.state.selectedGroupIds.has(g.id));
    if (selectedGroups.length > 0) {
      groupId = selectedGroups[0].id;
      if (elements.chatTargetGroupSelect) {
        elements.chatTargetGroupSelect.value = groupId;
      }
    } else {
      elements.realChatMessagesList.innerHTML = `
        <div class="wa-real-msg-empty">
          <p>Nenhum grupo selecionado.</p>
          <span style="font-size: 0.72rem; color: #8696a0;">Selecione um ou mais grupos na coluna da esquerda para inspecionar e interagir com o chat.</span>
        </div>
      `;
      return;
    }
  }

  // Renderiza imediatamente as mensagens locais do cache (com deduplicação em memória)
  const cachedMessages = FGW.state.realMessages[groupId] || [];
  if (cachedMessages.length > 0) {
    FGW.renderRealMessages(cachedMessages, groupId);
  } else if (!isSilent) {
    elements.realChatMessagesList.innerHTML = `
      <div class="wa-real-msg-empty">
        <p>Carregando histórico de mensagens...</p>
      </div>
    `;
  }

  if (!isConnected) {
    return;
  }

  const instanceName = FGW.getActiveInstanceName ? FGW.getActiveInstanceName() : (FGW.state.activeInstanceName || '');
  if (!instanceName) {
    return;
  }

  try {
    const res = await window.electronAPI.fetchChatMessages({
      instanceName,
      remoteJid: groupId,
      limit: 50
    });

    if (res && res.success && Array.isArray(res.data)) {
      // Mescla mensagens da API com mensagens salvas localmente
      const localList = FGW.state.realMessages[groupId] || [];
      const msgMap = new Map();

      // Adiciona mensagens locais ao mapa
      localList.forEach(m => {
        if (m && m.id) msgMap.set(m.id, m);
      });

      // Mescla com as mensagens reais retornadas pelo WhatsApp
      res.data.forEach(apiMsg => {
        if (!apiMsg || !apiMsg.id) return;

        // Se existir alguma mensagem temporária local_/campaign_/var_ com mesmo remetente e timestamp próximo
        for (const [id, localMsg] of msgMap.entries()) {
          const isTemp = String(id).startsWith('local_') || String(id).startsWith('campaign_') || String(id).startsWith('var_direct_') || String(id).startsWith('text_');
          if (isTemp && Boolean(localMsg.fromMe) === Boolean(apiMsg.fromMe)) {
            const sameText = (localMsg.text || '').trim() === (apiMsg.text || '').trim();
            const sameMedia = Boolean(localMsg.mediaType) && localMsg.mediaType === apiMsg.mediaType;
            if ((sameText || sameMedia) && Math.abs((localMsg.timestamp || 0) - (apiMsg.timestamp || 0)) < 90000) {
              if (localMsg.audioSrc && !apiMsg.audioSrc) {
                apiMsg.audioSrc = localMsg.audioSrc;
              }
              msgMap.delete(id);
            }
          }
        }

        // Se já tínhamos o audioSrc local nesta mesma mensagem pelo ID, preserva
        const existingLocal = msgMap.get(apiMsg.id);
        if (existingLocal && existingLocal.audioSrc && !apiMsg.audioSrc) {
          apiMsg.audioSrc = existingLocal.audioSrc;
        }

        msgMap.set(apiMsg.id, apiMsg);
      });

      // Deduplicação final por chave de conteúdo (mantém texto OU mídia/áudio)
      const merged = Array.from(msgMap.values());
      const cleanMerged = [];
      const seenMerged = new Set();
      
      merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      merged.forEach(m => {
        if (!m) return;
        if (!m.text && !m.mediaType) return;
        const textKey = m.text ? m.text.trim() : (m.mediaType + '_' + (m.mediaDetails?.fileName || m.id || 'media'));
        const k = m.id ? m.id : `${m.fromMe ? 'out' : 'in'}_${textKey}_${Math.floor((m.timestamp || 0) / 45000)}`;
        if (seenMerged.has(k)) return;
        seenMerged.add(k);
        cleanMerged.push(m);
      });

      FGW.state.realMessages[groupId] = cleanMerged;

      // Salva no localStorage permanentemente
      if (FGW.saveRealMessages) FGW.saveRealMessages();

      // Atualiza interface se ainda for o grupo em foco
      const currentFocused = FGW.state.currentChatGroupId || (elements.chatTargetGroupSelect ? elements.chatTargetGroupSelect.value : null);
      if (currentFocused === groupId) {
        FGW.renderRealMessages(cleanMerged, groupId);
      }
    } else {
      FGW.renderRealMessages(FGW.state.realMessages[groupId] || [], groupId);
    }
  } catch (err) {
    console.warn('Erro ao carregar mensagens reais do chat:', err);
    FGW.renderRealMessages(FGW.state.realMessages[groupId] || [], groupId);
  }
};

// Polling contínuo em segundo plano para atualizar o chat aberto (a cada 7s)
if (!FGW._chatPollingInterval) {
  FGW._chatPollingInterval = setInterval(() => {
    const isConnected = FGW.state.connectionStatus === 'connected' ||
      (document.getElementById('connectionStatusBadge')?.classList.contains('connected'));
    const activeGroup = FGW.state.currentChatGroupId || (document.getElementById('chatTargetGroupSelect')?.value);
    if (isConnected && activeGroup && activeGroup !== '__preview_default__' && !FGW.state.isDispatching) {
      FGW.loadRealChatMessages(activeGroup, true);
    }
  }, 7000);
}

/**
 * Renderiza a lista de mensagens reais no chat
 */
FGW.formatDuration = function(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
};

/**
 * Renderiza a lista de mensagens reais no chat com suporte a mídias visuais e audíveis
 */
FGW.renderRealMessages = function(messages, groupId) {
  const elements = FGW.elements || {};
  const container = elements.realChatMessagesList;
  if (!container) return;

  // Garante que os listeners de clique de mídia estejam ativos
  FGW.initChatMediaInteractions();

  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="wa-real-msg-empty">
        <p>💬 Nenhuma mensagem gravada neste grupo.</p>
        <span style="font-size: 0.72rem; color: #8696a0;">Você pode enviar mensagens em tempo real usando o campo de envio abaixo.</span>
      </div>
    `;
    return;
  }

  let html = '';
  messages.forEach(msg => {
    const isOut = Boolean(msg.fromMe);
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const bubbleClass = isOut ? 'outgoing' : 'incoming';
    const sender = isOut ? '' : `<div class="wa-bubble-sender">${FGW.escapeHtml(msg.pushName || 'Participante')}</div>`;
    const checkIcon = isOut ? `
      <span class="wa-ticks-blue" title="Mensagem entregue">
        <svg viewBox="0 0 16 11" width="14" height="11" fill="none">
          <path d="M11.05 1L5.5 6.55L2.95 4L2 4.95L5.5 8.45L12 2L11.05 1Z" fill="#53bdeb"/>
          <path d="M14.55 1L9 6.55L8.05 5.6L7.1 6.55L9 8.45L15.5 2L14.55 1Z" fill="#53bdeb"/>
        </svg>
      </span>
    ` : '';

    let mediaHtml = '';
    const mType = msg.mediaType;
    const mDet = msg.mediaDetails || {};

    if (mType === 'image') {
      const initialSrc = mDet.jpegThumbnail || '';
      mediaHtml = `
        <div class="wa-chat-img-box ${initialSrc ? '' : 'loading-media'}" data-msg-id="${msg.id}" title="Clique para ampliar a foto">
          <img class="wa-chat-media-img" src="${initialSrc || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'240\' height=\'160\' fill=\'%23111b21\'></svg>'}" alt="Foto" loading="lazy" />
          <div class="wa-chat-media-loading-overlay">
            <div class="spinner-media"></div>
            <span>Carregando foto...</span>
          </div>
        </div>
      `;
    } else if (mType === 'audio') {
      const durationStr = FGW.formatDuration(mDet.seconds);
      const audioSrcAttr = msg.audioSrc ? `data-audio-src="${FGW.escapeHtml(msg.audioSrc)}"` : '';
      mediaHtml = `
        <div class="wa-chat-audio-player wa-media-audio-ptt" data-msg-id="${msg.id}" data-seconds="${mDet.seconds || 0}" ${audioSrcAttr}>
          <div class="wa-ptt-controls-row">
            <button type="button" class="btn-chat-audio-play wa-ptt-play-btn" title="Ouvir áudio">
              <svg class="icon-play" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <svg class="icon-pause hidden" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              <div class="audio-btn-spinner hidden"></div>
            </button>
            <div class="wa-ptt-waveform">
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="wa-ptt-mic-tag">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#25d366"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>
            </div>
          </div>
          <div class="wa-ptt-footer-info">
            <span class="audio-time-label">${durationStr || '0:00'}</span>
            <span class="wa-ptt-filename">${FGW.escapeHtml(mDet.fileName || 'Mensagem de voz')}</span>
            <span class="wa-ptt-label-tag">${mDet.ptt ? 'Voz' : 'Áudio'}</span>
          </div>
        </div>
      `;
    } else if (mType === 'video') {
      const durationStr = mDet.seconds ? FGW.formatDuration(mDet.seconds) : '';
      mediaHtml = `
        <div class="wa-chat-video-box" data-msg-id="${msg.id}" title="Clique para assistir o vídeo">
          <div class="wa-chat-video-placeholder">
            <div class="video-play-btn-circle">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
            <span class="video-tag">🎥 Vídeo ${durationStr ? `(${durationStr})` : ''}</span>
          </div>
        </div>
      `;
    } else if (mType === 'document') {
      const fn = mDet.fileName || msg.text || 'Documento';
      mediaHtml = `
        <div class="wa-chat-doc-box" data-msg-id="${msg.id}" title="Clique para abrir ou baixar">
          <div class="doc-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div class="doc-details">
            <span class="doc-filename">${FGW.escapeHtml(fn)}</span>
            <span class="doc-action-hint">Abrir arquivo</span>
          </div>
        </div>
      `;
    }

    const textHtml = (msg.text && msg.text.trim()) ? `<div class="wa-bubble-text">${FGW.formatWhatsAppPreviewText(msg.text)}</div>` : '';

    html += `
      <div class="wa-bubble-wrapper ${bubbleClass}">
        <div class="wa-real-bubble ${mType ? 'has-media media-' + mType : ''}">
          ${sender}
          ${mediaHtml}
          ${textHtml}
          <div class="wa-bubble-footer-mini">
            <span>${timeStr}</span>
            ${checkIcon}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Carrega automaticamente as fotos exibidas no chat
  FGW.autoLoadChatImages(container);

  // Rola o chat suavemente até a base
  if (elements.whatsappChatBody) {
    setTimeout(() => {
      elements.whatsappChatBody.scrollTop = elements.whatsappChatBody.scrollHeight;
    }, 50);
  }
};

/**
 * Carrega fotos em background para visualização imediata no chat
 */
FGW.autoLoadChatImages = function(container) {
  if (!container) return;
  const imageBoxes = container.querySelectorAll('.wa-chat-img-box:not(.loaded)');
  if (imageBoxes.length === 0) return;

  const instanceName = FGW.getActiveInstanceName ? FGW.getActiveInstanceName() : (FGW.state.activeInstanceName || '');
  if (!instanceName) return;

  imageBoxes.forEach(async (box) => {
    const msgId = box.dataset.msgId;
    if (!msgId) return;

    try {
      const res = await window.electronAPI.getMediaBase64({ instanceName, messageId: msgId });
      box.classList.remove('loading-media');
      if (res && res.success && res.base64) {
        const img = box.querySelector('img');
        if (img) {
          img.src = res.base64;
          box.classList.add('loaded');
        }
      }
    } catch (e) {
      box.classList.remove('loading-media');
    }
  });
};

/**
 * Gerenciador de Áudio Ativo no Chat
 */
FGW.activeAudio = null;
FGW.activeAudioWrap = null;

FGW.handlePlayChatAudio = async function(msgId, playerWrap) {
  const playBtn = playerWrap.querySelector('.btn-chat-audio-play');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconPause = playBtn?.querySelector('.icon-pause');
  const spinner = playBtn?.querySelector('.audio-btn-spinner');
  const timeLabel = playerWrap.querySelector('.audio-time-label');
  const barFill = playerWrap.querySelector('.audio-progress-fill');

  // Se já está tocando ESTE áudio: alterna pause/play
  if (FGW.activeAudio && FGW.activeAudioWrap === playerWrap) {
    if (!FGW.activeAudio.paused) {
      FGW.activeAudio.pause();
      iconPlay?.classList.remove('hidden');
      iconPause?.classList.add('hidden');
      playerWrap.classList.remove('is-playing');
    } else {
      FGW.activeAudio.play();
      iconPlay?.classList.add('hidden');
      iconPause?.classList.remove('hidden');
      playerWrap.classList.add('is-playing');
    }
    return;
  }

  // Se outro áudio estiver tocando, para ele
  if (FGW.activeAudio) {
    FGW.activeAudio.pause();
    if (FGW.activeAudioWrap) {
      FGW.activeAudioWrap.classList.remove('is-playing');
      const prevPlay = FGW.activeAudioWrap.querySelector('.icon-play');
      const prevPause = FGW.activeAudioWrap.querySelector('.icon-pause');
      prevPlay?.classList.remove('hidden');
      prevPause?.classList.add('hidden');
    }
    FGW.activeAudio = null;
    FGW.activeAudioWrap = null;
  }

  // Busca o base64 se ainda não tiver no elemento
  let audioDataUrl = playerWrap.dataset.audioSrc;
  if (!audioDataUrl) {
    iconPlay?.classList.add('hidden');
    spinner?.classList.remove('hidden');

    const instanceName = FGW.getActiveInstanceName ? FGW.getActiveInstanceName() : (FGW.state.activeInstanceName || '');
    if (!instanceName) {
      spinner?.classList.add('hidden');
      iconPlay?.classList.remove('hidden');
      alert('Conecte o WhatsApp para reproduzir áudios.');
      return;
    }

    try {
      const res = await window.electronAPI.getMediaBase64({ instanceName, messageId: msgId });
      spinner?.classList.add('hidden');
      iconPlay?.classList.remove('hidden');

      if (res && res.success && res.base64) {
        audioDataUrl = res.base64;
        playerWrap.dataset.audioSrc = audioDataUrl;
      } else {
        alert('Não foi possível carregar o áudio.');
        return;
      }
    } catch (err) {
      spinner?.classList.add('hidden');
      iconPlay?.classList.remove('hidden');
      alert('Erro ao baixar áudio: ' + err.message);
      return;
    }
  }

  // Cria e toca o áudio
  const audio = new Audio(audioDataUrl);
  FGW.activeAudio = audio;
  FGW.activeAudioWrap = playerWrap;

  iconPlay?.classList.add('hidden');
  iconPause?.classList.remove('hidden');
  playerWrap.classList.add('is-playing');

  audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isNaN(audio.duration)) {
      const pct = (audio.currentTime / audio.duration) * 100;
      if (barFill) barFill.style.width = `${pct}%`;
      if (timeLabel) timeLabel.textContent = FGW.formatDuration(audio.currentTime);
    }
  });

  audio.addEventListener('ended', () => {
    iconPlay?.classList.remove('hidden');
    iconPause?.classList.add('hidden');
    playerWrap.classList.remove('is-playing');
    if (barFill) barFill.style.width = '0%';
    const origSec = Number(playerWrap.dataset.seconds) || 0;
    if (timeLabel) timeLabel.textContent = FGW.formatDuration(origSec);
    FGW.activeAudio = null;
    FGW.activeAudioWrap = null;
  });

  audio.play().catch(e => {
    console.warn('Erro ao reproduzir áudio:', e);
    iconPlay?.classList.remove('hidden');
    iconPause?.classList.add('hidden');
    playerWrap.classList.remove('is-playing');
  });
};

/**
 * Abre modal de visualização de foto ou vídeo
 */
FGW.openMediaPreviewModal = function(mediaSrc, type, title) {
  const modal = document.getElementById('mediaPreviewModal');
  const titleElem = document.getElementById('mediaPreviewTitle');
  const contentElem = document.getElementById('mediaPreviewContent');
  if (!modal || !contentElem) return;

  if (titleElem) titleElem.textContent = title || 'Visualização';

  if (type === 'image') {
    contentElem.innerHTML = `
      <div class="lightbox-image-wrap">
        <img src="${mediaSrc}" alt="Foto" class="lightbox-img" />
      </div>
    `;
  } else if (type === 'video') {
    contentElem.innerHTML = `
      <div class="lightbox-video-wrap">
        <video controls autoplay src="${mediaSrc}" class="lightbox-video"></video>
      </div>
    `;
  }

  modal.classList.remove('hidden');
};

/**
 * Inicializa os ouvintes de clique interativos de mídias no chat
 */
FGW.initChatMediaInteractions = function() {
  const elements = FGW.elements || {};
  const container = elements.realChatMessagesList;
  if (!container || container._mediaInited) return;
  container._mediaInited = true;

  // Fechamento do modal de mídia
  const modal = document.getElementById('mediaPreviewModal');
  const closeBtn = document.getElementById('btnCloseMediaPreview');
  if (closeBtn && !closeBtn._inited) {
    closeBtn._inited = true;
    closeBtn.addEventListener('click', () => modal?.classList.add('hidden'));
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  container.addEventListener('click', async (e) => {
    // 1. Áudio (Play / Pause)
    const audioBtn = e.target.closest('.btn-chat-audio-play');
    if (audioBtn) {
      e.stopPropagation();
      const playerWrap = audioBtn.closest('.wa-chat-audio-player');
      const msgId = playerWrap?.dataset.msgId;
      if (msgId) {
        FGW.handlePlayChatAudio(msgId, playerWrap);
      }
      return;
    }

    // 2. Clique em Foto -> Ampliar no Modal
    const imgBox = e.target.closest('.wa-chat-img-box');
    if (imgBox) {
      const img = imgBox.querySelector('img');
      const msgId = imgBox.dataset.msgId;
      if (img && img.src && !img.src.startsWith('data:image/svg')) {
        FGW.openMediaPreviewModal(img.src, 'image', 'Visualização de Imagem');
      } else if (msgId) {
        imgBox.classList.add('loading-media');
        const instanceName = FGW.getActiveInstanceName ? FGW.getActiveInstanceName() : (FGW.state.activeInstanceName || '');
        if (!instanceName) {
          imgBox.classList.remove('loading-media');
          alert('Conecte o WhatsApp para visualizar mídias.');
          return;
        }
        const res = await window.electronAPI.getMediaBase64({ instanceName, messageId: msgId });
        imgBox.classList.remove('loading-media');
        if (res && res.success && res.base64) {
          if (img) img.src = res.base64;
          FGW.openMediaPreviewModal(res.base64, 'image', 'Visualização de Imagem');
        }
      }
      return;
    }

    // 3. Clique em Vídeo -> Reproduzir direto no balão
    const videoBox = e.target.closest('.wa-chat-video-box');
    if (videoBox) {
      const msgId = videoBox.dataset.msgId;
      if (msgId && !videoBox.querySelector('video')) {
        videoBox.innerHTML = `
          <div class="video-loading-box">
            <div class="spinner-media"></div>
            <span>Carregando vídeo...</span>
          </div>
        `;
        const instanceName = FGW.getActiveInstanceName ? FGW.getActiveInstanceName() : (FGW.state.activeInstanceName || '');
        if (!instanceName) {
          videoBox.innerHTML = `<div class="video-error-box"><span>⚠️ Conecte o WhatsApp para ver este vídeo.</span></div>`;
          return;
        }
        const res = await window.electronAPI.getMediaBase64({ instanceName, messageId: msgId });
        if (res && res.success && res.base64) {
          videoBox.innerHTML = `
            <video controls autoplay class="wa-chat-real-video" src="${res.base64}"></video>
          `;
        } else {
          videoBox.innerHTML = `
            <div class="video-error-box">
              <span>⚠️ Não foi possível reproduzir este vídeo.</span>
            </div>
          `;
        }
      }
      return;
    }

    // 4. Clique em Documento
    const docBox = e.target.closest('.wa-chat-doc-box');
    if (docBox) {
      const msgId = docBox.dataset.msgId;
      if (msgId) {
        docBox.classList.add('loading');
        const instanceName = FGW.getActiveInstanceName ? FGW.getActiveInstanceName() : (FGW.state.activeInstanceName || '');
        if (!instanceName) {
          docBox.classList.remove('loading');
          alert('Conecte o WhatsApp para abrir este documento.');
          return;
        }
        const res = await window.electronAPI.getMediaBase64({ instanceName, messageId: msgId });
        docBox.classList.remove('loading');
        if (res && res.success && res.base64) {
          if (res.mimetype?.startsWith('image/')) {
            FGW.openMediaPreviewModal(res.base64, 'image', res.fileName || 'Imagem');
          } else if (res.mimetype?.startsWith('video/')) {
            FGW.openMediaPreviewModal(res.base64, 'video', res.fileName || 'Vídeo');
          } else {
            const a = document.createElement('a');
            a.href = res.base64;
            a.download = res.fileName || 'documento';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }
      }
      return;
    }
  });
};

/**
 * Envia uma mensagem real direta digitada no chat
 */
FGW.handleSendRealChatMessage = async function() {
  const elements = FGW.elements || {};
  if (!elements.chatComposerInput) return;

  if (FGW._isSendingRealMessage) return;

  const text = elements.chatComposerInput.value.trim();
  if (!text) {
    elements.chatComposerInput.focus();
    return;
  }

  const isConnected = FGW.state.connectionStatus === 'connected' ||
    (elements.connectionStatusBadge && elements.connectionStatusBadge.classList.contains('connected')) ||
    (elements.chatConnectedState && !elements.chatConnectedState.classList.contains('hidden'));

  const instanceName = FGW.getActiveInstanceName ? FGW.getActiveInstanceName() : (FGW.state.activeInstanceName || '');

  if (!isConnected || !instanceName) {
    alert('Conecte o WhatsApp para enviar mensagens reais.');
    return;
  }

  let groupId = (elements.chatTargetGroupSelect && elements.chatTargetGroupSelect.value !== '__preview_default__' && elements.chatTargetGroupSelect.value)
    || FGW.state.currentChatGroupId;

  if (!groupId || groupId === '__preview_default__') {
    const selectedGroups = (FGW.state.groups || []).filter(g => FGW.state.selectedGroupIds.has(g.id));
    if (selectedGroups.length > 0) {
      groupId = selectedGroups[0].id;
    } else if (FGW.state.groups && FGW.state.groups.length > 0) {
      groupId = FGW.state.groups[0].id;
    } else {
      alert('Nenhum grupo disponível para receber mensagens. Por favor, marque ou selecione um grupo na tabela.');
      return;
    }
  }

  // Identifica o nome do grupo para confirmação e feedback claro
  const targetGroup = (FGW.state.groups || []).find(g => g.id === groupId);
  const targetName = targetGroup ? (targetGroup.subject || targetGroup.name) : groupId;

  // Feedback visual no botão de envio
  const btn = elements.btnSendRealChatMessage;
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.6';
  }
  FGW._isSendingRealMessage = true;

  try {
    FGW.log('INFO', `Enviando mensagem direta para o grupo "${targetName}" (${groupId})...`, 'info');
    const result = await window.electronAPI.sendMessage({
      instanceName,
      number: groupId,
      text,
      delay: 500
    });

    if (result && result.success) {
      // Extrai o ID real da mensagem gerado pelo WhatsApp/Baileys
      const realMsgId = result.data?.key?.id || result.data?.id || ('local_' + Date.now());

      // Adiciona mensagem ao histórico com ID oficial e persiste
      FGW.addRealChatMessage(groupId, {
        id: realMsgId,
        fromMe: true,
        pushName: 'Você',
        text,
        timestamp: Date.now(),
        status: 'SENT'
      });

      elements.chatComposerInput.value = '';
      FGW.log('SUCESSO', `Mensagem enviada com sucesso para "${targetName}"!`, 'success');
    } else {
      const err = result?.error || 'Erro desconhecido ao enviar mensagem.';
      FGW.log('ERRO', `Falha ao enviar mensagem direta para "${targetName}": ${err}`, 'error');
      alert(`Falha no envio da mensagem para "${targetName}":\n${err}`);
    }
  } catch (err) {
    FGW.log('ERRO', `Erro inesperado no envio para "${targetName}": ${err.message}`, 'error');
    alert(`Erro ao enviar mensagem:\n${err.message}`);
  } finally {
    FGW._isSendingRealMessage = false;
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
    if (elements.chatComposerInput) {
      elements.chatComposerInput.focus();
    }
  }
};

/**
 * Envia uma variação específica diretamente para o grupo ativo no momento
 */
FGW.handleSendVariationToActiveGroup = async function(variationIndex, btnElement) {
  const elements = FGW.elements || {};
  const activeList = FGW.getCurrentActiveVariationsList();
  const item = activeList[variationIndex];
  if (!item) return;

  const isConnected = FGW.state.connectionStatus === 'connected' ||
    (elements.connectionStatusBadge && elements.connectionStatusBadge.classList.contains('connected')) ||
    (elements.chatConnectedState && !elements.chatConnectedState.classList.contains('hidden'));

  const instanceName = (elements.instanceName && elements.instanceName.value.trim())
    || FGW.state.activeInstanceName
    || localStorage.getItem(FGW.STORAGE_KEYS?.INSTANCE_NAME);

  if (!isConnected || !instanceName) {
    alert('Conecte o WhatsApp para enviar esta variação.');
    return;
  }

  // Identifica o grupo ativo
  let groupId = FGW.state.currentChatGroupId ||
    (elements.chatTargetGroupSelect && elements.chatTargetGroupSelect.value !== '__preview_default__' && elements.chatTargetGroupSelect.value);

  if (!groupId || groupId === '__preview_default__') {
    const selectedGroups = (FGW.state.groups || []).filter(g => FGW.state.selectedGroupIds.has(g.id));
    if (selectedGroups.length > 0) {
      groupId = selectedGroups[0].id;
    } else if (FGW.state.groups && FGW.state.groups.length > 0) {
      groupId = FGW.state.groups[0].id;
    } else {
      alert('Nenhum grupo ativo disponível. Selecione um grupo na tabela de grupos.');
      return;
    }
  }

  const targetGroup = (FGW.state.groups || []).find(g => g.id === groupId) || { id: groupId, subject: 'Grupo Ativo' };
  const targetName = targetGroup.subject || targetGroup.name || groupId;

  const rawText = item.text || '';
  const processedText = FGW.applyDynamicTags ? FGW.applyDynamicTags(rawText, targetGroup) : rawText;
  const hasActiveMedia = Boolean(item.media && item.media.dataUrl && item.mediaEnabled !== false);

  if (btnElement) {
    btnElement.disabled = true;
    btnElement.style.opacity = '0.6';
  }

  try {
    FGW.log('INFO', `Enviando Variação #${variationIndex + 1} para o grupo ativo "${targetName}"...`, 'info');

    let result;
    if (hasActiveMedia) {
      const mediaThumb = item.media.thumbnail || (typeof FGW.generateMediaThumbnail === 'function' ? await FGW.generateMediaThumbnail(item.media.dataUrl, item.media.mediatype) : null);
      result = await window.electronAPI.sendMediaMessage({
        instanceName,
        number: groupId,
        media: item.media.dataUrl,
        mediatype: item.media.mediatype,
        mimetype: item.media.mimetype,
        fileName: item.media.fileName,
        caption: processedText,
        thumbnail: mediaThumb,
        delay: 500
      });
    } else {
      result = await window.electronAPI.sendMessage({
        instanceName,
        number: groupId,
        text: processedText,
        delay: 500
      });
    }

    if (result && result.success) {
      const realMsgId = result.data?.key?.id || ('var_direct_' + Date.now());
      const hasAudio = hasActiveMedia && item.media?.mediatype === 'audio';

      if (hasAudio) {
        // Registra o áudio com player interativo
        FGW.addRealChatMessage(groupId, {
          id: realMsgId,
          fromMe: true,
          pushName: 'Você (Variação)',
          text: '',
          mediaType: 'audio',
          mediaDetails: {
            fileName: item.media.fileName,
            mimetype: item.media.mimetype,
            seconds: 0,
            ptt: true
          },
          audioSrc: item.media.dataUrl,
          timestamp: Date.now(),
          status: 'SENT'
        });

        // Se houver texto complementar associado à variação
        if (processedText && processedText.trim()) {
          FGW.addRealChatMessage(groupId, {
            id: 'text_' + realMsgId,
            fromMe: true,
            pushName: 'Você (Variação)',
            text: processedText,
            timestamp: Date.now() + 10,
            status: 'SENT'
          });
        }
      } else if (hasActiveMedia) {
        // Imagem, Vídeo ou Documento
        FGW.addRealChatMessage(groupId, {
          id: realMsgId,
          fromMe: true,
          pushName: 'Você (Variação)',
          text: processedText || '',
          mediaType: item.media.mediatype,
          mediaDetails: {
            fileName: item.media.fileName,
            mimetype: item.media.mimetype,
            jpegThumbnail: item.media.mediatype === 'image' ? item.media.dataUrl : null
          },
          timestamp: Date.now(),
          status: 'SENT'
        });
      } else {
        // Texto Puro
        FGW.addRealChatMessage(groupId, {
          id: realMsgId,
          fromMe: true,
          pushName: 'Você (Variação)',
          text: processedText,
          timestamp: Date.now(),
          status: 'SENT'
        });
      }

      FGW.log('SUCESSO', `Variação #${variationIndex + 1} enviada com sucesso para o grupo "${targetName}"!`, 'success');
      if (btnElement) {
        btnElement.classList.add('is-sent-success');
        const origHtml = btnElement.innerHTML;
        btnElement.innerHTML = `<span>✓ Enviado!</span>`;
        setTimeout(() => {
          btnElement.classList.remove('is-sent-success');
          btnElement.innerHTML = origHtml;
        }, 2200);
      }
    } else {
      const err = result?.error || 'Erro desconhecido ao enviar variação.';
      FGW.log('ERRO', `Falha ao enviar Variação #${variationIndex + 1}: ${err}`, 'error');
      alert(`Falha no envio para "${targetName}":\n${err}`);
    }
  } catch (err) {
    FGW.log('ERRO', `Erro inesperado: ${err.message}`, 'error');
    alert(`Erro ao enviar variação:\n${err.message}`);
  } finally {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.style.opacity = '1';
    }
  }
};

window.renderVariations = FGW.renderVariations;
window.handleAddVariation = FGW.handleAddVariation;
window.getValidVariations = FGW.getValidVariations;
window.updateVariationsBadge = FGW.updateVariationsBadge;
window.updateVariationScopeSelectorOptions = FGW.updateVariationScopeSelectorOptions;
window.handleScopeChange = FGW.handleScopeChange;
window.handleToggleGroupCustomVars = FGW.handleToggleGroupCustomVars;
window.handleCopyGlobalToGroup = FGW.handleCopyGlobalToGroup;
window.getVariationsForGroup = FGW.getVariationsForGroup;
window.updateWhatsAppMobilePreview = FGW.updateWhatsAppMobilePreview;
window.formatWhatsAppPreviewText = FGW.formatWhatsAppPreviewText;
window.loadRealChatMessages = FGW.loadRealChatMessages;
window.renderRealMessages = FGW.renderRealMessages;
window.handleSendRealChatMessage = FGW.handleSendRealChatMessage;
window.handleSendVariationToActiveGroup = FGW.handleSendVariationToActiveGroup;
window.togglePreviewAudioPlayback = FGW.togglePreviewAudioPlayback;



