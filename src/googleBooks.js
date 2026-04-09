/**
 * Google Books API から書籍情報を取得する
 *
 * GAS環境では UrlFetchApp を使用。
 * APIキーは PropertiesService に 'GOOGLE_BOOKS_API_KEY' として保存可能（任意）。
 */

/**
 * Google Books APIのレスポンスJSONから BookInfo を抽出する
 * @param {string} isbn13
 * @param {object} json - Google Books APIの生レスポンス
 * @returns {object|null} BookInfo or null
 */
function parseGoogleBooksResponse(isbn13, json) {
  if (!json || !json.items || json.items.length === 0) {
    return null;
  }

  var vol = json.items[0].volumeInfo || {};

  return {
    isbn: isbn13,
    title: vol.title || '',
    authors: vol.authors || [],
    publisher: vol.publisher || '',
    publishedDate: vol.publishedDate || '',
    language: vol.language || '',
    categories: vol.categories || [],
    thumbnail: (vol.imageLinks && vol.imageLinks.thumbnail) ? vol.imageLinks.thumbnail : '',
    description: vol.description || '',
    pageCount: vol.pageCount || null,
    source: 'googleBooks'
  };
}

/**
 * Google Books APIから書籍情報を取得する（GAS用）
 * @param {string} isbn13
 * @returns {object|null} BookInfo or null
 */
function fetchFromGoogleBooks(isbn13) {
  var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn13 + '&country=JP';

  // APIキーがあれば付与
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_BOOKS_API_KEY');
    if (apiKey) {
      url += '&key=' + apiKey;
    }
  } catch (e) {
    // PropertiesService が使えない環境（テスト等）では無視
  }

  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code !== 200) {
      Logger.log('Google Books API error: HTTP ' + code);
      Logger.log('Response body: ' + body.substring(0, 500));
      return null;
    }
    var json = JSON.parse(body);
    return parseGoogleBooksResponse(isbn13, json);
  } catch (e) {
    Logger.log('Google Books API fetch error: ' + e.message);
    return null;
  }
}

/**
 * デバッグ用: Google Books APIのraw responseを確認する
 * GASエディタで直接実行して使う
 */
function debugGoogleBooksRawResponse() {
  var isbn = '9784641165779';
  var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn + '&country=JP';
  
  // APIキーの確認
  var apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_BOOKS_API_KEY');
  Logger.log('API Key loaded: ' + (apiKey ? 'YES (' + apiKey.substring(0, 6) + '...)' : 'NO'));
  
  if (apiKey) {
    url += '&key=' + apiKey;
  }
  
  // キーをマスクしてURL表示
  Logger.log('URL: ' + url.replace(/key=([^&]+)/, 'key=***'));
  
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log('HTTP Status: ' + response.getResponseCode());
  Logger.log('Body: ' + response.getContentText().substring(0, 2000));
}

// Node.js環境用エクスポート（GASでは無視される）
if (typeof module !== 'undefined') {
  module.exports = { parseGoogleBooksResponse };
}
