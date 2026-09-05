/**
 * FlashGroup WPP - Módulo: Groups
 * Gerencia a Etapa 2: carregamento, listagem em tabela, filtragem, seleções e status dos grupos.
 */

window.FGW = window.FGW || {};

FGW.showGroupsLoadingState = function(text) {
  const elements = FGW.elements || {};
  if (!elements.groupsTableBody) return;
  elements.groupsTableBody.innerHTML = `
    <tr class="loading-row">
      <td colspan="5">
        <div class="empty-state" style="padding: 32px 16px; text-align: center;">
          <div class="spinner" style="margin: 0 auto 12px; width: 28px; height: 28px; border-width: 3px;"></div>
          <p style="font-weight: 600; color: var(--accent-cyan); font-size: 0.9rem;">${text || 'Sincronizando grupos do WhatsApp...'}</p>
          <span style="font-size: 0.75rem; color: #8696a0; display: block; margin-top: 4px;">A Evolution API está indexando os chats e grupos da sua conta (pode levar cerca de 25s na primeira sincronização).</span>
        </div>
      </td>
    </tr>
  `;
};

FGW.showGroupsErrorState = function(errMsg) {
  const elements = FGW.elements || {};
  if (!elements.groupsTableBody) return;
  elements.groupsTableBody.innerHTML = `
    <tr class="error-row">
      <td colspan="5">
        <div class="empty-state" style="padding: 24px 16px; text-align: center;">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#ef4444" stroke-width="1.5" style="margin: 0 auto 8px; display: block;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style="color: #ef4444; font-weight: 600; font-size: 0.85rem;">Não foi possível sincronizar os grupos no momento.</p>
          <span style="font-size: 0.75rem; color: #8696a0; display: block; margin: 4px auto 14px; max-width: 320px;">${errMsg || 'O WhatsApp ainda pode estar finalizando a indexação inicial.'}</span>
          <button type="button" class="btn btn-sm btn-primary" id="btnRetryLoadGroups" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 6px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.8 1.03 6.45 2.7L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            <span>Tentar Novamente</span>
          </button>
        </div>
      </td>
    </tr>
  `;
  const retryBtn = document.getElementById('btnRetryLoadGroups');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if (FGW.handleConnectAndFetchGroups) FGW.handleConnectAndFetchGroups();
    });
  }
};

FGW.handleConnectAndFetchGroups = async function(forceRefresh = true) {
  FGW.saveSettings();
  const elements = FGW.elements || {};
  const instanceName = elements.instanceName ? elements.instanceName.value.trim() : '';

  if (!instanceName) {
    alert('Por favor, preencha o Nome da Instância.');
    if (elements.instanceName) elements.instanceName.focus();
    return;
  }

  FGW.showGroupsLoadingState('Sincronizando grupos do WhatsApp...');
  FGW.setConnectionStatus('loading', 'Consultando...');
  if (elements.btnConnect) elements.btnConnect.disabled = true;
  if (elements.btnReloadGroupsStep2) elements.btnReloadGroupsStep2.disabled = true;
  FGW.log('INFO', `Checando status e buscando grupos da instância "${instanceName}"...`, 'info');

  try {
    const checkRes = await window.electronAPI.checkConnectionState({ instanceName });
    const activeName = (checkRes && checkRes.instanceName) || instanceName;
    
    if (checkRes.success && checkRes.state === 'open') {
      if (FGW.onConnectionEstablished) {
        await FGW.onConnectionEstablished(activeName, forceRefresh);
        return;
      }
    } else {
      FGW.setConnectionView(false);
      FGW.log('AVISO', `Instância "${instanceName}" não está conectada no momento.`, 'warn');
    }

    const groupsResult = await window.electronAPI.fetchGroups({ instanceName: activeName });
    
    if (!groupsResult.success) {
      FGW.log('AVISO', `A Evolution API está sincronizando os dados (${groupsResult.error}). Use o botão Recarregar se precisar revalidar.`, 'warn');
      return;
    }

    FGW.state.groups = (groupsResult.data || []).map(g => ({
      ...g,
      customId: FGW.state.groupCustomTags[g.id] || ''
    }));
    FGW.saveCachedGroups();

    FGW.log('SUCESSO', `${FGW.state.groups.length} grupos carregados com sucesso.`, 'success');
    FGW.renderGroupsTable();
    FGW.updateSelectionCounter();
    FGW.updateCampaignSummary();
    if (FGW.updateVariationScopeSelectorOptions) FGW.updateVariationScopeSelectorOptions();
  } catch (err) {
    FGW.setConnectionStatus('disconnected', 'Erro');
    FGW.log('ERRO', `Exceção inesperada: ${err.message}`, 'error');
  } finally {
    if (elements.btnConnect) elements.btnConnect.disabled = false;
    if (elements.btnReloadGroupsStep2) elements.btnReloadGroupsStep2.disabled = false;
  }
};

FGW.setGroupsFilter = function(mode) {
  FGW.state.groupsFilterMode = mode;
  const elements = FGW.elements || {};
  if (elements.btnFilterAllGroups) {
    elements.btnFilterAllGroups.classList.toggle('active', mode === 'all');
  }
  if (elements.btnFilterSelectedGroups) {
    elements.btnFilterSelectedGroups.classList.toggle('active', mode === 'selected');
  }
  FGW.renderGroupsTable();
};

FGW.getFilteredGroups = function() {
  const elements = FGW.elements || {};
  const query = elements.searchGroupInput ? elements.searchGroupInput.value.toLowerCase().trim() : '';
  let list = FGW.state.groups || [];

  if (FGW.state.groupsFilterMode === 'selected') {
    list = list.filter(g => FGW.state.selectedGroupIds.has(g.id));
  }

  if (!query) return list;

  return list.filter(g => {
    const nameMatch = (g.subject || '').toLowerCase().includes(query);
    const idMatch = (g.id || '').toLowerCase().includes(query);
    const customIdMatch = (g.customId || '').toLowerCase().includes(query);
    return nameMatch || idMatch || customIdMatch;
  });
};

FGW.renderGroupsTable = function() {
  const elements = FGW.elements || {};
  const filtered = FGW.getFilteredGroups();
  const groupVars = (FGW.state.customVariables || []).filter(v => v.type === 'group');

  // Atualiza o cabeçalho com as colunas dinâmicas
  if (elements.groupsTableHeaderRow) {
    const dynamicHeadersHtml = groupVars.map(v => `
      <th class="col-custom-var" title="Variável dinâmica: {${FGW.escapeHtml(v.name)}}">
        {${FGW.escapeHtml(v.name)}}
      </th>
    `).join('');

    elements.groupsTableHeaderRow.innerHTML = `
      <th class="col-checkbox">
        <input type="checkbox" id="masterCheckbox" title="Selecionar Todos">
      </th>
      <th class="col-name">Grupo / Identificação</th>
      ${dynamicHeadersHtml}
      <th class="col-participants">Membros</th>
    `;

    // Reassocia o listener do masterCheckbox
    const newMasterCheckbox = document.getElementById('masterCheckbox');
    if (newMasterCheckbox) {
      elements.masterCheckbox = newMasterCheckbox;
      elements.masterCheckbox.addEventListener('change', FGW.handleMasterCheckboxToggle);
    }
  }

  if (elements.groupsTableBody) elements.groupsTableBody.innerHTML = '';
  if (elements.totalGroupsCounter) elements.totalGroupsCounter.textContent = `(${FGW.state.groups.length} disponíveis)`;

  if (filtered.length === 0) {
    const totalCols = 3 + groupVars.length;
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const isSelectedTab = FGW.state.groupsFilterMode === 'selected';
    tr.innerHTML = `
      <td colspan="${totalCols}">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>${isSelectedTab ? 'Nenhum grupo marcado no momento.' : 'Nenhum grupo encontrado com o filtro atual.'}</p>
          <span>${isSelectedTab ? 'Alterne para a aba "Todos os Grupos" para marcar os grupos que deseja usar.' : 'Conecte o seu WhatsApp na Etapa 1 ou clique em "Recarregar".'}</span>
        </div>
      </td>
    `;
    if (elements.groupsTableBody) elements.groupsTableBody.appendChild(tr);
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(group => {
    const isSelected = FGW.state.selectedGroupIds.has(group.id);
    const tr = document.createElement('tr');
    tr.id = `row-group-${FGW.sanitizeDomId(group.id)}`;
    if (isSelected) tr.classList.add('row-selected');
    if (group.id === FGW.state.currentChatGroupId) tr.classList.add('row-chat-focused');

    const dynamicCellsHtml = groupVars.map(v => {
      const currentVal = (FGW.state.groupCustomVars[group.id] && FGW.state.groupCustomVars[group.id][v.name]) !== undefined
        ? FGW.state.groupCustomVars[group.id][v.name]
        : '';
      const placeholderText = v.defaultValue ? `Padrão: ${v.defaultValue}` : `{${v.name}} deste grupo...`;

      return `
        <td class="col-custom-var">
          <input type="text" 
                 class="custom-var-input" 
                 data-id="${FGW.escapeHtml(group.id)}" 
                 data-var="${FGW.escapeHtml(v.name)}" 
                 placeholder="${FGW.escapeHtml(placeholderText)}" 
                 value="${FGW.escapeHtml(currentVal)}" 
                 title="Valor de {${FGW.escapeHtml(v.name)}} para o grupo &quot;${FGW.escapeHtml(group.subject)}&quot;">
        </td>
      `;
    }).join('');

    tr.innerHTML = `
      <td class="col-checkbox">
        <input type="checkbox" class="group-checkbox" data-id="${FGW.escapeHtml(group.id)}" ${isSelected ? 'checked' : ''}>
      </td>
      <td class="col-name">
        <div class="group-cell-wrap">
          <div class="group-avatar-wrapper">
            ${group.pictureUrl ? `
              <img src="${FGW.escapeHtml(group.pictureUrl)}" class="group-avatar-img" alt="" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
              <div class="group-avatar-fallback" style="display:none;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
              </div>
            ` : `
              <div class="group-avatar-fallback">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
              </div>
            `}
          </div>
          <div class="group-cell-meta">
            <div class="group-name-title" title="${FGW.escapeHtml(group.subject)}">${FGW.escapeHtml(group.subject)}</div>
            <div class="group-custom-id-subline">
              <input type="text" 
                     class="custom-id-input group-inline-sub-input" 
                     data-id="${FGW.escapeHtml(group.id)}" 
                     placeholder="Identificação {ID do Grupo}..." 
                     value="${FGW.escapeHtml(group.customId || '')}" 
                     title="Identificação deste grupo que substituirá {ID do Grupo}">
            </div>
          </div>
        </div>
      </td>
      ${dynamicCellsHtml}
      <td class="col-participants">${group.participantsCount !== null ? group.participantsCount : '-'}</td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.closest('input') || e.target.closest('button')) return;
      if (FGW.focusGroupInChat) FGW.focusGroupInChat(group.id);
    });

    fragment.appendChild(tr);
  });

  if (elements.groupsTableBody) elements.groupsTableBody.appendChild(fragment);

  // Checkboxes de seleção
  if (elements.groupsTableBody) {
    elements.groupsTableBody.querySelectorAll('.group-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const row = document.getElementById(`row-group-${FGW.sanitizeDomId(id)}`);
        if (e.target.checked) {
          FGW.state.selectedGroupIds.add(id);
          if (row) row.classList.add('row-selected');
          // Ao marcar um grupo, foca imediatamente nele no chat
          if (FGW.focusGroupInChat) FGW.focusGroupInChat(id);
        } else {
          FGW.state.selectedGroupIds.delete(id);
          if (row) row.classList.remove('row-selected');
          const remaining = Array.from(FGW.state.selectedGroupIds);
          if (remaining.length > 0 && FGW.focusGroupInChat) {
            FGW.focusGroupInChat(remaining[0]);
          }
        }
        FGW.saveSelectedGroupIds();
        FGW.updateSelectionCounter();
        FGW.updateMasterCheckboxState();
        FGW.updateCampaignSummary();
      });
    });

    // Inputs de identificação personalizada ({ID do Grupo}) com debounce
    elements.groupsTableBody.querySelectorAll('.custom-id-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const val = e.target.value;
        const grp = FGW.state.groups.find(g => g.id === id);
        if (grp) grp.customId = val;
        FGW.state.groupCustomTags[id] = val;

        clearTimeout(input._saveTimer);
        input._saveTimer = setTimeout(() => {
          FGW.saveGroupCustomTags();
        }, 220);
      });
    });

    // Inputs de variáveis dinâmicas por grupo ({NomeDaVar}) com debounce
    elements.groupsTableBody.querySelectorAll('.custom-var-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const varName = e.target.dataset.var;
        const val = e.target.value;

        if (!FGW.state.groupCustomVars[id]) {
          FGW.state.groupCustomVars[id] = {};
        }
        FGW.state.groupCustomVars[id][varName] = val;

        clearTimeout(input._saveTimer);
        input._saveTimer = setTimeout(() => {
          FGW.saveGroupCustomVars();
        }, 220);
      });
    });
  }

  FGW.updateMasterCheckboxState();
};

FGW._searchDebounceTimer = null;
FGW.handleSearchFilter = function() {
  clearTimeout(FGW._searchDebounceTimer);
  FGW._searchDebounceTimer = setTimeout(() => {
    FGW.renderGroupsTable();
  }, 220);
};

FGW.updateSelectionCounter = function() {
  const elements = FGW.elements || {};
  const count = FGW.state.selectedGroupIds.size;
  if (elements.selectionCounter) {
    elements.selectionCounter.textContent = `${count} ${count === 1 ? 'selecionado' : 'selecionados'}`;
  }
  if (elements.filterSelectedCount) {
    elements.filterSelectedCount.textContent = count;
  }
  if (FGW.updateChatTargetGroupOptions) {
    FGW.updateChatTargetGroupOptions();
  }
};

FGW.selectAllGroups = function() {
  const filtered = FGW.getFilteredGroups();
  filtered.forEach(g => FGW.state.selectedGroupIds.add(g.id));
  FGW.saveSelectedGroupIds();
  FGW.renderGroupsTable();
  FGW.updateSelectionCounter();
  FGW.updateCampaignSummary();
};

FGW.clearGroupSelection = function() {
  FGW.state.selectedGroupIds.clear();
  FGW.saveSelectedGroupIds();
  FGW.renderGroupsTable();
  FGW.updateSelectionCounter();
  FGW.updateCampaignSummary();
};

FGW.selectRandom20Groups = function() {
  if (FGW.state.groups.length === 0) {
    alert('Nenhum grupo disponível. Conecte e carregue os grupos primeiro.');
    return;
  }

  FGW.state.selectedGroupIds.clear();
  const allIds = FGW.state.groups.map(g => g.id);
  const shuffled = (FGW.shuffleArray ? FGW.shuffleArray(allIds) : allIds.sort(() => Math.random() - 0.5));

  const chosen = shuffled.slice(0, 20);
  chosen.forEach(id => FGW.state.selectedGroupIds.add(id));
  FGW.saveSelectedGroupIds();

  FGW.renderGroupsTable();
  FGW.updateSelectionCounter();
  FGW.updateCampaignSummary();
  FGW.log('INFO', `${chosen.length} grupos selecionados aleatoriamente.`, 'info');
};

FGW.handleMasterCheckboxToggle = function(e) {
  const checked = e.target.checked;
  const filtered = FGW.getFilteredGroups();
  filtered.forEach(g => {
    if (checked) {
      FGW.state.selectedGroupIds.add(g.id);
    } else {
      FGW.state.selectedGroupIds.delete(g.id);
    }
  });
  FGW.saveSelectedGroupIds();
  FGW.renderGroupsTable();
  FGW.updateSelectionCounter();
  FGW.updateCampaignSummary();
};

FGW.updateMasterCheckboxState = function() {
  const elements = FGW.elements || {};
  if (!elements.masterCheckbox) return;

  const filtered = FGW.getFilteredGroups();
  if (filtered.length === 0) {
    elements.masterCheckbox.checked = false;
    elements.masterCheckbox.indeterminate = false;
    return;
  }

  const selectedCount = filtered.filter(g => FGW.state.selectedGroupIds.has(g.id)).length;
  if (selectedCount === 0) {
    elements.masterCheckbox.checked = false;
    elements.masterCheckbox.indeterminate = false;
  } else if (selectedCount === filtered.length) {
    elements.masterCheckbox.checked = true;
    elements.masterCheckbox.indeterminate = false;
  } else {
    elements.masterCheckbox.checked = false;
    elements.masterCheckbox.indeterminate = true;
  }
};

FGW.updateGroupStatusInDOM = function(groupId, status) {
  const group = FGW.state.groups.find(g => g.id === groupId);
  if (group) group.status = status;

  const cell = document.getElementById(`status-cell-${FGW.sanitizeDomId(groupId)}`);
  if (!cell) return;

  const statusMap = {
    pending: '<span class="status-pill pending">Pendente</span>',
    sending: '<span class="status-pill sending">Enviando...</span>',
    success: '<span class="status-pill success">✓ Enviado</span>',
    error: '<span class="status-pill error">✗ Falha</span>'
  };

  cell.innerHTML = statusMap[status] || statusMap.pending;
};

FGW.updateChatTargetGroupOptions = function() {
  const elements = FGW.elements || {};
  if (!elements.chatTargetGroupSelect) return;
  const currentVal = elements.chatTargetGroupSelect.value;
  const allGroups = FGW.state.groups || [];

  if (allGroups.length === 0) {
    elements.chatTargetGroupSelect.innerHTML = `<option value="">Nenhum grupo disponível</option>`;
    return;
  }

  const selectedGroups = allGroups.filter(g => FGW.state.selectedGroupIds.has(g.id));
  let html = '';

  if (selectedGroups.length > 0) {
    html += `<optgroup label="⭐ Grupos Marcados na Campanha (${selectedGroups.length})">`;
    selectedGroups.forEach(g => {
      const mem = g.participantsCount ? ` (${g.participantsCount} membros)` : '';
      html += `<option value="${FGW.escapeHtml(g.id)}">✓ ${FGW.escapeHtml(g.subject)}${mem}</option>`;
    });
    html += `</optgroup>`;

    const otherGroups = allGroups.filter(g => !FGW.state.selectedGroupIds.has(g.id));
    if (otherGroups.length > 0) {
      html += `<optgroup label="Outros Grupos da Conta (${otherGroups.length})">`;
      otherGroups.forEach(g => {
        const mem = g.participantsCount ? ` (${g.participantsCount} membros)` : '';
        html += `<option value="${FGW.escapeHtml(g.id)}">👥 ${FGW.escapeHtml(g.subject)}${mem}</option>`;
      });
      html += `</optgroup>`;
    }
  } else {
    allGroups.forEach(g => {
      const mem = g.participantsCount ? ` (${g.participantsCount} membros)` : '';
      html += `<option value="${FGW.escapeHtml(g.id)}">👥 ${FGW.escapeHtml(g.subject)}${mem}</option>`;
    });
  }

  elements.chatTargetGroupSelect.innerHTML = html;

  let targetToSelect = null;
  if (FGW.state.currentChatGroupId && allGroups.some(g => g.id === FGW.state.currentChatGroupId)) {
    targetToSelect = FGW.state.currentChatGroupId;
  } else if (currentVal && currentVal !== '__preview_default__' && allGroups.some(g => g.id === currentVal)) {
    targetToSelect = currentVal;
  } else if (selectedGroups.length > 0) {
    targetToSelect = selectedGroups[0].id;
  } else if (allGroups.length > 0) {
    targetToSelect = allGroups[0].id;
  }

  if (targetToSelect) {
    elements.chatTargetGroupSelect.value = targetToSelect;
    FGW.state.currentChatGroupId = targetToSelect;

    const grp = allGroups.find(g => g.id === targetToSelect);
    if (elements.chatComposerInput && grp) {
      elements.chatComposerInput.placeholder = `Mensagem direta para "${grp.subject}"...`;
    }
  }

  if (FGW.updateWhatsAppMobilePreview) FGW.updateWhatsAppMobilePreview();
};

FGW.focusGroupInChat = function(groupId) {
  if (!groupId) return;
  const elements = FGW.elements || {};
  FGW.state.currentChatGroupId = groupId;

  // 1. Atualiza o dropdown no cabeçalho do chat
  if (elements.chatTargetGroupSelect) {
    elements.chatTargetGroupSelect.value = groupId;
  }

  // 2. Destaca visualmente a linha deste grupo na tabela de grupos da Coluna 1
  if (elements.groupsTableBody) {
    elements.groupsTableBody.querySelectorAll('tr').forEach(r => r.classList.remove('row-chat-focused'));
    const focusedRow = document.getElementById(`row-group-${FGW.sanitizeDomId(groupId)}`);
    if (focusedRow) {
      focusedRow.classList.add('row-chat-focused');
      focusedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // 3. Atualiza placeholder do campo de digitação do chat com o nome do grupo exato
  const group = (FGW.state.groups || []).find(g => g.id === groupId);
  if (elements.chatComposerInput) {
    if (group) {
      elements.chatComposerInput.placeholder = `Mensagem direta para "${group.subject}"...`;
    } else {
      elements.chatComposerInput.placeholder = 'Mensagem direta para este grupo...';
    }
  }

  // 4. Atualiza cabeçalho do chat (foto e status)
  if (FGW.updateWhatsAppMobilePreview) FGW.updateWhatsAppMobilePreview();

  // 5. Carrega mensagens reais deste grupo específico
  if (FGW.loadRealChatMessages) FGW.loadRealChatMessages(groupId);
};

window.renderGroupsTable = FGW.renderGroupsTable;
window.handleConnectAndFetchGroups = FGW.handleConnectAndFetchGroups;
window.selectAllGroups = FGW.selectAllGroups;
window.clearGroupSelection = FGW.clearGroupSelection;
window.selectRandom20Groups = FGW.selectRandom20Groups;
window.updateSelectionCounter = FGW.updateSelectionCounter;
window.updateGroupStatusInDOM = FGW.updateGroupStatusInDOM;
window.updateChatTargetGroupOptions = FGW.updateChatTargetGroupOptions;
window.focusGroupInChat = FGW.focusGroupInChat;
window.setGroupsFilter = FGW.setGroupsFilter;

FGW.refreshGroupPicturesSilently = async function(instanceName) {
  if (!instanceName || !window.electronAPI || !window.electronAPI.fetchGroups) return;
  try {
    const res = await window.electronAPI.fetchGroups({ instanceName });
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      const picMap = {};
      res.data.forEach(g => {
        if (g.pictureUrl) picMap[g.id] = g.pictureUrl;
      });
      let updated = false;
      (FGW.state.groups || []).forEach(g => {
        if (!g.pictureUrl && picMap[g.id]) {
          g.pictureUrl = picMap[g.id];
          updated = true;
        }
      });
      if (updated) {
        FGW.saveCachedGroups();
        FGW.renderGroupsTable();
        if (FGW.updateWhatsAppMobilePreview) FGW.updateWhatsAppMobilePreview();
      }
    }
  } catch (e) {
    // Falha silenciosa em background
  }
};
