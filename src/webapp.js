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
 * パスワードを検証し、成功なら認証トークンを発行する
 * @param {string} input - ユーザー入力
 * @returns {string} トークン（失敗時は空文字）
 */
function checkAppPassword(input) {
  try {
    var pw = PropertiesService.getScriptProperties().getProperty('APP_PASSWORD');
    if (!pw || input !== pw) return '';
    var token = Utilities.getUuid();
    CacheService.getScriptCache().put('tok:' + token, '1', 21600); // 6時間有効
    return token;
  } catch (e) {
    return '';
  }
}

/**
 * トークンを検証する。APP_PASSWORD 未設定なら素通し。
 * 各公開エンドポイントの先頭で呼ぶ
 * @param {string} token
 */
function requireAuth_(token) {
  var pw = PropertiesService.getScriptProperties().getProperty('APP_PASSWORD');
  if (!pw) return;
  if (!token || !CacheService.getScriptCache().get('tok:' + token)) {
    throw new Error('AUTH_REQUIRED');
  }
}
