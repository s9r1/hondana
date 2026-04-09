// ============================================================
// サイト設定 — ここだけ変更すれば OK
// ============================================================
var SITE_NAME = 'Hondana';  // e.g. 'XY大学Z研究室 蔵書管理'

function doGet() {
  var template = HtmlService.createTemplateFromFile('Index');
  template.siteName = SITE_NAME;
  return template.evaluate()
    .setTitle(SITE_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * パスワード認証が必要かどうかを返す
 * スクリプトプロパティ APP_PASSWORD が設定されていれば true
 * @returns {boolean}
 */
function isPasswordRequired() {
  try {
    var pw = PropertiesService.getScriptProperties().getProperty('APP_PASSWORD');
    return !!(pw && pw.length > 0);
  } catch (e) {
    return false;
  }
}

/**
 * パスワードを検証する
 * @param {string} input - ユーザー入力
 * @returns {boolean}
 */
function checkAppPassword(input) {
  try {
    var pw = PropertiesService.getScriptProperties().getProperty('APP_PASSWORD');
    return pw === input;
  } catch (e) {
    return false;
  }
}
