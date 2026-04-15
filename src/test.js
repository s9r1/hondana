/**
 * GASスクリプトエディタで直接実行できるテスト関数群
 *
 * 使い方: GASエディタで関数を選択して「実行」→ ログビュー(Ctrl+Enter)で結果確認
 */

// ============================================================
// ★ テスト用ISBNリスト — ここに自由に追加してください
// ============================================================
var TEST_ISBNS = [
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
  var isbn = '9784641165779';  // ← ここを書き換える
  Logger.log('=== Test One: ' + isbn + ' ===');
  var result = fetchBookInfo(isbn, 'A-1');
  logResult_(result);
}

/**
 * 1冊分 Google Books のみ（rawデータ確認用）
 */
function testOneGoogleBooks() {
  var isbn = '9784641165779';  // ← ここを書き換える
  Logger.log('=== Google Books: ' + isbn + ' ===');
  logRawBookInfo_(fetchFromGoogleBooks(isbn));
}

/**
 * 1冊分 NDL Search のみ（rawデータ確認用）
 */
function testOneNdlSearch() {
  var isbn = '9784641165779';  // ← ここを書き換える
  Logger.log('=== NDL Search: ' + isbn + ' ===');
  logRawBookInfo_(fetchFromNdlSearch(isbn));
}

// ============================================================
// リスト一括テスト（API取得のみ）
// ============================================================

function testAll() {
  Logger.log('=== Batch Test: ' + TEST_ISBNS.length + ' books ===\n');
  for (var i = 0; i < TEST_ISBNS.length; i++) {
    var isbn = TEST_ISBNS[i][0];
    var memo = TEST_ISBNS[i][1];
    Logger.log('--- [' + (i + 1) + '/' + TEST_ISBNS.length + '] ' + (memo || isbn) + ' ---');
    var result = fetchBookInfo(isbn, '');
    logResult_(result);
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
  var isbn = '9784641165779';  // ← ここを書き換える
  var shelf = 'A-1';           // ← 棚を指定
  Logger.log('=== Register: ' + isbn + ' to Library ===');
  var result = registerBookByIsbn(isbn, shelf);
  logResult_(result);
}

/**
 * 手動登録テスト（Manualシートに書き込む）
 */
function testRegisterManual() {
  Logger.log('=== Manual Register ===');
  var result = registerBookManual({
    isbn: '',  // ISBNなしの本
    title: 'テスト手動登録の本',
    author: 'テスト著者',
    publisher: 'テスト出版社',
    pubdate: '2024',
    genre: '',
    language: 'ja',
    shelf: 'B-2',
    note: 'テスト備考'
  });
  logResult_(result);
}

/**
 * 全書籍データ取得テスト
 */
function testGetAllBooks() {
  Logger.log('=== Get All Books ===');
  var books = getAllBooks();
  Logger.log('Total: ' + books.length + ' books');
  for (var i = 0; i < books.length; i++) {
    Logger.log('[' + (i + 1) + '] ' + books[i].title + ' (' + books[i].isbn + ') shelf=' + books[i].shelf);
  }
}

/**
 * 棚一覧取得テスト
 */
function testGetShelves() {
  Logger.log('=== Get Shelves ===');
  var sh = getShelves();
  Logger.log('Shelves (' + sh.length + '): ' + sh.join(', '));
}

/**
 * ISBNで即時登録テスト（Libraryシートに書き込む）
 */
function testRegisterByIsbn() {
  var isbn = '9784641165779';  // ← ここを書き換える
  var shelf = 'A-1';
  Logger.log('=== Register by ISBN: ' + isbn + ' to ' + shelf + ' ===');
  var result = registerBookByIsbn(isbn, shelf);
  logResult_(result);
}

// ============================================================
// ISBN検証テスト
// ============================================================

function testIsbnValidation() {
  var testCases = [
    ['9784641165779', true, 'ゲーム理論 (ISBN-13)'],
    ['978-4-641-16577-9', true, 'ハイフン付きISBN-13'],
    ['9780195132601', true, 'Mechanisms of Governance (ISBN-13)'],
    ['4769907427', true, 'ISBN-10 テスト'],
    ['978013468599X', false, '不正なISBN-13 (non-digit)'],
    ['123', false, '短すぎる'],
    ['', false, '空文字'],
  ];

  Logger.log('=== ISBN Validation Test ===');
  var passed = 0;
  var failed = 0;
  for (var i = 0; i < testCases.length; i++) {
    var input = testCases[i][0];
    var expectedValid = testCases[i][1];
    var desc = testCases[i][2];
    var result = validateAndNormalizeIsbn(input);
    var ok = result.valid === expectedValid;
    if (ok) {
      passed++;
      Logger.log('✓ ' + desc + ': ' + input + (result.isbn13 ? ' → ' + result.isbn13 : ''));
    } else {
      failed++;
      Logger.log('✗ ' + desc + ': expected=' + expectedValid + ', got=' + result.valid + ' err=' + result.error);
    }
  }
  Logger.log('--- Results: ' + passed + ' passed, ' + failed + ' failed ---');
}

// ============================================================
// ヘルパー
// ============================================================

function logResult_(result) {
  Logger.log('  success: ' + result.success);
  if (result.debug && result.debug.errors && result.debug.errors.length > 0) {
    Logger.log('  errors:  ' + result.debug.errors.join(', '));
  }
  if (!result.row) {
    Logger.log('  (no result)');
    return;
  }
  var r = result.row;
  Logger.log('  id:            ' + r.id);
  Logger.log('  registeredAt:  ' + r.registeredAt);
  Logger.log('  isbn:          ' + r.isbn);
  Logger.log('  title:         ' + r.title);
  Logger.log('  author:        ' + r.author);
  Logger.log('  publisher:     ' + r.publisher);
  Logger.log('  pubdate:       ' + r.pubdate);
  Logger.log('  genre:         ' + r.genre);
  Logger.log('  language:      ' + r.language);
  Logger.log('  shelf:         ' + r.shelf);
  Logger.log('  status:        ' + r.status);
  Logger.log('  thumbnailUrl:  ' + (r.thumbnailUrl ? '(exists)' : '(none)'));
}

function logRawBookInfo_(info) {
  if (!info) {
    Logger.log('  (no result)');
    return;
  }
  Logger.log('  title:         ' + info.title);
  Logger.log('  authors:       ' + (info.authors || []).join(', '));
  Logger.log('  publisher:     ' + info.publisher);
  Logger.log('  publishedDate: ' + info.publishedDate);
  Logger.log('  language:      ' + info.language);
  Logger.log('  categories:    ' + (info.categories || []).join(', '));
  Logger.log('  thumbnail:     ' + (info.thumbnail ? info.thumbnail : '(none)'));
  Logger.log('  pageCount:     ' + info.pageCount);
  Logger.log('  source:        ' + info.source);
}
