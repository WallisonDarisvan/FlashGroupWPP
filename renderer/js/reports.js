/**
 * FlashGroup WPP - Módulo: Reports
 * Gerencia o registro e a exportação do Relatório de Disparos para Excel (.csv com BOM UTF-8)
 */

window.FGW = window.FGW || {};
window.FGW.state = window.FGW.state || {};
window.FGW.state.dispatchReport = window.FGW.state.dispatchReport || [];

/**
 * Registra um item no histórico detalhado da campanha
 */
FGW.recordDispatchEvent = function(entry) {
  if (!entry) return;
  FGW.state.dispatchReport = FGW.state.dispatchReport || [];

  const now = new Date();
  const timeFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  FGW.state.dispatchReport.push({
    timestamp: timeFormatted,
    groupName: entry.groupName || 'Grupo',
    groupId: entry.groupId || '',
    customId: entry.customId || '',
    messageText: entry.messageText || '',
    mediaType: entry.mediaType || 'Texto Puro',
    mediaFileName: entry.mediaFileName || '-',
    status: entry.status === 'success' ? 'SUCESSO' : 'FALHA',
    messageId: entry.messageId || '',
    errorMessage: entry.errorMessage || '-'
  });

  // Habilita o botão de exportar relatório se existir
  const btn = document.getElementById('btnExportReport');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('btn-disabled');
  }
};

/**
 * Limpa o histórico atual do relatório de disparos
 */
FGW.clearDispatchReport = function() {
  FGW.state.dispatchReport = [];
  const btn = document.getElementById('btnExportReport');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('btn-disabled');
  }
};

/**
 * Exporta o relatório completo de envios no formato Excel (.csv com BOM UTF-8)
 */
FGW.exportDispatchReportToExcel = function() {
  const report = FGW.state.dispatchReport || [];

  if (report.length === 0) {
    alert('Nenhum envio registrado nesta sessão para gerar relatório.\nInicie uma campanha de disparos primeiro.');
    return;
  }

  try {
    // Cabeçalho compatível com Excel (separador ponto-e-vírgula para padrão Windows em português)
    const headers = [
      'Data e Hora',
      'Nome do Grupo',
      'ID do Grupo (WhatsApp)',
      'Identificador Personalizado {ID do Grupo}',
      'Tipo de Mensagem',
      'Arquivo de Mídia',
      'Mensagem Enviada',
      'Status de Envio',
      'ID da Mensagem / Motivo do Erro'
    ];

    // Helper para escapar células CSV
    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    let csvContent = headers.map(escapeCsv).join(';') + '\r\n';

    report.forEach(item => {
      const row = [
        item.timestamp,
        item.groupName,
        item.groupId,
        item.customId,
        item.mediaType,
        item.mediaFileName,
        item.messageText,
        item.status,
        item.status === 'SUCESSO' ? item.messageId : item.errorMessage
      ];
      csvContent += row.map(escapeCsv).join(';') + '\r\n';
    });

    // Adiciona o caractere BOM UTF-8 (\uFEFF) para garantir que o Microsoft Excel reconheça acentuação perfeitamente
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `relatorio_disparos_${dateStr}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    FGW.log('SUCESSO', `Relatório de envios exportado com sucesso: "${filename}" (${report.length} registros).`, 'success');
  } catch (err) {
    console.error('Erro ao gerar relatório Excel:', err);
    FGW.log('ERRO', `Falha ao gerar relatório: ${err.message}`, 'error');
    alert('Erro ao exportar relatório:\n' + err.message);
  }
};

window.exportDispatchReportToExcel = FGW.exportDispatchReportToExcel;
window.recordDispatchEvent = FGW.recordDispatchEvent;
window.clearDispatchReport = FGW.clearDispatchReport;
