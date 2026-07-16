/**
 * スプレッドシート操作モジュール
 *
 * Library シート（API登録）と Manual シート（手入力）を管理。
 * カラム順序はここで一元管理する。
 */

/**
 * カラム定義（シートのヘッダー順序と一致させる）
 */
const COLUMNS = [
  'id', 'registeredAt', 'isbn', 'title', 'author', 'publisher',
  'pubdate', 'genre', 'language', 'shelf', 'status', 'borrower',
  'updatedAt', 'note', 'thumbnailUrl'
];

const HEADERS = [
  'ID', '登録日時', 'ISBN', 'タイトル', '著者', '出版社',
  '出版年月', 'ジャンル', '言語', '棚', '貸出状態', '借りている人',
  '更新日時', '備考', 'サムネイルURL'
];

const SHEET_LIBRARY = 'Library';
const SHEET_MANUAL = 'Manual';
const SHEET_SHELVES = 'Shelves';

// updateBookById で書き換えを許可するカラム（id や登録日時の上書き防止）
const EDITABLE_COLUMNS = ['shelf', 'status', 'borrower', 'note'];

/**
 * スクリプトロックを取って fn を実行する（並列書き込み時の保険）
 */
function withScriptLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Shelvesシートから棚リストを取得する（Webアプリ用）
 * @param {string} [token] - 認証トークン
 * @returns {{name: string, no: string}[]} シートの行順。no が空なら番号なしの棚
 */
function getShelves(token) {
  requireAuth_(token);
  return getShelves_();
}

/**
 * Shelves シートは「分類 | 番号」の2カラム。1行 = 1棚。
 * 棚IDは番号があれば「分類-番号」、なければ分類そのもの。
 * 旧1カラム形式（棚IDのみ）は番号が空になるため、棚ID全体が分類として扱われそのまま動く。
 */
function getShelves_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SHELVES);
  if (!sheet) {
    // 初回: Shelves シートを作成しサンプルデータを書き込む
    sheet = ss.insertSheet(SHEET_SHELVES);
    sheet.getRange(1, 1, 1, 2).setValues([['分類', '番号']]);
    sheet.setFrozenRows(1);
    const samples = [['A', '1'], ['A', '2'], ['A', '3'], ['B', '1'], ['B', '2'], ['B', '3']];
    sheet.getRange(2, 1, samples.length, 2).setValues(samples);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
  return data
    .map((row) => ({ name: String(row[0]).trim(), no: String(row[1]).trim() }))
    .filter((s) => s.name !== '');
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    // ISBN列を文字列書式に
    const isbnCol = COLUMNS.indexOf('isbn') + 1;
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
  const sheet = ensureSheet_(sheetName);

  // row オブジェクト → カラム順の配列に変換
  const values = COLUMNS.map((col) => {
    const val = row[col] !== undefined ? row[col] : '';
    // ISBNは文字列として保存（先頭 ' を付与）
    if (col === 'isbn' && val) {
      return `'${val}`;
    }
    return val;
  });

  withScriptLock_(() => {
    sheet.appendRow(values);
  });
}

/**
 * ISBNで書籍情報を取得してシートに登録する（Webアプリから呼ばれる想定）
 *
 * @param {string} isbn - ISBN
 * @param {string} shelf - 棚ID
 * @param {string} [token] - 認証トークン
 * @returns {object} { success, row, debug }
 */
function registerBookByIsbn(isbn, shelf, token) {
  requireAuth_(token);
  const result = fetchBookInfo(isbn, shelf);
  if (result.success) {
    addRowToSheet(result.row, SHEET_LIBRARY);
  }
  return result;
}

/**
 * 手動入力データをシートに登録する
 *
 * API補完はしない。ISBNヒット時はWebアプリ側が registerBookByIsbn を
 * 直接呼ぶため、ここに来るのは「API未ヒット or ISBNなし」のケースのみ。
 *
 * @param {object} data - { isbn?, title, author, publisher, pubdate, genre, language, shelf, note }
 * @param {string} [token] - 認証トークン
 * @returns {object} { success, row }
 */
function registerBookManual(data, token) {
  requireAuth_(token);
  const row = buildManualRow(data);
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
  const sheet = ensureSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return []; // ヘッダーのみ

  const data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getDisplayValues();
  const idCol = COLUMNS.indexOf('id') + 1;
  return data.map((rowValues, idx) => {
    const obj = {};
    for (let i = 0; i < COLUMNS.length; i++) {
      obj[COLUMNS[i]] = rowValues[i] || '';
    }
    // ISBNの先頭 ' を除去（表示値にはつかないはずだが念のため）
    if (obj.isbn && obj.isbn.charAt(0) === "'") {
      obj.isbn = obj.isbn.substring(1);
    }
    // ID が空の行（シートに直接追加された行など）は UUID を発行してシートに書き戻す。
    // 書き戻さないと updateBookById が行を特定できず更新が必ず失敗する
    if (!obj.id) {
      obj.id = Utilities.getUuid();
      sheet.getRange(idx + 2, idCol).setValue(obj.id);
    }
    return obj;
  });
}

/**
 * Library + Manual の全書籍データを返す（Webアプリ用）
 * @param {string} [token] - 認証トークン
 * @returns {object[]}
 */
function getAllBooks(token) {
  requireAuth_(token);
  const library = getBooksBySheet_(SHEET_LIBRARY);
  const manual = getBooksBySheet_(SHEET_MANUAL);
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
 * @param {string} [token] - 認証トークン
 * @returns {object} { success, error? }
 */
function updateBookById(bookId, updates, token) {
  requireAuth_(token);
  return withScriptLock_(() => updateBookById_(bookId, updates));
}

function updateBookById_(bookId, updates) {
  const sheetNames = [SHEET_LIBRARY, SHEET_MANUAL];

  for (const sheetName of sheetNames) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) continue;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) continue;

    const idCol = COLUMNS.indexOf('id') + 1;
    const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();

    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === bookId) {
        const rowNum = i + 2; // 1-indexed, skip header

        // updatesの各フィールドを書き込み
        for (const key of Object.keys(updates)) {
          if (EDITABLE_COLUMNS.indexOf(key) === -1) continue;
          const colIdx = COLUMNS.indexOf(key);
          if (colIdx === -1) continue;
          sheet.getRange(rowNum, colIdx + 1).setValue(updates[key]);
        }

        // updatedAt を自動更新
        const updatedAtCol = COLUMNS.indexOf('updatedAt') + 1;
        const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
        sheet.getRange(rowNum, updatedAtCol).setValue(now);

        return { success: true };
      }
    }
  }

  return { success: false, error: `Book not found: ${bookId}` };
}

// ============================================================
// 情報再取得（シートのカスタムメニューから実行）
// ============================================================

/**
 * 選択中のセルがある行のISBNを使って書籍情報を再取得し、シートを更新する
 * シートのカスタムメニューから呼び出す想定
 */
function refreshSelectedRows() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  if (sheetName !== SHEET_LIBRARY && sheetName !== SHEET_MANUAL) {
    SpreadsheetApp.getUi().alert('Library または Manual シートで実行してください。');
    return;
  }

  // 不連続選択 (Ctrl/Cmd+クリック) に対応するため全選択範囲から行番号を集める
  const rangeList = SpreadsheetApp.getActiveRangeList();
  const ranges = rangeList ? rangeList.getRanges() : [sheet.getActiveRange()];
  const rowSet = new Set();
  for (const range of ranges) {
    const start = range.getRow();
    for (let r = start; r < start + range.getNumRows(); r++) {
      if (r >= 2) rowSet.add(r); // ヘッダー行は対象外
    }
  }
  const rows = [...rowSet].sort((a, b) => a - b);

  const isbnCol = COLUMNS.indexOf('isbn') + 1;
  let refreshCount = 0;
  const errors = [];

  for (const r of rows) {
    const isbn = sheet.getRange(r, isbnCol).getDisplayValue().replace(/^'/, '');
    if (!isbn) {
      errors.push(`行 ${r}: ISBNが空です`);
      continue;
    }

    const result = fetchBookInfo(isbn, '');
    if (!result.success) {
      errors.push(`行 ${r} (${isbn}): 取得失敗`);
      continue;
    }

    // 更新対象カラム（id, registeredAt, shelf, status, borrower, updatedAt, note は保持）
    const updateCols = ['title', 'author', 'publisher', 'pubdate', 'genre', 'language', 'thumbnailUrl'];
    for (const col of updateCols) {
      const colIdx = COLUMNS.indexOf(col) + 1;
      sheet.getRange(r, colIdx).setValue(result.row[col] || '');
    }

    // updatedAt
    const updatedAtCol = COLUMNS.indexOf('updatedAt') + 1;
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    sheet.getRange(r, updatedAtCol).setValue(now);

    refreshCount++;
  }

  let msg = `${refreshCount} 件の書籍情報を再取得しました。`;
  if (errors.length > 0) {
    msg += '\n\nエラー:\n' + errors.join('\n');
  }
  SpreadsheetApp.getUi().alert(msg);
}

// ============================================================
// カスタムメニュー
// ============================================================

/**
 * スプレッドシートを開いた時にカスタムメニューを追加し、シートを初期化する
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('蔵書管理')
    .addItem('初期設定（不足シートを作成）', 'ensureAllSheets')
    .addItem('選択行の情報を再取得', 'refreshSelectedRows')
    .addItem('UUIDを補完', 'backfillUuids')
    .addToUi();

  // 初回: シートがなければ自動作成
  ensureAllSheets();
}

/**
 * Library / Manual / Shelves シートが存在しなければ作成する
 */
function ensureAllSheets() {
  ensureSheet_(SHEET_LIBRARY);
  ensureSheet_(SHEET_MANUAL);
  getShelves_(); // Shelves は getShelves_ 内で自動作成される
}

/**
 * ID列が空の行にUUIDを補完する（既存データの移行用）
 */
function backfillUuids() {
  const sheetNames = [SHEET_LIBRARY, SHEET_MANUAL];
  const idCol = COLUMNS.indexOf('id') + 1;
  let filled = 0;

  for (const sheetName of sheetNames) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) continue;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) continue;

    const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (!ids[i][0] || ids[i][0].toString().trim() === '') {
        sheet.getRange(i + 2, idCol).setValue(Utilities.getUuid());
        filled++;
      }
    }
  }

  SpreadsheetApp.getUi().alert(`${filled} 件のUUIDを補完しました。`);
}
