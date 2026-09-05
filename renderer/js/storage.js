/**
 * FlashGroup WPP - Módulo: Storage
 * Gerencia a persistência no localStorage (configurações, cache de grupos e variações).
 */

window.FGW = window.FGW || {};

FGW.STORAGE_KEYS = {
  INSTANCE_NAME: 'fgw_instance_name',
  MIN_DELAY: 'fgw_min_delay',
  MAX_DELAY: 'fgw_max_delay',
  PRESENCE_DELAY: 'fgw_presence_delay',
  VARIATIONS: 'fgw_message_variations',
  GROUP_CUSTOM_TAGS: 'fgw_group_custom_tags',
  CUSTOM_VARIABLES: 'fgw_custom_variables',
  GROUP_CUSTOM_VARS: 'fgw_group_custom_vars',
  CACHED_GROUPS: 'fgw_cached_groups',
  SELECTED_GROUP_IDS: 'fgw_selected_group_ids',
  GROUP_CUSTOM_VARIATIONS: 'fgw_group_custom_variations',
  REAL_MESSAGES: 'fgw_real_chat_messages'
};

FGW.setDefaultVariations = function() {
  FGW.state.messageVariations = [
    { text: 'Olá {ID do Grupo}! Passando para compartilhar uma super novidade com vocês.', media: null },
    { text: 'Opa membros do {ID do Grupo}, tudo bem? Vejam só essa oportunidade!', media: null },
    { text: 'Atenção {ID do Grupo}: recado importante e exclusivo para vocês hoje.', media: null }
  ];
};

/**
 * IndexedDB para persistência segura e isolada da instância por aplicativo
 */
FGW.initIndexedDB = function() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('FlashGroupWPP_InstanceDB', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('app_instance')) {
          db.createObjectStore('app_instance', { keyPath: 'key' });
        }
      };
      request.onsuccess = (e) => {
        FGW.db = e.target.result;
        resolve(FGW.db);
      };
      request.onerror = (e) => {
        console.warn('[IndexedDB] Falha ao abrir banco:', e.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('[IndexedDB] Exceção:', err);
      resolve(null);
    }
  });
};

FGW.saveToIndexedDB = async function(key, value) {
  try {
    if (!FGW.db) await FGW.initIndexedDB();
    if (!FGW.db) return false;
    return new Promise((resolve) => {
      const tx = FGW.db.transaction('app_instance', 'readwrite');
      const store = tx.objectStore('app_instance');
      store.put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn(`[IndexedDB] Erro ao salvar chave "${key}":`, e.target.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Exceção ao salvar chave "${key}":`, err);
    return false;
  }
};

FGW.loadFromIndexedDB = async function(key) {
  try {
    if (!FGW.db) await FGW.initIndexedDB();
    if (!FGW.db) return null;
    return new Promise((resolve) => {
      const tx = FGW.db.transaction('app_instance', 'readonly');
      const store = tx.objectStore('app_instance');
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.value !== undefined) {
          resolve(req.result.value);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Exceção ao carregar chave "${key}":`, err);
    return null;
  }
};

FGW.deleteFromIndexedDB = async function(key) {
  try {
    if (!FGW.db) await FGW.initIndexedDB();
    if (!FGW.db) return false;
    return new Promise((resolve) => {
      const tx = FGW.db.transaction('app_instance', 'readwrite');
      const store = tx.objectStore('app_instance');
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Exceção ao deletar chave "${key}":`, err);
    return false;
  }
};

FGW.saveInstanceNameToIndexedDB = async function(instanceName) {
  const name = (instanceName || '').trim();
  if (!name) return;
  try { localStorage.setItem(FGW.STORAGE_KEYS.INSTANCE_NAME, name); } catch (e) {}
  return FGW.saveToIndexedDB('instanceName', name);
};

FGW.loadInstanceNameFromIndexedDB = async function() {
  const idbVal = await FGW.loadFromIndexedDB('instanceName');
  if (idbVal) return idbVal;
  return localStorage.getItem(FGW.STORAGE_KEYS.INSTANCE_NAME) || '';
};

FGW.deleteInstanceNameFromIndexedDB = async function() {
  try { localStorage.removeItem(FGW.STORAGE_KEYS.INSTANCE_NAME); } catch (e) {}
  return FGW.deleteFromIndexedDB('instanceName');
};

/**
 * Persiste as variações de mensagem (incluindo mídias/vídeos pesados em Base64) no IndexedDB
 */
FGW.saveVariationsToIndexedDB = async function(variations) {
  const list = Array.isArray(variations) ? variations : FGW.state.messageVariations;
  return FGW.saveToIndexedDB('messageVariations', list);
};

/**
 * Carrega as variações do IndexedDB com fallback e migração transparente do localStorage
 */
FGW.loadVariationsFromIndexedDB = async function() {
  const idbVars = await FGW.loadFromIndexedDB('messageVariations');
  if (Array.isArray(idbVars) && idbVars.length > 0) {
    return idbVars;
  }

  // Migração transparente do localStorage para o IndexedDB
  try {
    const raw = localStorage.getItem(FGW.STORAGE_KEYS.VARIATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await FGW.saveVariationsToIndexedDB(parsed);
        return parsed;
      }
    }
  } catch (e) {}

  return null;
};

/**
 * Persiste as variações customizadas por grupo no IndexedDB
 */
FGW.saveGroupCustomVariationsToIndexedDB = async function(groupVars) {
  const data = groupVars || FGW.state.groupCustomVariations || {};
  return FGW.saveToIndexedDB('groupCustomVariations', data);
};

/**
 * Carrega as variações customizadas por grupo do IndexedDB
 */
FGW.loadGroupCustomVariationsFromIndexedDB = async function() {
  const idbData = await FGW.loadFromIndexedDB('groupCustomVariations');
  if (idbData && typeof idbData === 'object') {
    return idbData;
  }

  // Migração transparente do localStorage para o IndexedDB
  try {
    const raw = localStorage.getItem(FGW.STORAGE_KEYS.GROUP_CUSTOM_VARIATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        await FGW.saveGroupCustomVariationsToIndexedDB(parsed);
        return parsed;
      }
    }
  } catch (e) {}

  return null;
};

FGW.generateMachineInstanceName = function() {
  const rand = Math.random().toString(36).substring(2, 7);
  return `fgw-${rand}`;
};

FGW.loadSavedSettings = function() {
  const state = FGW.state;
  const elements = FGW.elements || {};
  const KEYS = FGW.STORAGE_KEYS;

  const savedInstance = localStorage.getItem(KEYS.INSTANCE_NAME);
  if (savedInstance && elements.instanceName) {
    elements.instanceName.value = savedInstance;
  }

  if (elements.minDelay) elements.minDelay.value = localStorage.getItem(KEYS.MIN_DELAY) || 20;
  if (elements.maxDelay) elements.maxDelay.value = localStorage.getItem(KEYS.MAX_DELAY) || 50;
  if (elements.presenceDelay) elements.presenceDelay.value = localStorage.getItem(KEYS.PRESENCE_DELAY) || 1200;

  try {
    const savedCustomTags = localStorage.getItem(KEYS.GROUP_CUSTOM_TAGS);
    if (savedCustomTags) {
      state.groupCustomTags = JSON.parse(savedCustomTags) || {};
    }
  } catch (e) {
    state.groupCustomTags = {};
  }

  try {
    const savedCustomVars = localStorage.getItem(KEYS.CUSTOM_VARIABLES);
    if (savedCustomVars) {
      const parsedVars = JSON.parse(savedCustomVars);
      if (Array.isArray(parsedVars)) {
        state.customVariables = parsedVars;
      }
    }
  } catch (e) {
    state.customVariables = [];
  }

  try {
    const savedGroupCustomVars = localStorage.getItem(KEYS.GROUP_CUSTOM_VARS);
    if (savedGroupCustomVars) {
      state.groupCustomVars = JSON.parse(savedGroupCustomVars) || {};
    }
  } catch (e) {
    state.groupCustomVars = {};
  }

  try {
    const savedGroups = localStorage.getItem(KEYS.CACHED_GROUPS);
    if (savedGroups) {
      const parsedGroups = JSON.parse(savedGroups);
      if (Array.isArray(parsedGroups) && parsedGroups.length > 0) {
        state.groups = parsedGroups.map(g => ({
          ...g,
          customId: state.groupCustomTags[g.id] || g.customId || ''
        }));
      }
    }
  } catch (e) {
    state.groups = [];
  }

  try {
    const savedSelected = localStorage.getItem(KEYS.SELECTED_GROUP_IDS);
    if (savedSelected) {
      const parsed = JSON.parse(savedSelected);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.selectedGroupIds = new Set(parsed);
      } else {
        state.selectedGroupIds = new Set();
      }
    } else {
      state.selectedGroupIds = new Set();
    }
  } catch (e) {
    state.selectedGroupIds = new Set();
  }

  try {
    const savedGroupVars = localStorage.getItem(KEYS.GROUP_CUSTOM_VARIATIONS);
    if (savedGroupVars) {
      state.groupCustomVariations = JSON.parse(savedGroupVars) || {};
    }
  } catch (e) {
    state.groupCustomVariations = {};
  }

  try {
    const savedVariations = localStorage.getItem(KEYS.VARIATIONS);
    if (savedVariations) {
      const parsed = JSON.parse(savedVariations);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.messageVariations = parsed.map(item => {
          if (typeof item === 'string') {
            return { text: item, media: null, mediaEnabled: true };
          }
          return {
            text: item?.text || '',
            media: item?.media || null,
            mediaEnabled: item?.mediaEnabled !== false
          };
        });
      } else {
        FGW.setDefaultVariations();
      }
    } else {
      FGW.setDefaultVariations();
    }
  } catch (e) {
    FGW.setDefaultVariations();
  }

  // Carrega histórico de mensagens reais do chat
  try {
    const savedMessages = localStorage.getItem(KEYS.REAL_MESSAGES);
    if (savedMessages) {
      FGW.state.realMessages = JSON.parse(savedMessages) || {};
    } else {
      FGW.state.realMessages = FGW.state.realMessages || {};
    }
  } catch (e) {
    FGW.state.realMessages = FGW.state.realMessages || {};
  }
};

FGW.saveSettings = function() {
  try {
    const elements = FGW.elements || {};
    const KEYS = FGW.STORAGE_KEYS;
    if (elements.instanceName) {
      const val = elements.instanceName.value.trim();
      try { localStorage.setItem(KEYS.INSTANCE_NAME, val); } catch (e) {}
      if (val && FGW.saveInstanceNameToIndexedDB) {
        FGW.saveInstanceNameToIndexedDB(val);
      }
    }
    if (elements.minDelay) {
      try { localStorage.setItem(KEYS.MIN_DELAY, elements.minDelay.value); } catch (e) {}
    }
    if (elements.maxDelay) {
      try { localStorage.setItem(KEYS.MAX_DELAY, elements.maxDelay.value); } catch (e) {}
    }
    if (elements.presenceDelay) {
      try { localStorage.setItem(KEYS.PRESENCE_DELAY, elements.presenceDelay.value); } catch (e) {}
    }
    try {
      localStorage.setItem(KEYS.VARIATIONS, JSON.stringify(FGW.state.messageVariations));
    } catch (quotaErr) {
      // Ignora erro de cota no localStorage, pois os vídeos pesados são persistidos com sucesso no IndexedDB
    }

    // Persistência robusta no IndexedDB (sem limite de 5MB)
    if (FGW.saveVariationsToIndexedDB) {
      FGW.saveVariationsToIndexedDB(FGW.state.messageVariations);
    }

    if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
  } catch (err) {
    console.warn('[Storage] Falha em saveSettings:', err);
  }
};

FGW.saveGroupCustomTags = function() {
  try {
    localStorage.setItem(FGW.STORAGE_KEYS.GROUP_CUSTOM_TAGS, JSON.stringify(FGW.state.groupCustomTags));
  } catch (e) {
    console.warn('[Storage] Falha em saveGroupCustomTags:', e);
  }
};

FGW.saveCustomVariables = function() {
  try {
    localStorage.setItem(FGW.STORAGE_KEYS.CUSTOM_VARIABLES, JSON.stringify(FGW.state.customVariables));
  } catch (e) {
    console.warn('[Storage] Falha em saveCustomVariables:', e);
  }
};

FGW.saveGroupCustomVars = function() {
  try {
    localStorage.setItem(FGW.STORAGE_KEYS.GROUP_CUSTOM_VARS, JSON.stringify(FGW.state.groupCustomVars));
  } catch (e) {
    console.warn('[Storage] Falha em saveGroupCustomVars:', e);
  }
};

FGW.saveSelectedGroupIds = function() {
  try {
    localStorage.setItem(FGW.STORAGE_KEYS.SELECTED_GROUP_IDS, JSON.stringify(Array.from(FGW.state.selectedGroupIds)));
  } catch (e) {
    console.warn('[Storage] Falha em saveSelectedGroupIds:', e);
  }
};

FGW.saveCachedGroups = function() {
  try {
    localStorage.setItem(FGW.STORAGE_KEYS.CACHED_GROUPS, JSON.stringify(FGW.state.groups));
  } catch (e) {
    console.warn('[Storage] Falha em saveCachedGroups:', e);
  }
};

FGW.saveGroupCustomVariations = function() {
  try {
    localStorage.setItem(FGW.STORAGE_KEYS.GROUP_CUSTOM_VARIATIONS, JSON.stringify(FGW.state.groupCustomVariations));
  } catch (e) {
    // Ignora erro de cota no localStorage
  }

  // Persistência robusta no IndexedDB
  if (FGW.saveGroupCustomVariationsToIndexedDB) {
    FGW.saveGroupCustomVariationsToIndexedDB(FGW.state.groupCustomVariations);
  }
};

/**
 * Salva o histórico de mensagens reais por grupo de forma segura e leve
 */
FGW.saveRealMessages = function() {
  const KEYS = FGW.STORAGE_KEYS;
  try {
    const dataToSave = {};
    const messagesByGroup = FGW.state.realMessages || {};
    // Salva até 50 mensagens recentes por grupo, removendo thumbnails pesados em base64
    for (const [gid, msgs] of Object.entries(messagesByGroup)) {
      if (Array.isArray(msgs) && msgs.length > 0) {
        dataToSave[gid] = msgs.slice(-50).map(m => {
          if (m.mediaDetails && m.mediaDetails.jpegThumbnail) {
            const { jpegThumbnail, ...cleanDetails } = m.mediaDetails;
            return { ...m, mediaDetails: cleanDetails };
          }
          return m;
        });
      }
    }
    localStorage.setItem(KEYS.REAL_MESSAGES, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn('[Storage] Erro ao salvar mensagens do chat no storage (ignorado com segurança):', e);
  }
};

window.saveRealMessages = FGW.saveRealMessages;

