/**
 * ローカルで実際のAPIを叩いてレスポンスを確認するスクリプト
 * 実行: node test/fetchLocal.js
 *
 * テスト用ISBNリストで Google Books API と NDL Search を呼び出して結果を表示する。
 * fixture収集にも使える。
 *
 * Google Books APIキー設定:
 *   1. test/.env ファイルに GOOGLE_BOOKS_API_KEY=AIza... と記述
 *   2. または環境変数で直接指定
 */

const fs = require('fs');
const path = require('path');
const { validateAndNormalizeIsbn } = require('../src/isbn.js');
const { parseGoogleBooksResponse } = require('../src/googleBooks.js');

// .env ファイルから環境変数を読み込む（簡易実装）
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const TEST_ISBNS = [
  ['9780195132601', 'The Mechanisms of Governance (en)'],
  ['9784641165779', 'ゲーム理論 / 岡田章 (ja)'],
];

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

async function fetchGoogleBooks(isbn13) {
  var url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&country=JP`;
  if (GOOGLE_BOOKS_API_KEY) {
    url += `&key=${GOOGLE_BOOKS_API_KEY}`;
  }
  const res = await fetch(url);
  if (!res.ok) {
    return { error: `HTTP ${res.status}`, body: await res.text() };
  }
  return await res.json();
}

async function fetchNdlSearch(isbn13) {
  const url = `https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordSchema=dcndl&maximumRecords=1&onlyBib=true&query=isbn=${isbn13}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { error: `HTTP ${res.status}` };
  }
  return await res.text();
}

async function main() {
  console.log('=== Local API Test ===');
  console.log(`Google Books API Key: ${GOOGLE_BOOKS_API_KEY ? 'SET' : 'NOT SET (may hit rate limits)'}\n`);

  for (const [isbn, memo] of TEST_ISBNS) {
    const validation = validateAndNormalizeIsbn(isbn);
    console.log(`--- ${memo || isbn} (${isbn}) ---`);
    console.log(`  ISBN valid: ${validation.valid}, ISBN-13: ${validation.isbn13}`);

    // Google Books
    try {
      const gbJson = await fetchGoogleBooks(validation.isbn13);
      if (gbJson.error) {
        console.log(`  Google Books: ERROR - ${gbJson.error}`);
      } else {
        const parsed = parseGoogleBooksResponse(validation.isbn13, gbJson);
        if (parsed) {
          console.log(`  Google Books: ✓`);
          console.log(`    title:     ${parsed.title}`);
          console.log(`    authors:   ${parsed.authors.join(', ')}`);
          console.log(`    publisher: ${parsed.publisher || '(empty)'}`);
          console.log(`    language:  ${parsed.language}`);
          console.log(`    categories:${(parsed.categories || []).join(', ') || '(none)'}`);
          console.log(`    thumbnail: ${parsed.thumbnail ? '(exists)' : '(none)'}`);
        } else {
          console.log(`  Google Books: (no results)`);
        }
      }
    } catch (e) {
      console.log(`  Google Books: FETCH ERROR - ${e.message}`);
    }

    // NDL Search
    try {
      const ndlXml = await fetchNdlSearch(validation.isbn13);
      if (typeof ndlXml === 'object' && ndlXml.error) {
        console.log(`  NDL Search:  ERROR - ${ndlXml.error}`);
      } else {
        const hasRecords = !ndlXml.includes('<numberOfRecords>0</numberOfRecords>');
        console.log(`  NDL Search:  ${hasRecords ? '✓ (data found)' : '(no results)'}`);
        if (hasRecords) {
          const titleMatch = ndlXml.match(/<dcterms:title>([^<]+)<\/dcterms:title>/);
          if (titleMatch) console.log(`    title:     ${titleMatch[1]}`);
          const pubMatch = ndlXml.match(/<foaf:name>([^<]+)<\/foaf:name>/);
          if (pubMatch) console.log(`    publisher: ${pubMatch[1]}`);
        }
      }
    } catch (e) {
      console.log(`  NDL Search:  FETCH ERROR - ${e.message}`);
    }

    console.log('');
  }
}

main().catch(console.error);
