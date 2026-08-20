/**
 * 06_Triggers.js
 * Liga os gatilhos instaláveis. Rode "Instalar automações (gatilhos)" pelo
 * menu Gestão de Manutenção UMA VEZ (é seguro rodar de novo — a função
 * remove os gatilhos antigos criados por ela mesma antes de recriar, então
 * não duplica).
 */

function installTriggers() {
  _deleteOwnTriggers_(['handleEdit', 'dailyDashboardRefresh']);

  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  ScriptApp.newTrigger('dailyDashboardRefresh')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  SpreadsheetApp.getUi().alert(
    'Automações instaladas:\n\n' +
    '• Cadastro de equipamento/estrutura → cria automaticamente a linha em ' +
    'Preventivas_Equipamentos / Preventivas_Armazem.\n' +
    '• Preencher "Última Preventiva" → grava automaticamente em Historico_Preventivas.\n' +
    '• Dashboard é recalculado todo dia às 06h (e a qualquer momento pelo menu).'
  );
}

function _deleteOwnTriggers_(handlerNames) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (handlerNames.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
}

function dailyDashboardRefresh() {
  refreshDashboardData();
}
