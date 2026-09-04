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
  GROUP_CUSTOM_VARIATIONS: 'fgw_group_custom_variations'
};

FGW.setDefaultVariations = function() {
  FGW.state.messageVariations = [
    { text: 'Olá {ID do Grupo}! Passando para compartilhar uma super novidade com vocês.', media: null },
    { text: 'Opa membros do {ID do Grupo}, tudo bem? Vejam só essa oportunidade!', media: null },
    { text: 'Atenção {ID do Grupo}: recado importante e exclusivo para vocês hoje.', media: null }
  ];
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
      const parsedSelected = JSON.parse(savedSelected);
      if (Array.isArray(parsedSelected)) {
        state.selectedGroupIds = new Set(parsedSelected);
      }
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
            return { text: item, media: null };
          }
          return {
            text: item?.text || '',
            media: item?.media || null
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
};

FGW.saveSettings = function() {
  const elements = FGW.elements || {};
  const KEYS = FGW.STORAGE_KEYS;
  if (elements.instanceName) localStorage.setItem(KEYS.INSTANCE_NAME, elements.instanceName.value.trim());
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
