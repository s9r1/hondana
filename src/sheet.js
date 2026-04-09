/**
 * スプレッドシート操作モジュール
 *
 * Library シート（API登録）と Manual シート（手入力）を管理。
 * カラム順序はここで一元管理する。
 */

/**
 * カラム定義（シートのヘッダー順序と一致させる）
 */
var COLUMNS = [
  'id', 'registeredAt', 'isbn', 'title', 'author', 'publisher',
  'pubdate', 'genre', 'language', 'shelf', 'status', 'borrower',
  'updatedAt', 'note', 'thumbnailUrl', 'source'
];

var HEADERS = [
  'ID', '登録日時', 'ISBN', 'タイトル', '著者', '出版社',
  '出版年月', 'ジャンル', '言語', '棚', '貸出状態', '借りている人',
  '更新日時', '備考', 'サムネイルURL', 'ソース'
];

var SHEET_LIBRARY = 'Library';
var SHEET_MANUAL = 'Manual';
var SHEET_SHELVES = 'Shelves';

/**
 * Shelvesシートから棚IDリストを取得する
 * @returns {string[]}
 */
function getShelves() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SHELVES);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return data.map(function(row) { return row[0]; }).filter(function(v) { return v !== ''; });
}

// ============================================================
// シート初期化
// ============================================================

/**
 * シートが存在しなければ作成し、ヘッダーを書き込む
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSheet_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    // ISBN列を文字列書式に
    var isbnCol = COLUMNS.indexOf('isbn') + 1;
    sheet.getRange(2, isbnCol, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
  }
  return sheet;
}

// ============================================================
// 書き込み
// ============================================================

/**
 * 行オブジェクトをシートに追加する
 * @param {object} row - buildSheetRow() or buildManualRow() の返り値
 * @param {string} sheetName - "Library" or "Manual"
 */
function addRowToSheet(row, sheetName) {
  var sheet = ensureSheet_(sheetName);

  // row オブジェクト → カラム順の配列に変換
  var values = COLUMNS.map(function(col) {
    var val = row[col] !== undefined ? row[col] : '';
    // ISBNは文字列として保存（先頭 ' を付与）
    if (col === 'isbn' && val) {
      return "'" + val;
    }
    return val;
  });

  sheet.appendRow(values);
}

/**
 * ISBNで書籍情報を取得してシートに登録する（Webアプリから呼ばれる想定）
 *
 * @param {string} isbn - ISBN
 * @param {string} shelf - 棚ID
 * @returns {object} { success, row, debug }
 */
function registerBookByIsbn(isbn, shelf) {
  var result = fetchBookInfo(isbn, shelf, 'Library');
  if (result.success) {
    addRowToSheet(result.row, SHEET_LIBRARY);
  }
  return result;
}

/**
 * 手動入力データをシートに登録する
 *
 * @param {object} data - { isbn?, title, author, publisher, pubdate, genre, language, shelf, note }
 * @returns {object} { success, row }
 */
function registerBookManual(data) {
  // ISBNがあればAPIで情報を補完する
  if (data.isbn) {
    var apiResult = fetchBookInfo(data.isbn, data.shelf || '', 'Manual');
    if (apiResult.success) {
      // APIで取得したデータにユーザー入力を上書き
      var row = apiResult.row;
      if (data.title) row.title = data.title;
      if (data.author) row.author = data.author;
      if (data.publisher) row.publisher = data.publisher;
      if (data.pubdate) row.pubdate = data.pubdate;
      if (data.genre) row.genre = data.genre;
      if (data.language) row.language = data.language;
      if (data.note) row.note = data.note;
      row.source = 'Manual';
      addRowToSheet(row, SHEET_MANUAL);
      return { success: true, row: row };
    }
  }

  // APIで取得できなかった or ISBNなし → 完全手動
  var row = buildManualRow(data);
  addRowToSheet(row, SHEET_MANUAL);
  return { success: true, row: row };
}

// ============================================================
// 読み取り
// ============================================================

/**
 * 指定シートの全データをJSONリストとして返す
 * @param {string} sheetName
 * @returns {object[]}
 */
function getBooksBySheet_(sheetName) {
  var sheet = ensureSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return []; // ヘッダーのみ

  var data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getDisplayValues();
  return data.map(function(rowValues, idx) {
    var obj = {};
    for (var i = 0; i < COLUMNS.length; i++) {
      obj[COLUMNS[i]] = rowValues[i] || '';
    }
    // ISBNの先頭 ' を除去（表示値にはつかないはずだが念のため）
    if (obj.isbn && obj.isbn.charAt(0) === "'") {
      obj.isbn = obj.isbn.substring(1);
    }
    // ID が空の場合はフォールバック（シート名+行番号で一意性を確保）
    if (!obj.id) {
      obj.id = sheetName + '-row-' + (idx + 2);
    }
    return obj;
  });
}

/**
 * Library + Manual の全書籍データを返す（Webアプリ用）
 * @returns {object[]}
 */
function getAllBooks() {
  var library = getBooksBySheet_(SHEET_LIBRARY);
  var manual = getBooksBySheet_(SHEET_MANUAL);
  return library.concat(manual);
}

// ============================================================
// 更新
// ============================================================

/**
 * IDを使って行を検索し、フィールドを更新する
 *
 * @param {string} bookId - UUID
 * @param {object} updates - 更新するフィールド（例: { status: '貸出中', borrower: '田中' }）
 * @returns {object} { success, error? }
 */
function updateBookById(bookId, updates) {
  var sheetNames = [SHEET_LIBRARY, SHEET_MANUAL];

  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetNames[s]);
    if (!sheet) continue;

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) continue;

    var idCol = COLUMNS.indexOf('id') + 1;
    var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();

    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === bookId) {
        var rowNum = i + 2; // 1-indexed, skip header

        // updatesの各フィールドを書き込み
        for (var key in updates) {
          var colIdx = COLUMNS.indexOf(key);
          if (colIdx === -1) continue;
          sheet.getRange(rowNum, colIdx + 1).setValue(updates[key]);
        }

        // updatedAt を自動更新
        var updatedAtCol = COLUMNS.indexOf('updatedAt') + 1;
        var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
        sheet.getRange(rowNum, updatedAtCol).setValue(now);

        return { success: true };
      }
    }
  }

  return { success: false, error: 'Book not found: ' + bookId };
}

// ============================================================
// 情報再取得（シートのカスタムメニューから実行）
// ============================================================

/**
 * 選択中のセルがある行のISBNを使って書籍情報を再取得し、シートを更新する
 * シートのカスタムメニューから呼び出す想定
 */
function refreshSelectedRows() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var sheetName = sheet.getName();

  if (sheetName !== SHEET_LIBRARY && sheetName !== SHEET_MANUAL) {
    SpreadsheetApp.getUi().alert('Library または Manual シートで実行してください。');
    return;
  }

  var selection = sheet.getActiveRange();
  var startRow = selection.getRow();
  var numRows = selection.getNumRows();

  // ヘッダー行は対象外
  if (startRow < 2) {
    startRow = 2;
    numRows = numRows - 1;
  }

  var isbnCol = COLUMNS.indexOf('isbn') + 1;
  var refreshCount = 0;
  var errors = [];

  for (var r = startRow; r < startRow + numRows; r++) {
    var isbn = sheet.getRange(r, isbnCol).getDisplayValue().replace(/^'/, '');
    if (!isbn) {
      errors.push('行 ' + r + ': ISBNが空です');
      continue;
    }

    var result = fetchBookInfo(isbn, '', '');
    if (!result.success) {
      errors.push('行 ' + r + ' (' + isbn + '): 取得失敗');
      continue;
    }

    // 更新対象カラム（id, registeredAt, shelf, status, borrower, updatedAt, note, source は保持）
    var updateCols = ['title', 'author', 'publisher', 'pubdate', 'genre', 'language', 'thumbnailUrl'];
    for (var c = 0; c < updateCols.length; c++) {
      var col = updateCols[c];
      var colIdx = COLUMNS.indexOf(col) + 1;
      var newVal = result.row[col] || '';
      sheet.getRange(r, colIdx).setValue(newVal);
    }

    // updatedAt
    var updatedAtCol = COLUMNS.indexOf('updatedAt') + 1;
    var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    sheet.getRange(r, updatedAtCol).setValue(now);

    refreshCount++;
  }

  var msg = refreshCount + ' 件の書籍情報を再取得しました。';
  if (errors.length > 0) {
    msg += '\n\nエラー:\n' + errors.join('\n');
  }
  SpreadsheetApp.getUi().alert(msg);
}

// ============================================================
// カスタムメニュー
// ============================================================

/**
 * スプレッドシートを開いた時にカスタムメニューを追加する
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hondana')
    .addItem('選択行の情報を再取得', 'refreshSelectedRows')
    .addItem('UUIDを補完', 'backfillUuids')
    .addToUi();
}

/**
 * ID列が空の行にUUIDを補完する（既存データの移行用）
 */
function backfillUuids() {
  var sheetNames = [SHEET_LIBRARY, SHEET_MANUAL];
  var idCol = COLUMNS.indexOf('id') + 1;
  var filled = 0;

  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetNames[s]);
    if (!sheet) continue;
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) continue;

    var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (!ids[i][0] || ids[i][0].toString().trim() === '') {
        sheet.getRange(i + 2, idCol).setValue(Utilities.getUuid());
        filled++;
      }
    }
  }

  SpreadsheetApp.getUi().alert(filled + ' 件のUUIDを補完しました。');
}
