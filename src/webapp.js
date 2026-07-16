// ============================================================
// サイト設定 — ここだけ変更すれば OK
// ============================================================
const SITE_NAME = 'Hondana';  // e.g. 'XY大学Z研究室 蔵書管理'

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
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
    const pw = PropertiesService.getScriptProperties().getProperty('APP_PASSWORD');
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
    const cache = CacheService.getScriptCache();
    // 総当たり対策: 失敗が10回に達したら15分間は正しいパスワードでも受け付けない
    const fails = parseInt(cache.get('pwfail') || '0', 10);
    if (fails >= 10) return '';
    const pw = PropertiesService.getScriptProperties().getProperty('APP_PASSWORD');
    if (!pw || input !== pw) {
      cache.put('pwfail', String(fails + 1), 900);
      return '';
    }
    cache.remove('pwfail');
    const token = Utilities.getUuid();
    cache.put(`tok:${token}`, '1', 21600); // 6時間有効
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
  const pw = PropertiesService.getScriptProperties().getProperty('APP_PASSWORD');
  if (!pw) return;
  if (!token || !CacheService.getScriptCache().get(`tok:${token}`)) {
    throw new Error('AUTH_REQUIRED');
  }
}
