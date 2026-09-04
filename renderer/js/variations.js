/**
 * FlashGroup WPP - Módulo: Variations
 * Gerencia a Etapa 3: variações de mensagem com mídia individual e alternância de escopo (Geral vs. Exclusivo por Grupo).
 */

window.FGW = window.FGW || {};

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
      const hasMedia = !!(v.media && v.media.dataUrl);
      return hasText || hasMedia;
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

FGW.updateWhatsAppMobilePreview = function() {
  const elements = FGW.elements || {};
  const activeList = FGW.getCurrentActiveVariationsList();

  // Relógio do Celular e da Mensagem
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (elements.phoneStatusTime) elements.phoneStatusTime.textContent = timeStr;
  if (elements.waMessageTime) elements.waMessageTime.textContent = timeStr;

  // Informações do Contato / Grupo no Header do WhatsApp
  if (elements.waPreviewTargetName) {
    if (FGW.state.activeMessageScope !== '__global__') {
      const grp = FGW.state.groups.find(g => g.id === FGW.state.activeMessageScope);
      elements.waPreviewTargetName.textContent = grp ? grp.subject : 'Grupo Selecionado';
      if (elements.waPreviewTargetStatus) {
        elements.waPreviewTargetStatus.textContent = grp?.participantsCount 
          ? `${grp.participantsCount} membros • online` 
          : 'online • toque para dados';
      }
    } else {
      elements.waPreviewTargetName.textContent = 'Grupo WhatsApp (Padrão)';
      if (elements.waPreviewTargetStatus) {
        elements.waPreviewTargetStatus.textContent = 'online • toque para dados';
      }
    }
  }

  // Se a lista estiver vazia
  if (!activeList || activeList.length === 0) {
    if (elements.previewVariationIndicator) elements.previewVariationIndicator.textContent = 'Sem variações';
    if (elements.waPreviewText) elements.waPreviewText.innerHTML = '<em>Nenhuma variação disponível neste escopo.</em>';
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

  // Atualiza Badge do Topo do Mockup
  if (elements.previewVariationIndicator) {
    elements.previewVariationIndicator.textContent = `Variação #${curIdx + 1}`;
  }

  // Atualiza Texto da Mensagem com formatação e emojis
  if (elements.waPreviewText) {
    elements.waPreviewText.innerHTML = FGW.formatWhatsAppPreviewText(item.text);
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
      } else if (item.media.mediatype === 'video') {
        if (elements.waPreviewImage) elements.waPreviewImage.classList.add('hidden');
        if (elements.waPreviewVideoBox) {
          elements.waPreviewVideoBox.classList.remove('hidden');
          if (elements.waPreviewVideoName) elements.waPreviewVideoName.textContent = item.media.fileName || 'video.mp4';
        }
        if (elements.waPreviewDocBox) elements.waPreviewDocBox.classList.add('hidden');
      } else {
        // Documento PDF ou áudio
        if (elements.waPreviewImage) elements.waPreviewImage.classList.add('hidden');
        if (elements.waPreviewVideoBox) elements.waPreviewVideoBox.classList.add('hidden');
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
    }
  }

  // Destaca o card ativo na lista de variações
  if (elements.variationsList) {
    elements.variationsList.querySelectorAll('.variation-item').forEach((card, i) => {
      if (i === curIdx) {
        card.classList.add('is-active-preview');
        // Adiciona badge se ainda não tiver
        const headerLeft = card.querySelector('.variation-header-left');
        if (headerLeft && !headerLeft.querySelector('.badge-previewing')) {
          const b = document.createElement('span');
          b.className = 'badge-previewing';
          b.innerHTML = '👁️ No Preview';
          headerLeft.appendChild(b);
        }
      } else {
        card.classList.remove('is-active-preview');
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
    const isCurrentlyPreviewed = (index === FGW.state.previewVariationIndex);

    const card = document.createElement('div');
    card.className = `variation-item ${isCurrentlyPreviewed ? 'is-active-preview' : ''}`;
    card.id = `variation-card-${index}`;
    card.dataset.index = index;

    let mediaBadgeHtml = '';
    if (hasMedia) {
      const typeLabel = (item.media.mediatype || 'mídia').toUpperCase();
      mediaBadgeHtml = `<span class="badge-var-media">${FGW.escapeHtml(typeLabel)}</span>`;
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
      const thumbContent = m.mediatype === 'image'
        ? `<img src="${m.dataUrl}" alt="Preview">`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
             <polyline points="14 2 14 8 20 8"/>
           </svg>`;

      mediaPreviewHtml = `
        <div class="variation-media-preview">
          <div class="var-media-left">
            <div class="var-media-thumb">${thumbContent}</div>
            <div class="var-media-details">
              <span class="var-media-name" title="${FGW.escapeHtml(m.fileName)}">${FGW.escapeHtml(m.fileName)}</span>
              <span class="var-media-size">${FGW.escapeHtml(m.fileSizeStr || '')} • ${(m.mediatype || '').toUpperCase()}</span>
            </div>
          </div>
          <button type="button" class="btn-remove-var-media" data-index="${index}" title="Remover mídia desta variação">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
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
          <button type="button" class="${attachBtnClass}" data-index="${index}" title="${attachBtnTitle}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            <span>${attachBtnText}</span>
          </button>
          <input type="file" class="var-file-input" data-index="${index}" accept="image/*,video/mp4,application/pdf" style="display: none;">
          <button type="button" class="btn-delete-variation" data-index="${index}" title="Excluir esta variação">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <textarea placeholder="Digite a mensagem ou legenda da mídia..." data-index="${index}">${FGW.escapeHtml(textValue)}</textarea>

      ${mediaPreviewHtml}
    `;

    // Clique no Card ativa o preview desta variação
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      FGW.state.previewVariationIndex = index;
      FGW.updateWhatsAppMobilePreview();
    });

    elements.variationsList.appendChild(card);
  });

  // Event Listeners dos Textareas (atualizam o preview em tempo real)
  elements.variationsList.querySelectorAll('textarea').forEach(textarea => {
    textarea.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      const list = FGW.getCurrentActiveVariationsList();
      if (list[idx]) {
        list[idx].text = e.target.value;
        FGW.state.previewVariationIndex = idx;
        FGW.saveActiveVariations();
        FGW.updateVariationsBadge();
        FGW.updateWhatsAppMobilePreview();
        if (FGW.renderGroupsTable) FGW.renderGroupsTable();
        FGW.updateVariationScopeSelectorOptions();
      }
    });

    textarea.addEventListener('focus', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      FGW.state.lastFocusedTextarea = e.target;
      FGW.state.previewVariationIndex = idx;
      FGW.updateWhatsAppMobilePreview();
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
      } else if (file.type.startsWith('audio/')) {
        mediatype = 'audio';
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const sizeFormatted = file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;

        const list = FGW.getCurrentActiveVariationsList();
        if (!list[idx]) {
          list[idx] = { text: '', media: null };
        }

        list[idx].media = {
          dataUrl,
          mediatype,
          mimetype: file.type || 'application/octet-stream',
          fileName: file.name,
          fileSizeStr: sizeFormatted
        };

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
  list.push({ text: '', media: null });
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
    const hasMedia = !!(v.media && v.media.dataUrl);
    return hasText || hasMedia;
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
      const hasMedia = !!(v.media && v.media.dataUrl);
      return hasText || hasMedia;
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

