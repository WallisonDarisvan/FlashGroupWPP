/**
 * FlashGroup WPP - Módulo: Logger
 * Exibe logs em tempo real no terminal da aplicação com cores por tipo.
 */

window.FGW = window.FGW || {};

FGW.log = function(tag, message, type = 'info') {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;

  const tagClassMap = {
    sys: 'tag-sys',
    info: 'tag-info',
    success: 'tag-success',
    warn: 'tag-warn',
    error: 'tag-err'
  };
  const tagClass = tagClassMap[type] || 'tag-info';

  entry.innerHTML = `
    <span class="log-time">[${timeStr}]</span>
    <span class="log-tag ${tagClass}">${FGW.escapeHtml(tag)}</span>
    <span class="log-msg">${FGW.escapeHtml(message)}</span>
  `;

  const terminalLogs = FGW.elements ? FGW.elements.terminalLogs : document.getElementById('terminalLogs');
  if (terminalLogs) {
    terminalLogs.appendChild(entry);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }
};

// Atalho global para conveniência
window.log = FGW.log;
