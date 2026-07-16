/**
 * GASスクリプトエディタで直接実行できるテスト関数群
 *
 * 使い方: GASエディタで関数を選択して「実行」→ ログビュー(Ctrl+Enter)で結果確認
 */

// ============================================================
// ★ テスト用ISBNリスト — ここに自由に追加してください
// ============================================================
const TEST_ISBNS = [
  // [ISBN, メモ]
  // ↓↓↓ ここに追加 ↓↓↓
  ['9780195132601', 'The Mechanisms of Governance / Williamson (en)'],
  ['9784641165779', 'ゲーム理論 / 岡田章 (ja)'],
  // ↑↑↑ ここに追加 ↑↑↑
];

// ============================================================
// ★ 1冊だけ試す — ISBNを書き換えて実行
// ============================================================

/**
 * 1冊分の統合テスト（API取得のみ、シートには書き込まない）
 */
function testOne() {
  const isbn = '9784641165779';  // ← ここを書き換える
  Logger.log(`=== Test One: ${isbn} ===`);
  logResult_(fetchBookInfo(isbn, 'A-1'));
}

/**
 * 1冊分 Google Books のみ（rawデータ確認用）
 */
function testOneGoogleBooks() {
  const isbn = '9784641165779';  // ← ここを書き換える
  Logger.log(`=== Google Books: ${isbn} ===`);
  logRawBookInfo_(fetchFromGoogleBooks(isbn));
}

/**
 * 1冊分 NDL Search のみ（rawデータ確認用）
 */
function testOneNdlSearch() {
  const isbn = '9784641165779';  // ← ここを書き換える
  Logger.log(`=== NDL Search: ${isbn} ===`);
  logRawBookInfo_(fetchFromNdlSearch(isbn));
}

// ============================================================
// リスト一括テスト（API取得のみ）
// ============================================================

function testAll() {
  Logger.log(`=== Batch Test: ${TEST_ISBNS.length} books ===\n`);
  for (let i = 0; i < TEST_ISBNS.length; i++) {
    const [isbn, memo] = TEST_ISBNS[i];
    Logger.log(`--- [${i + 1}/${TEST_ISBNS.length}] ${memo || isbn} ---`);
    logResult_(fetchBookInfo(isbn, ''));
    Logger.log('');
  }
}

// ============================================================
// ★ シート書き込みテスト
// ============================================================

/**
 * 1冊をLibraryシートに登録する
 */
function testRegisterOne() {
  const isbn = '9784641165779';  // ← ここを書き換える
  const shelf = 'A-1';           // ← 棚を指定
  Logger.log(`=== Register: ${isbn} to Library ===`);
  logResult_(registerBookByIsbn(isbn, shelf, makeTestToken_()));
}

/**
 * 手動登録テスト（Manualシートに書き込む）
 */
function testRegisterManual() {
  Logger.log('=== Manual Register ===');
  const result = registerBookManual({
    isbn: '',  // ISBNなしの本
    title: 'テスト手動登録の本',
    author: 'テスト著者',
    publisher: 'テスト出版社',
    pubdate: '2024',
    genre: '',
    language: 'ja',
    shelf: 'B-2',
    note: 'テスト備考'
  }, makeTestToken_());
  logResult_(result);
}

/**
 * 全書籍データ取得テスト
 */
function testGetAllBooks() {
  Logger.log('=== Get All Books ===');
  const books = getAllBooks(makeTestToken_());
  Logger.log(`Total: ${books.length} books`);
  books.forEach((b, i) => {
    Logger.log(`[${i + 1}] ${b.title} (${b.isbn}) shelf=${b.shelf}`);
  });
}

/**
 * 棚一覧取得テスト
 */
function testGetShelves() {
  Logger.log('=== Get Shelves ===');
  const sh = getShelves(makeTestToken_());
  const ids = sh.map((s) => (s.no ? `${s.name}-${s.no}` : s.name));
  Logger.log(`Shelves (${sh.length}): ${ids.join(', ')}`);
}

/**
 * ISBNで即時登録テスト（Libraryシートに書き込む）
 */
function testRegisterByIsbn() {
  const isbn = '9784641165779';  // ← ここを書き換える
  const shelf = 'A-1';
  Logger.log(`=== Register by ISBN: ${isbn} to ${shelf} ===`);
  logResult_(registerBookByIsbn(isbn, shelf, makeTestToken_()));
}

// ============================================================
// 認証テスト
// ============================================================

/**
 * GASエディタからのテスト実行用に有効な認証トークンを発行する
 * （APP_PASSWORD 未設定時は何でも通るので形式だけ）
 */
function makeTestToken_() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(`tok:${token}`, '1', 300);
  return token;
}

/**
 * requireAuth_ の素通し/拒否テスト
 */
function testRequireAuth() {
  Logger.log('=== requireAuth_ Test ===');
  const pwSet = isPasswordRequired();
  Logger.log(`APP_PASSWORD set: ${pwSet}`);

  // 有効トークン → 通る
  try {
    requireAuth_(makeTestToken_());
    Logger.log('✓ valid token accepted');
  } catch (e) {
    Logger.log(`✗ valid token rejected: ${e.message}`);
  }

  // 不正トークン → APP_PASSWORD 設定時のみ throw
  try {
    requireAuth_('bogus-token');
    Logger.log(pwSet ? '✗ bogus token accepted (should throw)' : '✓ no password → pass-through');
  } catch (e) {
    Logger.log(pwSet ? `✓ bogus token rejected: ${e.message}` : `✗ threw despite no password: ${e.message}`);
  }
}

// ============================================================
// pubdate正規化テスト
// ============================================================

function testNormalizePubdate() {
  const cases = [
    ['2024-03-15', '2024-03-15'],
    ['2024-03', '2024-03'],
    ['2024.3', '2024-03'],
    ['2024.3.5', '2024-03-05'],
    ['[2024]', '2024'],
    ['c2018', '2018'],
    ['2024年3月', '2024-03'],
    ['', ''],
    ['unknown', 'unknown'],
  ];
  Logger.log('=== normalizePubdate_ Test ===');
  let passed = 0, failed = 0;
  for (const [input, expected] of cases) {
    const got = normalizePubdate_(input);
    if (got === expected) {
      passed++;
      Logger.log(`✓ "${input}" → "${got}"`);
    } else {
      failed++;
      Logger.log(`✗ "${input}" expected="${expected}" got="${got}"`);
    }
  }
  Logger.log(`--- Results: ${passed} passed, ${failed} failed ---`);
}

// ============================================================
// ISBN検証テスト
// ============================================================

function testIsbnValidation() {
  const testCases = [
    ['9784641165779', true, 'ゲーム理論 (ISBN-13)'],
    ['978-4-641-16577-9', true, 'ハイフン付きISBN-13'],
    ['9780195132601', true, 'Mechanisms of Governance (ISBN-13)'],
    ['4769907427', true, 'ISBN-10 テスト'],
    ['978013468599X', false, '不正なISBN-13 (non-digit)'],
    ['123', false, '短すぎる'],
    ['', false, '空文字'],
  ];

  Logger.log('=== ISBN Validation Test ===');
  let passed = 0, failed = 0;
  for (const [input, expectedValid, desc] of testCases) {
    const result = validateAndNormalizeIsbn(input);
    if (result.valid === expectedValid) {
      passed++;
      Logger.log(`✓ ${desc}: ${input}${result.isbn13 ? ' → ' + result.isbn13 : ''}`);
    } else {
      failed++;
      Logger.log(`✗ ${desc}: expected=${expectedValid}, got=${result.valid} err=${result.error}`);
    }
  }
  Logger.log(`--- Results: ${passed} passed, ${failed} failed ---`);
}

// ============================================================
// ヘルパー
// ============================================================

function logResult_(result) {
  Logger.log(`  success: ${result.success}`);
  if (result.debug && result.debug.errors && result.debug.errors.length > 0) {
    Logger.log(`  errors:  ${result.debug.errors.join(', ')}`);
  }
  if (!result.row) {
    Logger.log('  (no result)');
    return;
  }
  const r = result.row;
  Logger.log(`  id:            ${r.id}`);
  Logger.log(`  registeredAt:  ${r.registeredAt}`);
  Logger.log(`  isbn:          ${r.isbn}`);
  Logger.log(`  title:         ${r.title}`);
  Logger.log(`  author:        ${r.author}`);
  Logger.log(`  publisher:     ${r.publisher}`);
  Logger.log(`  pubdate:       ${r.pubdate}`);
  Logger.log(`  genre:         ${r.genre}`);
  Logger.log(`  language:      ${r.language}`);
  Logger.log(`  shelf:         ${r.shelf}`);
  Logger.log(`  status:        ${r.status}`);
  Logger.log(`  thumbnailUrl:  ${r.thumbnailUrl ? '(exists)' : '(none)'}`);
}

function logRawBookInfo_(info) {
  if (!info) {
    Logger.log('  (no result)');
    return;
  }
  Logger.log(`  title:         ${info.title}`);
  Logger.log(`  authors:       ${(info.authors || []).join(', ')}`);
  Logger.log(`  publisher:     ${info.publisher}`);
  Logger.log(`  publishedDate: ${info.publishedDate}`);
  Logger.log(`  language:      ${info.language}`);
  Logger.log(`  categories:    ${(info.categories || []).join(', ')}`);
  Logger.log(`  thumbnail:     ${info.thumbnail || '(none)'}`);
  Logger.log(`  pageCount:     ${info.pageCount}`);
  Logger.log(`  source:        ${info.source}`);
}
