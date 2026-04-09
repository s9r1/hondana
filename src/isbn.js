/**
 * ISBN検証・変換モジュール
 *
 * ISBN-10 / ISBN-13 の検証、正規化、変換を行う。
 * GAS環境・ローカル環境どちらでも動作する純粋関数のみ。
 */

/**
 * ISBNを正規化する（ハイフン・スペース除去）
 * @param {string} input
 * @returns {string}
 */
function normalizeIsbn(input) {
  return input.replace(/[-\s]/g, '').trim();
}

/**
 * ISBN-10のチェックディジットを検証する
 * @param {string} isbn - 10桁の数字列（末尾Xも可）
 * @returns {boolean}
 */
function isValidIsbn10(isbn) {
  if (!/^\d{9}[\dXx]$/.test(isbn)) return false;
  var sum = 0;
  for (var i = 0; i < 9; i++) {
    sum += parseInt(isbn[i], 10) * (10 - i);
  }
  var last = isbn[9].toUpperCase();
  sum += last === 'X' ? 10 : parseInt(last, 10);
  return sum % 11 === 0;
}

/**
 * ISBN-13のチェックディジットを検証する
 * @param {string} isbn - 13桁の数字列
 * @returns {boolean}
 */
function isValidIsbn13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  var sum = 0;
  for (var i = 0; i < 12; i++) {
    sum += parseInt(isbn[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  var check = (10 - (sum % 10)) % 10;
  return check === parseInt(isbn[12], 10);
}

/**
 * ISBN-10をISBN-13に変換する
 * @param {string} isbn10 - 有効なISBN-10
 * @returns {string} ISBN-13
 */
function isbn10to13(isbn10) {
  var body = '978' + isbn10.substring(0, 9);
  var sum = 0;
  for (var i = 0; i < 12; i++) {
    sum += parseInt(body[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  var check = (10 - (sum % 10)) % 10;
  return body + check.toString();
}

/**
 * 入力を正規化してISBNとして検証し、ISBN-13で返す
 * @param {string} input - ISBN（ハイフン付きでも可）
 * @returns {{ valid: boolean, isbn13: string|null, original: string, error: string|null }}
 */
function validateAndNormalizeIsbn(input) {
  var raw = normalizeIsbn(input);
  if (raw.length === 13) {
    if (isValidIsbn13(raw)) {
      return { valid: true, isbn13: raw, original: input, error: null };
    }
    return { valid: false, isbn13: null, original: input, error: 'Invalid ISBN-13 check digit' };
  }
  if (raw.length === 10) {
    if (isValidIsbn10(raw)) {
      return { valid: true, isbn13: isbn10to13(raw), original: input, error: null };
    }
    return { valid: false, isbn13: null, original: input, error: 'Invalid ISBN-10 check digit' };
  }
  return { valid: false, isbn13: null, original: input, error: 'ISBN must be 10 or 13 digits, got ' + raw.length };
}

// Node.js環境用エクスポート（GASでは無視される）
if (typeof module !== 'undefined') {
  module.exports = { normalizeIsbn, isValidIsbn10, isValidIsbn13, isbn10to13, validateAndNormalizeIsbn };
}
