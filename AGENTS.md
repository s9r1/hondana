## 概要

GAS + Google Sheets の蔵書管理アプリ。ISBN → Google Books / NDL Search → スプレッドシート登録。

## コマンド

- `npx clasp push` — `src/` を GAS にデプロイ
- `npx clasp pull` — GAS 側の変更（`appsscript.json` のタイムゾーン等）を取り込む
- `node dev/fetchLocal.js` — `dev/isbns.txt` の ISBN を API に問い合わせ `dev/responses/` にキャッシュ。シートには触らない
- GAS 上のテスト: `src/test.js` の関数を GAS エディタで実行 → ログビュー (Ctrl+Enter)。vitest は廃止 (コミット `45cd641`)

`.clasp.json` と `appsscript.json` は `.gitignore` 済みで `clasp create` 時に生成される。

## アーキテクチャ

呼び出し: `Index.html` → `google.script.run` → `sheet.js` → `bookApi.js` → `googleBooks.js` / `ndlSearch.js` / `isbn.js`

- **`sheet.js`** — Library / Manual / Shelves の 3 シート CRUD。`COLUMNS` 配列がシート列順の唯一の真実、`HEADERS` と添字を揃える。`getAllBooks` は Library+Manual を結合して返すので呼び出し側は両者を区別しない。
- **`bookApi.js: buildSheetRow`** — Google Books と NDL のマージ。和書 (`ndl.language === 'ja'`) はタイトル・著者を NDL 優先、洋書は GB 優先。出版社は NDL 優先、ジャンルは NDL のみ、サムネイルは GB のみ。
- **`ndlSearch.js`** — レスポンスは SRU エンベロープ内に RDF/XML が **エスケープされた文字列として** 入っているため `XmlService.parse` を 2 段階で呼ぶ。同一 ISBN で「図書」と「論文」が両方ヒットしたら `type : book` を優先。
- **`Index.html`** — 単一 SPA。`isGAS` フラグで `google.script.run` とローカルモック (`MOCK_BOOKS`) を切り替えるため、ブラウザで直接開けば GAS なしで動作確認できる。

## 注意点

- コードは ES2017+。ただし GAS から直接呼ばれる関数 (`doGet`、`onOpen`、`google.script.run` の呼び先) はトップレベル `function` 宣言のまま (const 代入だと GAS が認識しない)。
- 公開サーバー関数は末尾引数 `token` を取り先頭で `requireAuth_` を呼ぶのが規約 (APP_PASSWORD 未設定なら素通し)。フロントは `gasRun` が自動付加するので意識不要。
- ISBN: 入力は 10/13 桁ハイフン有無自由、内部は常に ISBN-13 13桁数字、シート上は `setNumberFormat('@')` + 先頭 `'` 付き。読み出し (`getBooksBySheet_`) で `'` を剥がす。
- Shelves シートは「分類 | 番号」の2カラムで 1行 = 1棚。番号が空なら分類名そのものが棚ID、あれば「分類-番号」。`getShelves` は `{name, no}[]` をシート行順で返し、Library/Manual の棚列には結合済み棚ID文字列を保存する。旧1カラム形式は棚ID全体が分類として扱われそのまま動く。
- `isbn.js` / `googleBooks.js` は末尾で `module.exports` し、`dev/fetchLocal.js` から Node でも使う。GAS では無害。
- ログは `Logger.log` (GAS エディタの実行ログ)。`console.log` ではない。

## 設定

| 設定 | 場所 |
| --- | --- |
| サイト名 | `src/webapp.js` の `SITE_NAME` |
| 言語・テーマ | `src/Index.html` の `CONFIG` |
| `GOOGLE_BOOKS_API_KEY` / `APP_PASSWORD` | スクリプトプロパティ (任意) |
| タイムゾーン | `src/appsscript.json` (`clasp create` 直後は `America/New_York`) |
