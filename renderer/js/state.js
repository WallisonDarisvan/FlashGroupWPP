/**
 * FlashGroup WPP - Módulo: State & DOM Elements
 * Centraliza o estado reativo da aplicação e as referências do DOM.
 */

window.FGW = window.FGW || {};

FGW.state = {
  currentStep: 1, // Etapa ativa (1, 2, 3 ou 4)
  groups: [], // Lista de grupos carregados da Evolution API
  selectedGroupIds: new Set(), // IDs dos grupos selecionados
  groupCustomTags: {}, // Mapeamento { [groupId]: 'Identificação personalizada' } ({ID do Grupo})
  customVariables: [], // Lista de variáveis: [{ name: 'Link', type: 'group'|'global', defaultValue: '' }]
  groupCustomVars: {}, // Mapeamento { [groupId]: { [varName]: 'valor' } }
  activeMessageScope: '__global__', // '__global__' ou groupId selecionado
  groupCustomVariations: {}, // { [groupId]: { enabled: boolean, variations: Array<{ text: string, media: object|null }> } }
  messageVariations: [], // Lista geral de { text: string, media: object | null }
  previewVariationIndex: 0, // Índice da variação atualmente exibida no preview mobile
  lastFocusedTextarea: null, // Textarea atualmente ou recentemente focado
  isDispatching: false, // Flag de execução do disparo
  cancelRequested: false, // Flag para interromper disparos
  qrPollingInterval: null, // Intervalo de polling da conexão WhatsApp
  stats: {
    total: 0,
    success: 0,
    failed: 0,
    remaining: 0
  }
};

FGW.initElements = function() {
  FGW.elements = {
    // Stepper & Navegação
    stepperNav: document.getElementById('stepperNav'),
    stepTabs: document.querySelectorAll('.step-tab'),
    stepPanels: document.querySelectorAll('.step-panel'),
    stepGroupsSub: document.getElementById('stepGroupsSub'),
    stepVariationsSub: document.getElementById('stepVariationsSub'),

    // Botões de Avanço / Retrocesso entre Etapas
    btnGoToStep2: document.getElementById('btnGoToStep2'),
    btnBackToStep1: document.getElementById('btnBackToStep1'),
    btnGoToStep3: document.getElementById('btnGoToStep3'),
    btnBackToStep2: document.getElementById('btnBackToStep2'),
    btnGoToStep4: document.getElementById('btnGoToStep4'),
    btnBackToStep3: document.getElementById('btnBackToStep3'),

    // Status no Topo
    connectionStatusBadge: document.getElementById('connectionStatusBadge'),
    connectionStatusText: document.getElementById('connectionStatusText'),
    executionStateBadge: document.getElementById('executionStateBadge'),
    executionStateText: document.getElementById('executionStateText'),

    // Etapa 1: Conexão
    instanceName: document.getElementById('instanceName'),
    btnOpenQrModal: document.getElementById('btnOpenQrModal'),
    btnConnect: document.getElementById('btnConnect'),
    btnDeleteInstance: document.getElementById('btnDeleteInstance'),
    qrSpinner: document.getElementById('qrSpinner'),
    qrLoadingText: document.getElementById('qrLoadingText'),
    qrCodeWrapper: document.getElementById('qrCodeWrapper'),
    qrCodeImg: document.getElementById('qrCodeImg'),
    qrExpiredOverlay: document.getElementById('qrExpiredOverlay'),
    btnRefreshQr: document.getElementById('btnRefreshQr'),
    pairingCodeArea: document.getElementById('pairingCodeArea'),
    pairingCodeValue: document.getElementById('pairingCodeValue'),
    qrConnectionStatus: document.getElementById('qrConnectionStatus'),
    qrStatusLabel: document.getElementById('qrStatusLabel'),
    connectionFormState: document.getElementById('connectionFormState'),
    connectionActiveState: document.getElementById('connectionActiveState'),
    connectedInstanceTitle: document.getElementById('connectedInstanceTitle'),
    btnActiveDisconnect: document.getElementById('btnActiveDisconnect'),
    btnActiveGoToGroups: document.getElementById('btnActiveGoToGroups'),
    stage1NormalFooter: document.getElementById('stage1NormalFooter'),

    // Etapa 2: Grupos
    searchGroupInput: document.getElementById('searchGroupInput'),
    btnSelectAll: document.getElementById('btnSelectAll'),
    btnSelectRandom20: document.getElementById('btnSelectRandom20'),
    btnClearSelection: document.getElementById('btnClearSelection'),
    btnReloadGroupsStep2: document.getElementById('btnReloadGroupsStep2'),
    btnManageVarsStep2: document.getElementById('btnManageVarsStep2'),
    masterCheckbox: document.getElementById('masterCheckbox'),
    selectionCounter: document.getElementById('selectionCounter'),
    totalGroupsCounter: document.getElementById('totalGroupsCounter'),
    groupsTable: document.getElementById('groupsTable'),
    groupsTableHeaderRow: document.querySelector('#groupsTable thead tr'),
    groupsTableBody: document.getElementById('groupsTableBody'),

    // Etapa 3: Variações & Delays
    variationScopeSelector: document.getElementById('variationScopeSelector'),
    scopeGroupStatusBox: document.getElementById('scopeGroupStatusBox'),
    chkEnableGroupCustomVars: document.getElementById('chkEnableGroupCustomVars'),
    btnCopyGlobalToGroup: document.getElementById('btnCopyGlobalToGroup'),
    variationsList: document.getElementById('variationsList'),
    btnAddVariation: document.getElementById('btnAddVariation'),
    variationsCountBadge: document.getElementById('variationsCountBadge'),
    btnInsertGroupIdTag: document.getElementById('btnInsertGroupIdTag'),
    btnOpenVariablesManager: document.getElementById('btnOpenVariablesManager'),
    dynamicTagsChipsContainer: document.getElementById('dynamicTagsChipsContainer'),
    minDelay: document.getElementById('minDelay'),
    maxDelay: document.getElementById('maxDelay'),
    presenceDelay: document.getElementById('presenceDelay'),
    btnOpenDelaysModal: document.getElementById('btnOpenDelaysModal'),
    btnOpenDelaysModalSide: document.getElementById('btnOpenDelaysModalSide'),
    delayBadgeVal: document.getElementById('delayBadgeVal'),
    sideDelayPill: document.getElementById('sideDelayPill'),
    delaysModal: document.getElementById('delaysModal'),
    btnCloseDelaysModal: document.getElementById('btnCloseDelaysModal'),
    btnSaveDelaysModal: document.getElementById('btnSaveDelaysModal'),
    btnResetDefaultDelays: document.getElementById('btnResetDefaultDelays'),

    // WhatsApp Mobile Preview
    previewVariationIndicator: document.getElementById('previewVariationIndicator'),
    waPreviewTargetName: document.getElementById('waPreviewTargetName'),
    waPreviewTargetStatus: document.getElementById('waPreviewTargetStatus'),
    waMessageBubble: document.getElementById('waMessageBubble'),
    waPreviewMediaContainer: document.getElementById('waPreviewMediaContainer'),
    waPreviewImage: document.getElementById('waPreviewImage'),
    waPreviewVideoBox: document.getElementById('waPreviewVideoBox'),
    waPreviewVideoName: document.getElementById('waPreviewVideoName'),
    waPreviewDocBox: document.getElementById('waPreviewDocBox'),
    waPreviewDocName: document.getElementById('waPreviewDocName'),
    waPreviewDocMeta: document.getElementById('waPreviewDocMeta'),
    waPreviewText: document.getElementById('waPreviewText'),
    waMessageTime: document.getElementById('waMessageTime'),
    phoneStatusTime: document.getElementById('phoneStatusTime'),

    // Modal: Gerenciador de Variáveis Dinâmicas
    variablesModal: document.getElementById('variablesModal'),
    btnCloseVariablesModal: document.getElementById('btnCloseVariablesModal'),
    btnCloseVariablesModalBtn: document.getElementById('btnCloseVariablesModalBtn'),
    newVarName: document.getElementById('newVarName'),
    newVarType: document.getElementById('newVarType'),
    newVarDefaultValue: document.getElementById('newVarDefaultValue'),
    lblVarDefaultValue: document.getElementById('lblVarDefaultValue'),
    varTypeHint: document.getElementById('varTypeHint'),
    newVarTagPreview: document.getElementById('newVarTagPreview'),
    btnSaveNewVariable: document.getElementById('btnSaveNewVariable'),
    totalVarsBadge: document.getElementById('totalVarsBadge'),
    variablesListContainer: document.getElementById('variablesListContainer'),

    // Etapa 4: Disparo & Resumo
    summaryGroupsCount: document.getElementById('summaryGroupsCount'),
    summaryVariationsCount: document.getElementById('summaryVariationsCount'),
    summaryIntervalVal: document.getElementById('summaryIntervalVal'),
    summaryConnectionVal: document.getElementById('summaryConnectionVal'),
    btnStartDispatch: document.getElementById('btnStartDispatch'),
    btnCancelDispatch: document.getElementById('btnCancelDispatch'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressPercentage: document.getElementById('progressPercentage'),
    statTotal: document.getElementById('statTotal'),
    statSuccess: document.getElementById('statSuccess'),
    statFailed: document.getElementById('statFailed'),
    statRemaining: document.getElementById('statRemaining'),
    terminalLogs: document.getElementById('terminalLogs'),
    btnClearLogs: document.getElementById('btnClearLogs')
  };
  return FGW.elements;
};

FGW.escapeHtml = function(string) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(string).replace(/[&<>"']/g, s => entityMap[s]);
};

FGW.escapeRegex = function(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
