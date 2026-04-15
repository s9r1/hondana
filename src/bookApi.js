/**
 * 書籍情報取得 統合モジュール
 *
 * Google Books API で書籍情報を取得し、シートに書き込む形式に変換する。
 * ISBN-10/13 どちらでも受付可能。
 */

/**
 * ISBNから書籍情報を取得し、シート登録用データを返す
 *
 * @param {string} isbnInput - ISBN（ハイフン付き、10桁、13桁いずれもOK）
 * @param {string} shelf - 棚ID（例: "A-1"）
 * @returns {object} { success, row, debug }
 */
function fetchBookInfo(isbnInput, shelf) {
  var errors = [];
  shelf = shelf || '';

  // 1. ISBN検証
  var validation = validateAndNormalizeIsbn(isbnInput);
  if (!validation.valid) {
    return { success: false, row: null, debug: { errors: [validation.error] } };
  }
  var isbn13 = validation.isbn13;

  // 2. Google Books API
  var gb = null;
  try {
    gb = fetchFromGoogleBooks(isbn13);
  } catch (e) {
    errors.push('Google Books: ' + e.message);
  }

  // 3. NDL Search（和書の出版社・ジャンル補完用。洋書はヒットしないので自然にスキップ）
  var ndl = null;
  try {
    ndl = fetchFromNdlSearch(isbn13);
  } catch (e) {
    errors.push('NDL Search: ' + e.message);
  }

  // 4. どちらもなければ失敗
  if (!gb && !ndl) {
    return { success: false, row: null, debug: { errors: errors.concat(['No results from any API']) } };
  }

  // 5. シート行フォーマットに変換
  var row = buildSheetRow(isbn13, gb, ndl, shelf);

  var source = (gb && ndl) ? 'merged' : (gb ? 'googleBooks' : 'ndlSearch');
  return {
    success: true,
    row: row,
    debug: { source: source, googleRaw: gb, ndlRaw: ndl, errors: errors }
  };
}

/**
 * 著者名をクリーニングする
 * - 末尾の '=' を除去（Google Booksの一部和書エントリ）
 * - 生没年を除去（NDLの "三上, 貞芳, 1962-" → "三上 貞芳"）
 * - NDL形式の "姓, 名" → "姓 名" に変換（2パーツの場合のみ）
 */
function cleanAuthorName_(name) {
  if (!name) return '';
  var s = name.trim();
  // 末尾 '=' 除去
  s = s.replace(/[=＝]+$/, '');
  // 生没年パターン除去: ", 1962-" / ", 1900-1999" / ", 1962-2020"
  s = s.replace(/,\s*\d{4}-\d{0,4}\s*$/, '');
  // NDL "姓, 名" → "姓 名"（カンマ区切りが1つだけの場合）
  var parts = s.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
  if (parts.length === 2 && !/\s/.test(parts[0]) && !/\s/.test(parts[1])) {
    // 両パーツが単語1つずつ = 日本語の "姓, 名" パターン
    s = parts[0] + ' ' + parts[1];
  } else {
    s = parts.join(', ');
  }
  return s.trim();
}

/**
 * API結果からシート1行分のデータを構築する
 *
 * マージ方針:
 *   タイトル   : GB → NDL フォールバック
 *   著者       : NDL 優先（翻訳者除外済み）→ GB フォールバック
 *   出版社     : NDL 優先 → GB フォールバック
 *   出版年月   : GB → NDL フォールバック
 *   ジャンル   : NDL のみ（GB categories は使わない）
 *   言語       : GB → NDL フォールバック
 *   書影       : GB のみ
 */
function buildSheetRow(isbn13, gb, ndl, shelf) {
  var title = (gb && gb.title) || (ndl && ndl.title) || '';

  // 著者: 和書(NDL言語=ja)ならNDL優先（翻訳者除外済み）、洋書ならGB優先
  var ndlIsJa = ndl && ndl.language === 'ja';
  var author = '';
  if (ndlIsJa && ndl.authors && ndl.authors.length > 0) {
    author = ndl.authors.map(cleanAuthorName_).join(', ');
  } else if (gb && gb.authors && gb.authors.length > 0) {
    author = gb.authors.map(cleanAuthorName_).join(', ');
  } else if (ndl && ndl.authors && ndl.authors.length > 0) {
    // 非和書でもGBに著者がなければNDLフォールバック
    author = ndl.authors.map(cleanAuthorName_).join(', ');
  }

  // 出版年月: GB → NDL
  var pubdate = (gb && gb.publishedDate) || (ndl && ndl.publishedDate) || '';

  // 出版社: NDL 優先 → GB
  var publisher = (ndl && ndl.publisher) || (gb && gb.publisher) || '';

  // ジャンル: NDL のみ（GB categories は使わない）
  var genre = '';
  if (ndl && ndl.categories && ndl.categories.length > 0) {
    genre = ndl.categories.join(', ');
  }

  var language = (gb && gb.language) || (ndl && ndl.language) || '';
  var thumbnailUrl = (gb && gb.thumbnail) || '';

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  return {
    id: Utilities.getUuid(),
    registeredAt: now,
    isbn: isbn13,
    title: title,
    author: author,
    publisher: publisher,
    pubdate: pubdate,
    genre: genre,
    language: language,
    shelf: shelf,
    status: '在庫',
    borrower: '',
    updatedAt: '',
    note: '',
    thumbnailUrl: thumbnailUrl
  };
}


/**
 * 手動入力用: APIを使わない手動登録行を構築する
 *
 * @param {object} data - Webアプリから送られるフォームデータ
 * @returns {object} シート行データ
 */
function buildManualRow(data) {
  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  // ISBNがあれば正規化
  var isbn = '';
  if (data.isbn) {
    var validation = validateAndNormalizeIsbn(data.isbn);
    isbn = validation.valid ? validation.isbn13 : data.isbn;
  }

  return {
    id: Utilities.getUuid(),
    registeredAt: now,
    isbn: isbn,
    title: data.title || '',
    author: data.author || '',
    publisher: data.publisher || '',
    pubdate: data.pubdate || '',
    genre: data.genre || '',
    language: data.language || '',
    shelf: data.shelf || '',
    status: '在庫',
    borrower: '',
    updatedAt: '',
    note: data.note || '',
    thumbnailUrl: ''
  };
}
