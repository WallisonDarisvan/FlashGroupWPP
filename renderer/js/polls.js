/**
 * FlashGroup WPP - Módulo: Polls (Enquetes WhatsApp)
 * Módulo isolado responsável por:
 * 1. Gerenciamento de variações de enquetes (Pergunta + Opções + Votos)
 * 2. Alternância de Modo de Campanha (Mensagens vs Enquetes)
 * 3. Suporte a tags dinâmicas ({ID do Grupo}, {Nome do Grupo}, variáveis customizadas)
 * 4. Pré-visualização nativa no formato de enquete do WhatsApp
 * 5. Persistência local no localStorage
 */

window.FGW = window.FGW || {};

FGW.POLLS_STORAGE_KEYS = {
  VARIATIONS: 'fgw_poll_variations',
  CAMPAIGN_TYPE: 'fgw_campaign_type'
};

/**
 * Retorna as variações padrão de enquete como exemplo inicial
 */
FGW.getDefaultPollVariations = function() {
  return [
    {
      id: 'poll_' + Date.now() + '_1',
      name: 'Qual destes tópicos você tem mais interesse em ver no {Nome do Grupo}?',
      selectableCount: 1,
      values: [
        'Novidades e Lançamentos 🚀',
        'Promoções e Descontos Exclusivos 🏷️',
        'Dicas e Tutoriais Rápidos 💡'
      ]
    },
    {
      id: 'poll_' + Date.now() + '_2',
      name: 'Como você avalia nosso conteúdo recente para {ID do Grupo}?',
      selectableCount: 1,
      values: [
        'Excelente, sempre útil! ⭐⭐⭐⭐⭐',
        'Muito bom, acompanho sempre! 👍',
        'Pode melhorar em alguns pontos 🤔'
      ]
    },
    {
      id: 'poll_' + Date.now() + '_3',
      name: 'Qual o melhor horário para receber nossas atualizações no {Nome do Grupo}?',
      selectableCount: 1,
      values: [
        'Manhã (09h - 12h) ☀️',
        'Tarde (14h - 18h) ⛅',
        'Noite (19h - 22h) 🌙'
      ]
    }
  ];
};

/**
 * Inicializa o módulo de enquetes
 */
FGW.initPolls = function() {
  // Carrega tipo de campanha salvo (default: 'messages')
  const savedType = localStorage.getItem(FGW.POLLS_STORAGE_KEYS.CAMPAIGN_TYPE);
  FGW.state.campaignType = (savedType === 'polls') ? 'polls' : 'messages';

  // Carrega variações salvas ou usa padrão
  try {
    const raw = localStorage.getItem(FGW.POLLS_STORAGE_KEYS.VARIATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        FGW.state.pollVariations = parsed;
      } else {
        FGW.state.pollVariations = FGW.getDefaultPollVariations();
      }
    } else {
      FGW.state.pollVariations = FGW.getDefaultPollVariations();
    }
  } catch (err) {
    console.warn('[Polls] Erro ao carregar enquetes salvas:', err);
    FGW.state.pollVariations = FGW.getDefaultPollVariations();
  }

  // Registra eventos dos botões de alternância de campanha
  const elements = FGW.elements || {};
  if (elements.btnCampaignTypeMessages) {
    elements.btnCampaignTypeMessages.addEventListener('click', () => {
      FGW.switchCampaignMode('messages');
    });
  }

  if (elements.btnCampaignTypePolls) {
    elements.btnCampaignTypePolls.addEventListener('click', () => {
      FGW.switchCampaignMode('polls');
    });
  }

  if (elements.btnAddPollVariation) {
    elements.btnAddPollVariation.addEventListener('click', () => {
      FGW.handleAddPollVariation();
    });
  }

  // Aplica o modo de campanha ativo inicial
  FGW.switchCampaignMode(FGW.state.campaignType, true);
};

/**
 * Salva as enquetes no localStorage
 */
FGW.savePollVariations = function() {
  try {
    localStorage.setItem(
      FGW.POLLS_STORAGE_KEYS.VARIATIONS,
      JSON.stringify(FGW.state.pollVariations || [])
    );
  } catch (err) {
    console.error('[Polls] Falha ao persistir enquetes:', err);
  }
};

/**
 * Alterna o modo de campanha entre 'messages' e 'polls'
 */
FGW.switchCampaignMode = function(mode, skipToast = false) {
  const elements = FGW.elements || {};
  FGW.state.campaignType = (mode === 'polls') ? 'polls' : 'messages';
  localStorage.setItem(FGW.POLLS_STORAGE_KEYS.CAMPAIGN_TYPE, FGW.state.campaignType);

  const isPolls = (FGW.state.campaignType === 'polls');

  // Atualiza classes dos botões seletores
  if (elements.btnCampaignTypeMessages) {
    elements.btnCampaignTypeMessages.classList.toggle('active', !isPolls);
  }
  if (elements.btnCampaignTypePolls) {
    elements.btnCampaignTypePolls.classList.toggle('active', isPolls);
  }

  // Alterna containers de edição na Etapa 3
  if (elements.containerMessagesMode) {
    elements.containerMessagesMode.classList.toggle('hidden', isPolls);
  }
  if (elements.containerPollsMode) {
    elements.containerPollsMode.classList.toggle('hidden', !isPolls);
  }

  // Atualiza resumos e badges
  if (isPolls) {
    FGW.renderPollVariations();
    FGW.updatePollsBadge();
    FGW.renderPollPreview();
  } else {
    if (FGW.renderVariations) FGW.renderVariations();
    if (FGW.updateVariationsBadge) FGW.updateVariationsBadge();
    if (FGW.updateWhatsAppPreview) FGW.updateWhatsAppPreview();
  }

  // Atualiza resumo na Etapa 4 se existir
  if (elements.summaryCampaignTypeVal) {
    elements.summaryCampaignTypeVal.textContent = isPolls ? '📊 Enquete WhatsApp' : '💬 Mensagens (Texto/Mídia)';
    elements.summaryCampaignTypeVal.className = isPolls ? 'badge-summary-mode mode-polls' : 'badge-summary-mode mode-messages';
  }

  // Se o seletor de resumo da Etapa 4 de contagem de variações existir
  if (elements.summaryVariationsCount) {
    if (isPolls) {
      elements.summaryVariationsCount.textContent = FGW.getValidPollVariations().length;
    } else {
      elements.summaryVariationsCount.textContent = FGW.getValidVariations ? FGW.getValidVariations().length : 0;
    }
  }

  if (!skipToast) {
    FGW.log(
      'INFO',
      isPolls
        ? 'Modo de Campanha alterado para: 📊 Disparo Exclusivo de Enquetes.'
        : 'Modo de Campanha alterado para: 💬 Disparo de Mensagens.',
      'info'
    );
  }
};

/**
 * Retorna as variações de enquete válidas (com título e no mínimo 2 opções preenchidas)
 */
FGW.getValidPollVariations = function() {
  const list = FGW.state.pollVariations || [];
  return list.filter(p => {
    if (!p || typeof p !== 'object') return false;
    const hasName = Boolean(p.name && String(p.name).trim().length > 0);
    const validOptions = Array.isArray(p.values)
      ? p.values.filter(v => v && String(v).trim().length > 0)
      : [];
    return hasName && validOptions.length >= 2;
  });
};

/**
 * Atualiza o badge numérico de enquetes (mínimo 3 exigidas)
 */
FGW.updatePollsBadge = function() {
  const elements = FGW.elements || {};
  if (!elements.pollsCountBadge) return;

  const validCount = FGW.getValidPollVariations().length;
  elements.pollsCountBadge.textContent = `${validCount} / mín. 3`;

  if (validCount >= 3) {
    elements.pollsCountBadge.className = 'count-badge valid';
  } else {
    elements.pollsCountBadge.className = 'count-badge warning';
  }

  // Se estiver na Etapa 4, reflete o número de variações no resumo
  if (FGW.state.campaignType === 'polls' && elements.summaryVariationsCount) {
    elements.summaryVariationsCount.textContent = validCount;
  }
};

/**
 * Adiciona uma nova variação de enquete em branco
 */
FGW.handleAddPollVariation = function() {
  const newPoll = {
    id: 'poll_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: '',
    selectableCount: 1,
    values: ['', '']
  };

  FGW.state.pollVariations.push(newPoll);
  FGW.savePollVariations();
  FGW.renderPollVariations();
  FGW.updatePollsBadge();

  // Foca no campo de pergunta da nova enquete criada
  setTimeout(() => {
    const list = document.getElementById('pollsList');
    if (list) {
      const inputs = list.querySelectorAll('.poll-question-input');
      if (inputs.length > 0) {
        const last = inputs[inputs.length - 1];
        last.focus();
        FGW.state.lastFocusedTextarea = last;
      }
    }
  }, 80);

  FGW.log('INFO', 'Nova variação de enquete adicionada.', 'info');
};

/**
 * Renderiza todos os cards de enquetes na Etapa 3
 */
FGW.renderPollVariations = function() {
  const list = document.getElementById('pollsList');
  if (!list) return;

  list.innerHTML = '';
  const variations = FGW.state.pollVariations || [];

  if (variations.length === 0) {
    list.innerHTML = `
      <div class="empty-variations-notice">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="8" y1="16" x2="14" y2="16"/>
          <line x1="8" y1="8" x2="12" y2="8"/>
        </svg>
        <p>Nenhuma variação de enquete cadastrada.</p>
        <span>Clique em "+ Adicionar Variação de Enquete" abaixo para começar.</span>
      </div>
    `;
    FGW.updatePollsBadge();
    return;
  }

  variations.forEach((poll, pIndex) => {
    const card = document.createElement('div');
    card.className = 'poll-card';
    card.dataset.index = pIndex;

    const options = Array.isArray(poll.values) ? poll.values : ['', ''];

    let optionsHtml = '';
    options.forEach((optText, oIndex) => {
      const canRemove = options.length > 2;
      optionsHtml += `
        <div class="poll-option-row">
          <span class="poll-option-num">${oIndex + 1}</span>
          <input 
            type="text" 
            class="poll-option-input" 
            data-poll-index="${pIndex}" 
            data-opt-index="${oIndex}" 
            placeholder="Opção ${oIndex + 1} (suporta {ID do Grupo}, {Nome do Grupo})" 
            value="${FGW.escapeHtml(optText || '')}"
          />
          <button 
            type="button" 
            class="btn-icon btn-remove-option ${canRemove ? '' : 'disabled'}" 
            data-poll-index="${pIndex}" 
            data-opt-index="${oIndex}" 
            title="${canRemove ? 'Remover esta opção' : 'Mínimo de 2 opções obrigatórias'}"
            ${canRemove ? '' : 'disabled'}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;
    });

    const isMultiChoice = (Number(poll.selectableCount) > 1);

    card.innerHTML = `
      <div class="poll-card-header">
        <div class="poll-card-title-wrap">
          <span class="poll-badge-num">#${pIndex + 1}</span>
          <span class="poll-card-title">Variação de Enquete</span>
        </div>
        <div class="poll-card-actions">
          <button type="button" class="btn-var-send-now" data-poll-index="${pIndex}" title="Enviar esta enquete agora para o grupo ativo">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
            <span>Enviar ao Grupo</span>
          </button>
          <button type="button" class="btn-icon btn-duplicate-poll" data-poll-index="${pIndex}" title="Duplicar esta variação">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button type="button" class="btn-icon btn-delete-poll" data-poll-index="${pIndex}" title="Excluir esta variação">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="poll-card-body">
        <!-- Campo da Pergunta / Título -->
        <div class="poll-field-group">
          <label class="poll-label">
            <span>Pergunta da Enquete</span>
            <span class="poll-tag-tip">Aceita {ID do Grupo}, {Nome do Grupo}</span>
          </label>
          <textarea 
            class="poll-question-input" 
            data-poll-index="${pIndex}" 
            rows="2" 
            placeholder="Digite a pergunta da enquete para o WhatsApp..."
          >${FGW.escapeHtml(poll.name || '')}</textarea>
        </div>

        <!-- Tipo de Seleção (Única vs Múltipla) -->
        <div class="poll-type-select-wrap">
          <label class="poll-label-inline">Permitir seleção:</label>
          <div class="poll-choice-radios">
            <label class="poll-radio-item">
              <input type="radio" name="poll_choice_${pIndex}" value="1" ${!isMultiChoice ? 'checked' : ''} data-poll-index="${pIndex}">
              <span>Resposta Única (1 opção)</span>
            </label>
            <label class="poll-radio-item">
              <input type="radio" name="poll_choice_${pIndex}" value="multiple" ${isMultiChoice ? 'checked' : ''} data-poll-index="${pIndex}">
              <span>Múltipla Escolha</span>
            </label>
          </div>
        </div>

        <!-- Opções de Resposta -->
        <div class="poll-options-section">
          <label class="poll-label">Opções de Resposta (mínimo 2, até 12):</label>
          <div class="poll-options-list" data-poll-index="${pIndex}">
            ${optionsHtml}
          </div>
          ${options.length < 12 ? `
            <button type="button" class="btn btn-sm btn-outline-dashed btn-add-option" data-poll-index="${pIndex}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>+ Adicionar Opção</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    list.appendChild(card);
  });

  FGW.attachPollEvents(list);
  FGW.updatePollsBadge();
};

/**
 * Associa eventos de digitação, clique e foco aos inputs de enquete
 */
FGW.attachPollEvents = function(container) {
  // 0. Botão Enviar Enquete ao Grupo Ativo Agora
  container.querySelectorAll('.btn-var-send-now').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pIndex = parseInt(btn.dataset.pollIndex, 10);
      if (FGW.handleSendPollToActiveGroup) {
        await FGW.handleSendPollToActiveGroup(pIndex, btn);
      }
    });
  });

  // 1. Inputs de pergunta
  container.querySelectorAll('.poll-question-input').forEach(textarea => {
    textarea.addEventListener('focus', function() {
      FGW.state.lastFocusedTextarea = this;
      const idx = parseInt(this.dataset.pollIndex, 10);
      if (!isNaN(idx)) {
        FGW.state.previewPollIndex = idx;
        FGW.renderPollPreview();
      }
    });

    textarea.addEventListener('input', function() {
      const pIndex = parseInt(this.dataset.pollIndex, 10);
      if (FGW.state.pollVariations[pIndex]) {
        FGW.state.pollVariations[pIndex].name = this.value;
        FGW.savePollVariations();
        FGW.updatePollsBadge();
        FGW.renderPollPreview();
      }
    });
  });

  // 2. Inputs de opções
  container.querySelectorAll('.poll-option-input').forEach(input => {
    input.addEventListener('focus', function() {
      FGW.state.lastFocusedTextarea = this;
      const idx = parseInt(this.dataset.pollIndex, 10);
      if (!isNaN(idx)) {
        FGW.state.previewPollIndex = idx;
        FGW.renderPollPreview();
      }
    });

    input.addEventListener('input', function() {
      const pIndex = parseInt(this.dataset.pollIndex, 10);
      const oIndex = parseInt(this.dataset.optIndex, 10);
      if (FGW.state.pollVariations[pIndex] && Array.isArray(FGW.state.pollVariations[pIndex].values)) {
        FGW.state.pollVariations[pIndex].values[oIndex] = this.value;
        FGW.savePollVariations();
        FGW.updatePollsBadge();
        FGW.renderPollPreview();
      }
    });
  });

  // 3. Seleção de modo único ou múltiplo
  container.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const pIndex = parseInt(this.dataset.pollIndex, 10);
      if (FGW.state.pollVariations[pIndex]) {
        if (this.value === 'multiple') {
          const count = (FGW.state.pollVariations[pIndex].values || []).length;
          FGW.state.pollVariations[pIndex].selectableCount = Math.max(1, count);
        } else {
          FGW.state.pollVariations[pIndex].selectableCount = 1;
        }
        FGW.savePollVariations();
        FGW.renderPollPreview();
      }
    });
  });

  // 4. Botão Adicionar Opção
  container.querySelectorAll('.btn-add-option').forEach(btn => {
    btn.addEventListener('click', function() {
      const pIndex = parseInt(this.dataset.pollIndex, 10);
      const poll = FGW.state.pollVariations[pIndex];
      if (poll && Array.isArray(poll.values) && poll.values.length < 12) {
        poll.values.push('');
        FGW.savePollVariations();
        FGW.renderPollVariations();
        FGW.renderPollPreview();

        setTimeout(() => {
          const list = document.getElementById('pollsList');
          if (list) {
            const card = list.querySelector(`.poll-card[data-index="${pIndex}"]`);
            if (card) {
              const optInputs = card.querySelectorAll('.poll-option-input');
              if (optInputs.length > 0) {
                const last = optInputs[optInputs.length - 1];
                last.focus();
                FGW.state.lastFocusedTextarea = last;
              }
            }
          }
        }, 50);
      }
    });
  });

  // 5. Botão Remover Opção
  container.querySelectorAll('.btn-remove-option').forEach(btn => {
    btn.addEventListener('click', function() {
      const pIndex = parseInt(this.dataset.pollIndex, 10);
      const oIndex = parseInt(this.dataset.optIndex, 10);
      const poll = FGW.state.pollVariations[pIndex];
      if (poll && Array.isArray(poll.values) && poll.values.length > 2) {
        poll.values.splice(oIndex, 1);
        if (poll.selectableCount > poll.values.length) {
          poll.selectableCount = poll.values.length;
        }
        FGW.savePollVariations();
        FGW.renderPollVariations();
        FGW.renderPollPreview();
      }
    });
  });

  // 6. Botão Duplicar Variação
  container.querySelectorAll('.btn-duplicate-poll').forEach(btn => {
    btn.addEventListener('click', function() {
      const pIndex = parseInt(this.dataset.pollIndex, 10);
      const poll = FGW.state.pollVariations[pIndex];
      if (poll) {
        const clone = JSON.parse(JSON.stringify(poll));
        clone.id = 'poll_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        FGW.state.pollVariations.splice(pIndex + 1, 0, clone);
        FGW.savePollVariations();
        FGW.renderPollVariations();
        FGW.updatePollsBadge();
        FGW.log('INFO', 'Variação de enquete duplicada.', 'info');
      }
    });
  });

  // 7. Botão Excluir Variação
  container.querySelectorAll('.btn-delete-poll').forEach(btn => {
    btn.addEventListener('click', function() {
      const pIndex = parseInt(this.dataset.pollIndex, 10);
      if (confirm(`Deseja realmente remover a Variação de Enquete #${pIndex + 1}?`)) {
        FGW.state.pollVariations.splice(pIndex, 1);
        if (FGW.state.previewPollIndex >= FGW.state.pollVariations.length) {
          FGW.state.previewPollIndex = Math.max(0, FGW.state.pollVariations.length - 1);
        }
        FGW.savePollVariations();
        FGW.renderPollVariations();
        FGW.updatePollsBadge();
        FGW.renderPollPreview();
        FGW.log('INFO', 'Variação de enquete removida.', 'info');
      }
    });
  });
};

/**
 * Aplica substituição de tags dinâmicas ({ID do Grupo}, {Nome do Grupo}, etc.)
 * tanto na pergunta quanto em todas as opções da enquete para o grupo especificado.
 */
FGW.applyDynamicTagsToPoll = function(poll, group) {
  if (!poll) return null;

  const processedName = FGW.applyDynamicTags(poll.name || '', group);
  const cleanOptions = Array.isArray(poll.values)
    ? poll.values
        .map(v => FGW.applyDynamicTags(String(v || ''), group).trim())
        .filter(Boolean)
    : [];

  const selectable = Math.max(1, parseInt(poll.selectableCount, 10) || 1);

  return {
    id: poll.id,
    name: processedName || 'Enquete FlashGroup',
    selectableCount: (selectable > cleanOptions.length) ? cleanOptions.length : selectable,
    values: cleanOptions
  };
};

/**
 * Renderiza o balão estilo WhatsApp da Enquete no preview mobile
 */
FGW.renderPollPreview = function() {
  if (FGW.state.campaignType !== 'polls') return;

  const plannedWrapper = document.getElementById('waPlannedBubbleWrapper');
  if (!plannedWrapper) return;

  const validPolls = FGW.state.pollVariations || [];
  if (validPolls.length === 0) {
    plannedWrapper.innerHTML = `
      <div class="wa-bubble-empty">
        <p>Nenhuma enquete cadastrada para visualização.</p>
      </div>
    `;
    return;
  }

  const index = Math.min(
    Math.max(0, FGW.state.previewPollIndex || 0),
    validPolls.length - 1
  );
  const rawPoll = validPolls[index];

  // Grupo simulado para visualização das variáveis
  const sampleGroup = (Array.isArray(FGW.state.groups) && FGW.state.groups.length > 0)
    ? FGW.state.groups[0]
    : { id: '120363@g.us', subject: 'Grupo VIP Exemplo', customId: 'Grupo #01' };

  const processed = FGW.applyDynamicTagsToPoll(rawPoll, sampleGroup);
  const isMulti = (processed.selectableCount > 1);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let optionsHtml = '';
  processed.values.forEach((optText, oIdx) => {
    optionsHtml += `
      <div class="wa-poll-preview-option">
        <div class="wa-poll-circle ${isMulti ? 'checkbox-shape' : ''}"></div>
        <span class="wa-poll-option-label">${FGW.escapeHtml(optText || `Opção ${oIdx + 1}`)}</span>
      </div>
    `;
  });

  plannedWrapper.innerHTML = `
    <div class="wa-chat-bubble planned-poll-bubble">
      <div class="wa-poll-preview-card">
        <div class="wa-poll-header-row">
          <div class="wa-poll-icon-wrap">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <span class="wa-poll-type-badge">${isMulti ? 'Múltipla Escolha' : 'Voto Único'}</span>
        </div>

        <h4 class="wa-poll-preview-title">${FGW.escapeHtml(processed.name || 'Título da Enquete')}</h4>
        <span class="wa-poll-hint-sub">${isMulti ? 'Selecione uma ou mais opções' : 'Selecione uma opção'}</span>

        <div class="wa-poll-options-container">
          ${optionsHtml}
        </div>

        <div class="wa-poll-footer-row">
          <span class="wa-poll-btn-fake">Votar</span>
          <div class="wa-bubble-meta">
            <span class="bubble-time">${timeStr}</span>
            <span class="bubble-check">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="#53bdeb">
                <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4 0a.5.5 0 0 0-.708-.708L2 9.293l.646.647 5.708-5.586z"/>
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Atualiza indicador da variação no topo do preview
  const indicator = document.getElementById('previewVariationIndicator');
  if (indicator) {
    indicator.textContent = `Enquete #${index + 1} de ${validPolls.length}`;
  }
};

/**
 * Envia uma variação de enquete individual diretamente para o grupo ativo/selecionado
 */
FGW.handleSendPollToActiveGroup = async function(pollIndex, btnElement) {
  const elements = FGW.elements || {};
  const poll = FGW.state.pollVariations ? FGW.state.pollVariations[pollIndex] : null;
  if (!poll) return;

  const cleanValues = (poll.values || []).map(v => String(v).trim()).filter(Boolean);
  if (!poll.name || !poll.name.trim() || cleanValues.length < 2) {
    alert('Preencha a pergunta e pelo menos 2 opções válidas antes de enviar.');
    return;
  }

  const isConnected = FGW.state.connectionStatus === 'connected' ||
    (elements.connectionStatusBadge && elements.connectionStatusBadge.classList.contains('connected')) ||
    (elements.chatConnectedState && !elements.chatConnectedState.classList.contains('hidden'));

  const instanceName = (elements.instanceName && elements.instanceName.value.trim())
    || FGW.state.activeInstanceName
    || localStorage.getItem(FGW.STORAGE_KEYS?.INSTANCE_NAME);

  if (!isConnected || !instanceName) {
    alert('Conecte o WhatsApp para enviar esta enquete.');
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

  const processedPoll = FGW.applyDynamicTagsToPoll(poll, targetGroup);

  const originalContent = btnElement ? btnElement.innerHTML : '';
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = `
      <svg class="spin" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"/>
      </svg>
      <span>Enviando...</span>
    `;
  }

  FGW.log('INFO', `Enviando enquete individual "${processedPoll.name}" para o grupo "${targetName}"...`, 'info');

  try {
    const result = await window.electronAPI.sendPoll({
      instanceName,
      number: targetGroup.id,
      name: processedPoll.name,
      selectableCount: processedPoll.selectableCount,
      values: processedPoll.values,
      delay: 1000
    });

    if (result && result.success) {
      FGW.log('SUCESSO', `Enquete enviada com sucesso para "${targetName}"!`, 'success');

      if (btnElement) {
        btnElement.classList.add('is-sent-success');
        btnElement.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Enviada!</span>
        `;
      }

      // Adiciona mensagem ao chat em tempo real se disponível
      if (FGW.addRealChatMessage) {
        FGW.addRealChatMessage(targetGroup.id, {
          id: result.data?.key?.id || ('poll_' + Date.now()),
          fromMe: true,
          pushName: 'Você (Enquete)',
          text: `📊 ${processedPoll.name}\n${processedPoll.values.map(opt => `• ${opt}`).join('\n')}`,
          timestamp: Date.now(),
          status: 'SENT'
        });
      }

      setTimeout(() => {
        if (btnElement) {
          btnElement.classList.remove('is-sent-success');
          btnElement.innerHTML = originalContent;
          btnElement.disabled = false;
        }
      }, 2500);
    } else {
      const errMsg = result?.error || 'Erro no envio da enquete.';
      FGW.log('ERRO', `Falha ao enviar enquete para "${targetName}": ${errMsg}`, 'error');
      alert(`Falha ao enviar enquete:\n\n${errMsg}`);
      if (btnElement) {
        btnElement.innerHTML = originalContent;
        btnElement.disabled = false;
      }
    }
  } catch (err) {
    const errTxt = err.message || String(err);
    FGW.log('ERRO', `Exceção ao enviar enquete para "${targetName}": ${errTxt}`, 'error');
    alert(`Erro inesperado:\n\n${errTxt}`);
    if (btnElement) {
      btnElement.innerHTML = originalContent;
      btnElement.disabled = false;
    }
  }
};
