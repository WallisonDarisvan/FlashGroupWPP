/**
 * FlashGroup WPP - Módulo: Variables
 * Gerencia a criação, edição e exclusão de Variáveis Dinâmicas, Chips e substituição de tags.
 */

window.FGW = window.FGW || {};

FGW.insertTagIntoActiveTextarea = function(tagName) {
  const state = FGW.state;
  const elements = FGW.elements || {};
  let target = state.lastFocusedTextarea;
  const allTextareas = elements.variationsList ? elements.variationsList.querySelectorAll('textarea') : [];

  if (!target || !document.body.contains(target)) {
    if (allTextareas.length > 0) {
      target = allTextareas[0];
    } else {
      if (FGW.handleAddVariation) FGW.handleAddVariation();
      target = elements.variationsList ? elements.variationsList.querySelector('textarea') : null;
    }
  }

  if (!target) return;

  const tag = `{${tagName}}`;
  const start = target.selectionStart || target.value.length;
  const end = target.selectionEnd || target.value.length;
  const original = target.value;

  target.value = original.substring(0, start) + tag + original.substring(end);
  target.focus();
  target.selectionStart = target.selectionEnd = start + tag.length;

  target.dispatchEvent(new Event('input', { bubbles: true }));
  FGW.log('INFO', `Variável "${tag}" inserida no texto da variação.`, 'info');
};

FGW.handleInsertGroupIdTag = function() {
  FGW.insertTagIntoActiveTextarea('ID do Grupo');
};

FGW.applyDynamicTags = function(templateText, group) {
  if (!templateText) return '';
  const state = FGW.state;

  const customIdentifier = (group.customId && group.customId.trim())
    ? group.customId.trim()
    : (group.subject || group.id);

  let processed = templateText
    .replace(/\{ID\s*do\s*Grupo\}/gi, customIdentifier)
    .replace(/\{Nome\s*do\s*Grupo\}/gi, group.subject || customIdentifier);

  // Substituição de todas as variáveis customizadas
  if (Array.isArray(state.customVariables)) {
    state.customVariables.forEach(v => {
      if (!v || !v.name) return;
      let replacement = '';
      if (v.type === 'group') {
        const groupVal = state.groupCustomVars[group.id]?.[v.name];
        replacement = (groupVal !== undefined && groupVal !== '') ? groupVal : (v.defaultValue || '');
      } else {
        replacement = v.defaultValue || '';
      }
      const regex = new RegExp('\\{' + FGW.escapeRegex(v.name.trim()) + '\\}', 'gi');
      processed = processed.replace(regex, replacement);
    });
  }

  return processed;
};

FGW.renderDynamicTagChips = function() {
  const elements = FGW.elements || {};
  if (!elements.dynamicTagsChipsContainer) return;
  elements.dynamicTagsChipsContainer.innerHTML = '';

  const fragment = document.createDocumentFragment();

  // 1. Tag Padrão: {ID do Grupo}
  const chipGroupId = document.createElement('button');
  chipGroupId.type = 'button';
  chipGroupId.className = 'btn-tag-chip chip-system';
  chipGroupId.title = 'Insere o Identificador personalizado do Grupo ou Nome';
  chipGroupId.innerHTML = `<code>{ID do Grupo}</code>`;
  chipGroupId.addEventListener('click', () => FGW.insertTagIntoActiveTextarea('ID do Grupo'));
  fragment.appendChild(chipGroupId);

  // 2. Tag Padrão: {Nome do Grupo}
  const chipGroupName = document.createElement('button');
  chipGroupName.type = 'button';
  chipGroupName.className = 'btn-tag-chip chip-system';
  chipGroupName.title = 'Insere o Nome original do Grupo no WhatsApp';
  chipGroupName.innerHTML = `<code>{Nome do Grupo}</code>`;
  chipGroupName.addEventListener('click', () => FGW.insertTagIntoActiveTextarea('Nome do Grupo'));
  fragment.appendChild(chipGroupName);

  // 3. Tags Personalizadas criadas pelo usuário
  if (Array.isArray(FGW.state.customVariables)) {
    FGW.state.customVariables.forEach(v => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `btn-tag-chip ${v.type === 'group' ? 'chip-group' : 'chip-global'}`;
      chip.title = v.type === 'group'
        ? `Variável por Grupo: edite o valor de cada grupo na tabela da Etapa 2`
        : `Variável Global: valor fixo compartilhado "${v.defaultValue || '(vazio)'}"`;
      chip.innerHTML = `
        <code>{${FGW.escapeHtml(v.name)}}</code>
        <span class="chip-type-subtle">${v.type === 'group' ? 'grupo' : 'global'}</span>
      `;
      chip.addEventListener('click', () => FGW.insertTagIntoActiveTextarea(v.name));
      fragment.appendChild(chip);
    });
  }

  elements.dynamicTagsChipsContainer.appendChild(fragment);
};

FGW.openVariablesModal = function() {
  const elements = FGW.elements || {};
  if (!elements.variablesModal) return;

  if (elements.newVarName) elements.newVarName.value = '';
  if (elements.newVarDefaultValue) elements.newVarDefaultValue.value = '';
  if (elements.newVarType) elements.newVarType.value = 'group';

  FGW.updateNewVarTagPreview();
  FGW.handleNewVarTypeChange();
  FGW.renderVariablesModalList();

  elements.variablesModal.classList.remove('hidden');
  if (elements.newVarName) elements.newVarName.focus();
};

FGW.closeVariablesModal = function() {
  const elements = FGW.elements || {};
  if (!elements.variablesModal) return;
  elements.variablesModal.classList.add('hidden');
  FGW.renderDynamicTagChips();
  if (FGW.renderGroupsTable) FGW.renderGroupsTable();
};

FGW.updateNewVarTagPreview = function() {
  const elements = FGW.elements || {};
  if (!elements.newVarTagPreview || !elements.newVarName) return;
  const raw = elements.newVarName.value.trim().replace(/^\{+|\}+$/g, '');
  if (raw) {
    elements.newVarTagPreview.innerHTML = `Tag resultante: <code>{${FGW.escapeHtml(raw)}}</code>`;
  } else {
    elements.newVarTagPreview.innerHTML = `Tag resultante: <code>{...}</code>`;
  }
};

FGW.handleNewVarTypeChange = function() {
  const elements = FGW.elements || {};
  const type = elements.newVarType ? elements.newVarType.value : 'group';
  if (type === 'group') {
    if (elements.varTypeHint) {
      elements.varTypeHint.textContent = 'Cada grupo terá seu próprio valor editável na tabela da Etapa 2.';
    }
    if (elements.lblVarDefaultValue) {
      elements.lblVarDefaultValue.textContent = 'Valor Padrão (Opcional)';
    }
    if (elements.newVarDefaultValue) {
      elements.newVarDefaultValue.placeholder = 'ex: https://link-padrao.com';
    }
  } else {
    if (elements.varTypeHint) {
      elements.varTypeHint.textContent = 'Valor fixo compartilhado por todos os grupos nesta campanha.';
    }
    if (elements.lblVarDefaultValue) {
      elements.lblVarDefaultValue.textContent = 'Valor Global da Variável';
    }
    if (elements.newVarDefaultValue) {
      elements.newVarDefaultValue.placeholder = 'ex: PROMO10 ou Chave PIX';
    }
  }
};

FGW.handleSaveNewVariable = function() {
  const elements = FGW.elements || {};
  if (!elements.newVarName) return;

  let name = elements.newVarName.value.trim().replace(/^\{+|\}+$/g, '').trim();

  if (!name) {
    alert('Por favor, informe o nome da variável.');
    elements.newVarName.focus();
    return;
  }

  // Validação de caracteres
  if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
    alert('O nome da variável deve conter apenas letras, números, espaços ou traços.');
    elements.newVarName.focus();
    return;
  }

  // Verifica conflito com tags padrão do sistema
  const lower = name.toLowerCase();
  if (lower === 'id do grupo' || lower === 'nome do grupo') {
    alert(`A tag "{${name}}" é reservada pelo sistema.`);
    elements.newVarName.focus();
    return;
  }

  // Verifica duplicatas
  const exists = FGW.state.customVariables.some(v => v.name.toLowerCase() === lower);
  if (exists) {
    alert(`Já existe uma variável com o nome "{${name}}".`);
    elements.newVarName.focus();
    return;
  }

  const type = elements.newVarType ? elements.newVarType.value : 'group';
  const defaultValue = elements.newVarDefaultValue ? elements.newVarDefaultValue.value.trim() : '';

  FGW.state.customVariables.push({
    name,
    type,
    defaultValue
  });

  FGW.saveCustomVariables();
  FGW.renderVariablesModalList();
  FGW.renderDynamicTagChips();
  if (FGW.renderGroupsTable) FGW.renderGroupsTable();

  FGW.log('SUCESSO', `Nova variável "{${name}}" criada com sucesso (${type === 'group' ? 'Por Grupo' : 'Global'}).`, 'success');

  elements.newVarName.value = '';
  if (elements.newVarDefaultValue) elements.newVarDefaultValue.value = '';
  FGW.updateNewVarTagPreview();
  elements.newVarName.focus();
};

FGW.handleDeleteVariable = function(varName) {
  const confirmDelete = confirm(`Deseja realmente excluir a variável "{${varName}}"?\nOs valores atribuídos a ela na tabela de grupos não serão mais disparados.`);
  if (!confirmDelete) return;

  FGW.state.customVariables = FGW.state.customVariables.filter(v => v.name !== varName);
  FGW.saveCustomVariables();
  FGW.renderVariablesModalList();
  FGW.renderDynamicTagChips();
  if (FGW.renderGroupsTable) FGW.renderGroupsTable();

  FGW.log('AVISO', `Variável "{${varName}}" foi excluída.`, 'warn');
};

FGW.renderVariablesModalList = function() {
  const elements = FGW.elements || {};
  if (!elements.variablesListContainer) return;
  elements.variablesListContainer.innerHTML = '';

  const totalCount = 2 + FGW.state.customVariables.length;
  if (elements.totalVarsBadge) {
    elements.totalVarsBadge.textContent = `${totalCount} variáveis ativas`;
  }

  const fragment = document.createDocumentFragment();

  // Card do Sistema 1: {ID do Grupo}
  const cardIdGrupo = document.createElement('div');
  cardIdGrupo.className = 'var-item-card is-system';
  cardIdGrupo.innerHTML = `
    <div class="var-item-header">
      <span class="var-tag-title">{ID do Grupo}</span>
      <span class="badge-var-type group">Por Grupo</span>
    </div>
    <div class="var-item-desc">
      Identificação personalizada editável na coluna da tabela de grupos. Se não preenchida, utiliza o nome do grupo.
    </div>
    <div class="var-item-actions">
      <span class="badge-var-type system">Padrão do Sistema</span>
    </div>
  `;
  fragment.appendChild(cardIdGrupo);

  // Card do Sistema 2: {Nome do Grupo}
  const cardNomeGrupo = document.createElement('div');
  cardNomeGrupo.className = 'var-item-card is-system';
  cardNomeGrupo.innerHTML = `
    <div class="var-item-header">
      <span class="var-tag-title">{Nome do Grupo}</span>
      <span class="badge-var-type system">WhatsApp</span>
    </div>
    <div class="var-item-desc">
      Substitui pelo título oficial original do grupo sincronizado do WhatsApp.
    </div>
    <div class="var-item-actions">
      <span class="badge-var-type system">Padrão do Sistema</span>
    </div>
  `;
  fragment.appendChild(cardNomeGrupo);

  // Cards das Variáveis Customizadas
  FGW.state.customVariables.forEach(v => {
    const card = document.createElement('div');
    card.className = 'var-item-card';

    const typeBadge = v.type === 'group'
      ? `<span class="badge-var-type group">Por Grupo (Coluna)</span>`
      : `<span class="badge-var-type global">Global</span>`;

    const descHtml = v.type === 'group'
      ? `Cria uma coluna na tabela de grupos. ${v.defaultValue ? `Padrão: <code>${FGW.escapeHtml(v.defaultValue)}</code>` : 'Sem valor padrão.'}`
      : `Valor fixo único para todos os grupos: <code>${FGW.escapeHtml(v.defaultValue || '(vazio)')}</code>`;

    card.innerHTML = `
      <div class="var-item-header">
        <span class="var-tag-title">{${FGW.escapeHtml(v.name)}}</span>
        ${typeBadge}
      </div>
      <div class="var-item-desc">${descHtml}</div>
      <div class="var-item-actions">
        <button type="button" class="btn btn-sm btn-ghost btn-copy-var" data-name="${FGW.escapeHtml(v.name)}" title="Inserir no texto agora">
          + Inserir Tag
        </button>
        <button type="button" class="btn-delete-var" data-name="${FGW.escapeHtml(v.name)}" title="Excluir variável">
          ✕ Excluir
        </button>
      </div>
    `;

    fragment.appendChild(card);
  });

  elements.variablesListContainer.appendChild(fragment);

  // Listeners dos botões dos cards
  elements.variablesListContainer.querySelectorAll('.btn-delete-var').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.currentTarget.dataset.name;
      FGW.handleDeleteVariable(name);
    });
  });

  elements.variablesListContainer.querySelectorAll('.btn-copy-var').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.currentTarget.dataset.name;
      FGW.insertTagIntoActiveTextarea(name);
      FGW.closeVariablesModal();
      FGW.goToStep(3);
    });
  });
};

window.renderDynamicTagChips = FGW.renderDynamicTagChips;
window.openVariablesModal = FGW.openVariablesModal;
window.closeVariablesModal = FGW.closeVariablesModal;
window.applyDynamicTags = FGW.applyDynamicTags;
