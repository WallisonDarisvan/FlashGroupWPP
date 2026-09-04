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

FGW.saveInstanceNameToIndexedDB = async function(instanceName) {
  const name = (instanceName || '').trim();
  if (!name) return;
  localStorage.setItem(FGW.STORAGE_KEYS.INSTANCE_NAME, name);
  try {
    if (!FGW.db) await FGW.initIndexedDB();
    if (!FGW.db) return;
    return new Promise((resolve) => {
      const tx = FGW.db.transaction('app_instance', 'readwrite');
      const store = tx.objectStore('app_instance');
      store.put({ key: 'instanceName', value: name, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[IndexedDB] Erro ao salvar:', err);
  }
};

FGW.loadInstanceNameFromIndexedDB = async function() {
  try {
    if (!FGW.db) await FGW.initIndexedDB();
    if (FGW.db) {
      const dbValue = await new Promise((resolve) => {
        const tx = FGW.db.transaction('app_instance', 'readonly');
        const store = tx.objectStore('app_instance');
        const req = store.get('instanceName');
        req.onsuccess = () => {
          if (req.result && req.result.value) {
            resolve(req.result.value);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
      if (dbValue) return dbValue;
    }
  } catch (err) {
    console.warn('[IndexedDB] Erro ao carregar:', err);
  }
  return localStorage.getItem(FGW.STORAGE_KEYS.INSTANCE_NAME) || '';
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
  const elements = FGW.elements || {};
  const KEYS = FGW.STORAGE_KEYS;
  if (elements.instanceName) {
    const val = elements.instanceName.value.trim();
    localStorage.setItem(KEYS.INSTANCE_NAME, val);
    if (val && FGW.saveInstanceNameToIndexedDB) {
      FGW.saveInstanceNameToIndexedDB(val);
    }
  }
  if (elements.minDelay) localStorage.setItem(KEYS.MIN_DELAY, elements.minDelay.value);
  if (elements.maxDelay) localStorage.setItem(KEYS.MAX_DELAY, elements.maxDelay.value);
  if (elements.presenceDelay) localStorage.setItem(KEYS.PRESENCE_DELAY, elements.presenceDelay.value);
  localStorage.setItem(KEYS.VARIATIONS, JSON.stringify(FGW.state.messageVariations));
  if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();
};

FGW.saveGroupCustomTags = function() {
  localStorage.setItem(FGW.STORAGE_KEYS.GROUP_CUSTOM_TAGS, JSON.stringify(FGW.state.groupCustomTags));
};

FGW.saveCustomVariables = function() {
  localStorage.setItem(FGW.STORAGE_KEYS.CUSTOM_VARIABLES, JSON.stringify(FGW.state.customVariables));
};

FGW.saveGroupCustomVars = function() {
  localStorage.setItem(FGW.STORAGE_KEYS.GROUP_CUSTOM_VARS, JSON.stringify(FGW.state.groupCustomVars));
};

FGW.saveSelectedGroupIds = function() {
  localStorage.setItem(FGW.STORAGE_KEYS.SELECTED_GROUP_IDS, JSON.stringify(Array.from(FGW.state.selectedGroupIds)));
};

FGW.saveCachedGroups = function() {
  localStorage.setItem(FGW.STORAGE_KEYS.CACHED_GROUPS, JSON.stringify(FGW.state.groups));
};

FGW.saveGroupCustomVariations = function() {
  localStorage.setItem(FGW.STORAGE_KEYS.GROUP_CUSTOM_VARIATIONS, JSON.stringify(FGW.state.groupCustomVariations));
};

/**
 * Salva o histórico de mensagens reais por grupo no localStorage
 */
FGW.saveRealMessages = function() {
  const KEYS = FGW.STORAGE_KEYS;
  try {
    const dataToSave = {};
    const messagesByGroup = FGW.state.realMessages || {};
    // Salva as últimas 100 mensagens por grupo
    for (const [gid, msgs] of Object.entries(messagesByGroup)) {
      if (Array.isArray(msgs) && msgs.length > 0) {
        dataToSave[gid] = msgs.slice(-100);
      }
    }
    localStorage.setItem(KEYS.REAL_MESSAGES, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn('Erro ao salvar mensagens do chat no storage:', e);
  }
};

window.saveRealMessages = FGW.saveRealMessages;

