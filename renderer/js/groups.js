/**
 * FlashGroup WPP - Módulo: Groups
 * Gerencia a Etapa 2: carregamento, listagem em tabela, filtragem, seleções e status dos grupos.
 */

window.FGW = window.FGW || {};

FGW.handleConnectAndFetchGroups = async function() {
  FGW.saveSettings();
  const elements = FGW.elements || {};
  const instanceName = elements.instanceName ? elements.instanceName.value.trim() : '';

  if (!instanceName) {
    alert('Por favor, preencha o Nome da Instância.');
    if (elements.instanceName) elements.instanceName.focus();
    return;
  }

  FGW.setConnectionStatus('loading', 'Consultando...');
  if (elements.btnConnect) elements.btnConnect.disabled = true;
  if (elements.btnReloadGroupsStep2) elements.btnReloadGroupsStep2.disabled = true;
  FGW.log('INFO', `Checando status e buscando grupos da instância "${instanceName}"...`, 'info');

  try {
    const checkRes = await window.electronAPI.checkConnectionState({ instanceName });
    
    if (checkRes.success && checkRes.state === 'open') {
      FGW.setConnectionStatus('connected', 'Conectado');
    } else {
      FGW.setConnectionStatus('disconnected', checkRes.state === 'connecting' ? 'Aguardando QR' : 'Desconectado');
      FGW.log('AVISO', `Instância "${instanceName}" não está conectada. Retorne à Etapa 1 para escanear o QR Code.`, 'warn');
    }

    const groupsResult = await window.electronAPI.fetchGroups({ instanceName });
    
    if (!groupsResult.success) {
      FGW.log('ERRO', groupsResult.error, 'error');
      alert(`Aviso ao buscar grupos:\n${groupsResult.error}`);
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

FGW.getFilteredGroups = function() {
  const elements = FGW.elements || {};
  const query = elements.searchGroupInput ? elements.searchGroupInput.value.toLowerCase().trim() : '';
  if (!query) return FGW.state.groups;

  return FGW.state.groups.filter(g => {
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
      <th class="col-name">Nome do Grupo (WhatsApp)</th>
      <th class="col-custom-id">Identificação ({ID do Grupo})</th>
      ${dynamicHeadersHtml}
      <th class="col-msg-custom">Mensagens</th>
      <th class="col-id">ID do Grupo</th>
      <th class="col-participants">Membros</th>
      <th class="col-status">Status de Envio</th>
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
    const totalCols = 7 + groupVars.length;
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = `
      <td colspan="${totalCols}">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Nenhum grupo encontrado com o filtro atual.</p>
          <span>Conecte o seu WhatsApp na Etapa 1 ou clique em "Recarregar Grupos".</span>
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
    tr.id = `row-group-${CSS.escape(group.id)}`;
    if (isSelected) tr.classList.add('row-selected');

    const statusMap = {
      pending: '<span class="status-pill pending">Pendente</span>',
      sending: '<span class="status-pill sending">Enviando...</span>',
      success: '<span class="status-pill success">✓ Enviado</span>',
      error: '<span class="status-pill error">✗ Falha</span>'
    };
    const statusHtml = statusMap[group.status] || statusMap.pending;

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

    const customConfig = FGW.state.groupCustomVariations[group.id];
    const isCustomActive = customConfig && customConfig.enabled && Array.isArray(customConfig.variations) && customConfig.variations.length > 0;
    const customCount = (customConfig && customConfig.variations) ? customConfig.variations.length : 0;
    const msgBtnClass = isCustomActive ? 'btn-group-messages is-custom' : 'btn-group-messages is-default';
    const msgBtnIcon = isCustomActive ? '💬' : '🌐';
    const msgBtnText = isCustomActive ? `${customCount} Exclusiva${customCount === 1 ? '' : 's'}` : 'Padrão Geral';
    const msgBtnTitle = isCustomActive
      ? `Grupo com ${customCount} mensagem(ns) exclusiva(s) ativa(s). Clique para editar.`
      : `Grupo utilizando mensagens gerais da campanha. Clique para criar mensagens exclusivas.`;

    tr.innerHTML = `
      <td class="col-checkbox">
        <input type="checkbox" class="group-checkbox" data-id="${FGW.escapeHtml(group.id)}" ${isSelected ? 'checked' : ''}>
      </td>
      <td class="col-name" title="${FGW.escapeHtml(group.subject)}">${FGW.escapeHtml(group.subject)}</td>
      <td class="col-custom-id">
        <input type="text" class="custom-id-input" data-id="${FGW.escapeHtml(group.id)}" placeholder="Ex: Grupo 1" value="${FGW.escapeHtml(group.customId || '')}" title="Identificação deste grupo que substituirá {ID do Grupo}">
      </td>
      ${dynamicCellsHtml}
      <td class="col-msg-custom">
        <button type="button" class="${msgBtnClass}" data-id="${FGW.escapeHtml(group.id)}" title="${FGW.escapeHtml(msgBtnTitle)}">
          <span>${msgBtnIcon}</span> ${FGW.escapeHtml(msgBtnText)}
        </button>
      </td>
      <td class="col-id" title="${FGW.escapeHtml(group.id)}">${FGW.escapeHtml(group.id)}</td>
      <td class="col-participants">${group.participantsCount !== null ? group.participantsCount : '-'}</td>
      <td class="col-status" id="status-cell-${CSS.escape(group.id)}">${statusHtml}</td>
    `;

    fragment.appendChild(tr);
  });

  if (elements.groupsTableBody) elements.groupsTableBody.appendChild(fragment);

  // Checkboxes de seleção
  if (elements.groupsTableBody) {
    elements.groupsTableBody.querySelectorAll('.group-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const row = document.getElementById(`row-group-${CSS.escape(id)}`);
        if (e.target.checked) {
          FGW.state.selectedGroupIds.add(id);
          if (row) row.classList.add('row-selected');
        } else {
          FGW.state.selectedGroupIds.delete(id);
          if (row) row.classList.remove('row-selected');
        }
        FGW.saveSelectedGroupIds();
        FGW.updateSelectionCounter();
        FGW.updateMasterCheckboxState();
        FGW.updateCampaignSummary();
      });
    });

    // Botões de navegação para mensagens individuais por grupo
    elements.groupsTableBody.querySelectorAll('.btn-group-messages').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const gId = e.currentTarget.dataset.id;
        if (gId) {
          FGW.state.activeMessageScope = gId;
          if (elements.variationScopeSelector) elements.variationScopeSelector.value = gId;
          if (FGW.handleScopeChange) FGW.handleScopeChange(gId);
          FGW.goToStep(3);
        }
      });
    });

    // Inputs de identificação personalizada ({ID do Grupo})
    elements.groupsTableBody.querySelectorAll('.custom-id-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const val = e.target.value;
        const grp = FGW.state.groups.find(g => g.id === id);
        if (grp) grp.customId = val;
        FGW.state.groupCustomTags[id] = val;
        FGW.saveGroupCustomTags();
      });
    });

    // Inputs de variáveis dinâmicas por grupo ({NomeDaVar})
    elements.groupsTableBody.querySelectorAll('.custom-var-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const varName = e.target.dataset.var;
        const val = e.target.value;

        if (!FGW.state.groupCustomVars[id]) {
          FGW.state.groupCustomVars[id] = {};
        }
        FGW.state.groupCustomVars[id][varName] = val;
        FGW.saveGroupCustomVars();
      });
    });
  }

  FGW.updateMasterCheckboxState();
};

FGW.handleSearchFilter = function() {
  FGW.renderGroupsTable();
};

FGW.updateSelectionCounter = function() {
  const elements = FGW.elements || {};
  const count = FGW.state.selectedGroupIds.size;
  if (elements.selectionCounter) {
    elements.selectionCounter.textContent = `${count} ${count === 1 ? 'grupo selecionado' : 'grupos selecionados'}`;
  }
  if (elements.stepGroupsSub) {
    elements.stepGroupsSub.textContent = `${count} selecionados`;
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

  const cell = document.getElementById(`status-cell-${CSS.escape(groupId)}`);
  if (!cell) return;

  const statusMap = {
    pending: '<span class="status-pill pending">Pendente</span>',
    sending: '<span class="status-pill sending">Enviando...</span>',
    success: '<span class="status-pill success">✓ Enviado</span>',
    error: '<span class="status-pill error">✗ Falha</span>'
  };

  cell.innerHTML = statusMap[status] || statusMap.pending;
};

window.renderGroupsTable = FGW.renderGroupsTable;
window.handleConnectAndFetchGroups = FGW.handleConnectAndFetchGroups;
window.selectAllGroups = FGW.selectAllGroups;
window.clearGroupSelection = FGW.clearGroupSelection;
window.selectRandom20Groups = FGW.selectRandom20Groups;
window.updateSelectionCounter = FGW.updateSelectionCounter;
window.updateGroupStatusInDOM = FGW.updateGroupStatusInDOM;
