/**
 * ローカルで API レスポンスを取得・キャッシュ・表示するスクリプト
 * 実行: node dev/fetchLocal.js
 *
 * ISBNリストは dev/isbns.txt から読み込む（# 以降はコメント）。
 * 取得済みレスポンスは dev/responses/ にキャッシュし、次回以降はローカルから読む。
 * 再取得したい場合はキャッシュファイルを削除してから実行する。
 *
 * Google Books APIキー設定:
 *   1. dev/.env ファイルに GOOGLE_BOOKS_API_KEY=AIza... と記述
 *   2. または環境変数で直接指定
 */

const fs = require('fs');
const path = require('path');
const { validateAndNormalizeIsbn } = require('../src/isbn.js');
const { parseGoogleBooksResponse } = require('../src/googleBooks.js');

// .env ファイルから環境変数を読み込む
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';
const RESPONSES_DIR = path.join(__dirname, 'responses');

// ============================================================
// ISBN リスト読み込み
// ============================================================

function loadIsbns() {
  const filePath = path.join(__dirname, 'isbns.txt');
  if (!fs.existsSync(filePath)) {
    console.error('dev/isbns.txt が見つかりません');
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(line => {
      const commentIdx = line.indexOf('#');
      const isbn = (commentIdx >= 0 ? line.slice(0, commentIdx) : line).trim();
      const memo = commentIdx >= 0 ? line.slice(commentIdx + 1).trim() : '';
      return [isbn, memo];
    })
    .filter(([isbn]) => isbn.length > 0);
}

// ============================================================
// API 取得 + キャッシュ
// ============================================================

function ensureResponsesDir() {
  if (!fs.existsSync(RESPONSES_DIR)) {
    fs.mkdirSync(RESPONSES_DIR, { recursive: true });
  }
}

async function getGoogleBooks(isbn13) {
  const cachePath = path.join(RESPONSES_DIR, `gb_${isbn13}.json`);
  if (fs.existsSync(cachePath)) {
    return { json: JSON.parse(fs.readFileSync(cachePath, 'utf-8')), cached: true };
  }

  let url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&country=JP`;
  if (GOOGLE_BOOKS_API_KEY) url += `&key=${GOOGLE_BOOKS_API_KEY}`;

  // 503 は一時的なエラーのためリトライ
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url);
    if (res.status === 503 && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    if (!res.ok) {
      return { json: null, error: `HTTP ${res.status}`, cached: false };
    }
    const json = await res.json();
    if (json.error) {
      if (json.error.code === 503 && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return { json: null, error: `API ${json.error.code}: ${json.error.message}`, cached: false };
    }

    ensureResponsesDir();
    fs.writeFileSync(cachePath, JSON.stringify(json, null, 2));
    return { json, cached: false };
  }
  return { json: null, error: 'max retries exceeded', cached: false };
}

async function getNdlSearch(isbn13) {
  const cachePath = path.join(RESPONSES_DIR, `ndl_${isbn13}.xml`);
  if (fs.existsSync(cachePath)) {
    return { xml: fs.readFileSync(cachePath, 'utf-8'), cached: true };
  }

  const url = `https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordSchema=dcndl&maximumRecords=5&onlyBib=true&query=isbn=${isbn13}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { xml: null, error: `HTTP ${res.status}`, cached: false };
  }
  const xml = await res.text();

  // エラーレスポンスや0件はキャッシュしない
  const hasData = !xml.includes('<numberOfRecords>0</numberOfRecords>')
    && !xml.includes('Record does not exist');
  if (hasData) {
    ensureResponsesDir();
    fs.writeFileSync(cachePath, xml);
  }

  return { xml, cached: false };
}

// ============================================================
// 表示
// ============================================================

function printGoogleBooks(isbn13, result) {
  if (result.error) {
    console.log(`  Google Books: ERROR - ${result.error}`);
    return;
  }
  if (!result.json || !result.json.items || result.json.items.length === 0) {
    console.log(`  Google Books: (no results)${result.json ? ` totalItems=${result.json.totalItems}` : ''}`);
    return;
  }

  const src = result.cached ? 'cached' : 'fetched';
  console.log(`  Google Books: ${result.json.items.length} item(s) [${src}]`);

  result.json.items.forEach((item, i) => {
    const vi = item.volumeInfo || {};
    const pre = result.json.items.length > 1 ? `    [${i}] ` : '    ';
    console.log(`${pre}title:      "${vi.title || ''}"`);
    if (vi.subtitle) console.log(`${pre}subtitle:   "${vi.subtitle}"`);
    console.log(`${pre}authors:    ${JSON.stringify(vi.authors || [])}`);
    console.log(`${pre}publisher:  "${vi.publisher || ''}"`);
    console.log(`${pre}pubDate:    "${vi.publishedDate || ''}"`);
    console.log(`${pre}language:   "${vi.language || ''}"`);
    console.log(`${pre}categories: ${JSON.stringify(vi.categories || [])}`);
    console.log(`${pre}pageCount:  ${vi.pageCount || ''}`);
    console.log(`${pre}thumbnail:  ${vi.imageLinks?.thumbnail ? '✓' : '(none)'}`);
  });

  const parsed = parseGoogleBooksResponse(isbn13, result.json);
  if (parsed) {
    console.log(`    → parsed title: "${parsed.title}"`);
  }
}

function printNdl(isbn13, result) {
  if (result.error) {
    console.log(`  NDL Search:   ERROR - ${result.error}`);
    return;
  }
  if (!result.xml) {
    console.log(`  NDL Search:   (no response)`);
    return;
  }
  if (result.xml.includes('Record does not exist')) {
    console.log(`  NDL Search:   (record does not exist)`);
    return;
  }
  if (result.xml.includes('<numberOfRecords>0</numberOfRecords>')) {
    console.log(`  NDL Search:   (no results)`);
    return;
  }

  const src = result.cached ? 'cached' : 'fetched';
  // レコード数
  const numMatch = result.xml.match(/<numberOfRecords>(\d+)<\/numberOfRecords>/);
  const numRecords = numMatch ? numMatch[1] : '?';
  console.log(`  NDL Search:   ${numRecords} record(s) [${src}]`);

  // 各レコードの type と title を表示
  const records = result.xml.split('<record>').slice(1);
  records.forEach((rec, i) => {
    const typeMatch = rec.match(/type : (\w+)/);
    const type = typeMatch ? typeMatch[1] : '?';
    const titleMatch = rec.match(/dcterms:title&gt;([^&]+)/);
    const title = titleMatch ? titleMatch[1].trim() : '(no title)';
    const pubMatch = rec.match(/foaf:name&gt;([^&]+)/);
    const pub = pubMatch ? pubMatch[1].trim() : '';
    const pre = records.length > 1 ? `    [${i}] ` : '    ';
    console.log(`${pre}[${type}] "${title}"${pub ? ` / ${pub}` : ''}`);
  });
}

// ============================================================
// メイン
// ============================================================

async function main() {
  const isbns = loadIsbns();

  console.log('=== API Response Viewer ===');
  console.log(`API Key: ${GOOGLE_BOOKS_API_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`Cache:   dev/responses/`);
  console.log(`ISBNs:   ${isbns.length} book(s) from dev/isbns.txt\n`);

  for (const [isbn, memo] of isbns) {
    const validation = validateAndNormalizeIsbn(isbn);
    console.log(`--- ${isbn}${memo ? '  ' + memo : ''} ---`);

    if (!validation.valid) {
      console.log(`  Invalid ISBN: ${validation.error}\n`);
      continue;
    }

    const isbn13 = validation.isbn13;

    // Google Books
    try {
      const gb = await getGoogleBooks(isbn13);
      printGoogleBooks(isbn13, gb);
    } catch (e) {
      console.log(`  Google Books: FETCH ERROR - ${e.message}`);
    }

    // NDL Search
    try {
      const ndl = await getNdlSearch(isbn13);
      printNdl(isbn13, ndl);
    } catch (e) {
      console.log(`  NDL Search:   FETCH ERROR - ${e.message}`);
    }

    console.log('');
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(console.error);
