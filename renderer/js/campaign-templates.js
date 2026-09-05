/**
 * FlashGroup WPP - Módulo: Campaign Templates
 * Gerencia a Exportação e Importação de Modelos de Campanha (.fgw)
 */

window.FGW = window.FGW || {};

/**
 * Exporta o modelo atual de campanha para arquivo .fgw
 */
FGW.exportCampaignTemplate = function() {
  try {
    const state = FGW.state || {};
    const elements = FGW.elements || {};

    const templateData = {
      format: 'FlashGroupWPP-Template',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      appName: 'FlashGroup WPP',
      settings: {
        minDelay: elements.minDelay ? elements.minDelay.value : 20,
        maxDelay: elements.maxDelay ? elements.maxDelay.value : 50,
        presenceDelay: elements.presenceDelay ? elements.presenceDelay.value : 1200
      },
      customVariables: state.customVariables || [],
      messageVariations: (state.messageVariations || []).map(v => ({
        text: v.text || '',
        media: v.media ? {
          fileName: v.media.fileName,
          mediatype: v.media.mediatype,
          mimetype: v.media.mimetype,
          fileSizeStr: v.media.fileSizeStr,
          dataUrl: v.media.dataUrl
        } : null,
        mediaEnabled: v.mediaEnabled !== false
      }))
    };

    const jsonStr = JSON.stringify(templateData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `campanha_${dateStr}.fgw`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    FGW.log('SUCESSO', `Modelo de campanha exportado com sucesso: "${filename}".`, 'success');
  } catch (err) {
    console.error('Erro ao exportar modelo .fgw:', err);
    FGW.log('ERRO', `Falha ao exportar modelo: ${err.message}`, 'error');
    alert('Erro ao exportar modelo de campanha:\n' + err.message);
  }
};

/**
 * Importa um arquivo de modelo .fgw selecionado pelo usuário
 */
FGW.importCampaignTemplateFromFile = function(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      const parsed = JSON.parse(content);

      if (!parsed || (!parsed.messageVariations && !Array.isArray(parsed))) {
        throw new Error('O arquivo selecionado não contém um formato de modelo válido do FlashGroup WPP.');
      }

      const importedVars = Array.isArray(parsed) ? parsed : parsed.messageVariations;

      if (!Array.isArray(importedVars) || importedVars.length === 0) {
        throw new Error('Nenhuma variação de mensagem válida encontrada no arquivo.');
      }

      // Confirmação do usuário
      const confirmReplace = confirm(
        `Modelo detectado com ${importedVars.length} variação(ões) de mensagem.\n\nDeseja carregar este modelo no seu workspace? As variações atuais serão atualizadas.`
      );
      if (!confirmReplace) return;

      // 1. Atualiza as variações
      FGW.state.messageVariations = importedVars.map(v => ({
        text: v.text || '',
        media: v.media || null,
        mediaEnabled: v.mediaEnabled !== false
      }));

      // 2. Atualiza variáveis dinâmicas se existirem no modelo
      if (Array.isArray(parsed.customVariables) && parsed.customVariables.length > 0) {
        const existingNames = new Set((FGW.state.customVariables || []).map(cv => cv.name));
        parsed.customVariables.forEach(cv => {
          if (cv && cv.name && !existingNames.has(cv.name)) {
            FGW.state.customVariables.push(cv);
          }
        });
        if (FGW.saveCustomVariables) FGW.saveCustomVariables();
        if (FGW.renderDynamicTagChips) FGW.renderDynamicTagChips();
      }

      // 3. Atualiza delays se existirem no modelo
      if (parsed.settings) {
        const elements = FGW.elements || {};
        if (parsed.settings.minDelay && elements.minDelay) elements.minDelay.value = parsed.settings.minDelay;
        if (parsed.settings.maxDelay && elements.maxDelay) elements.maxDelay.value = parsed.settings.maxDelay;
        if (parsed.settings.presenceDelay && elements.presenceDelay) elements.presenceDelay.value = parsed.settings.presenceDelay;
      }

      // 4. Salva imediatamente no IndexedDB e Storage
      if (FGW.saveVariationsToIndexedDB) {
        await FGW.saveVariationsToIndexedDB(FGW.state.messageVariations);
      }
      if (FGW.saveSettings) FGW.saveSettings();

      // 5. Re-renderiza a interface
      FGW.state.previewVariationIndex = 0;
      if (FGW.renderVariations) FGW.renderVariations();
      if (FGW.updateVariationsBadge) FGW.updateVariationsBadge();
      if (FGW.updateWhatsAppMobilePreview) FGW.updateWhatsAppMobilePreview();
      if (FGW.updateCampaignSummary) FGW.updateCampaignSummary();

      FGW.log('SUCESSO', `Modelo "${file.name}" importado com sucesso (${importedVars.length} variações carregadas)!`, 'success');
      alert(`Modelo "${file.name}" importado com sucesso!\n\n${importedVars.length} variações carregadas no seu aplicativo.`);
    } catch (err) {
      console.error('Erro ao processar modelo importado:', err);
      FGW.log('ERRO', `Falha ao importar modelo: ${err.message}`, 'error');
      alert('Erro ao importar modelo:\n' + err.message);
    }
  };

  reader.onerror = () => {
    FGW.log('ERRO', 'Erro ao ler arquivo do computador.', 'error');
    alert('Não foi possível ler o arquivo selecionado.');
  };

  reader.readAsText(file);
};

window.exportCampaignTemplate = FGW.exportCampaignTemplate;
window.importCampaignTemplateFromFile = FGW.importCampaignTemplateFromFile;
