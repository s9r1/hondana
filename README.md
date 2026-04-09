# Hondana — GAS 蔵書管理テンプレート

Google Apps Script (GAS) + Google Sheets で動く蔵書管理 Web アプリのテンプレート。

ISBN バーコードスキャン → Google Books API / NDL Search で書籍情報を自動取得 → スプレッドシートに登録。

## セットアップ

### 1. リポジトリ作成

GitHub の "Use this template" ボタンで新しいリポジトリを作成。

### 2. 依存インストール

```bash
npm install
```

### 3. GAS プロジェクト作成

```bash
npx clasp login          # Google アカウントで認証
npx clasp create --type webapp --title "My Library"
```

`.clasp.json` が自動生成される。`.clasp.json.example` を参考に `rootDir: "src"` を追加。

### 4. スプレッドシート準備

GAS プロジェクトにバインドされたスプレッドシートに以下のシートを作成：

- **Library** — 書籍データ（ヘッダ行: id, registeredAt, isbn, title, author, publisher, pubdate, genre, language, shelf, status, borrower, updatedAt, note, thumbnailUrl, source）
- **Shelves** — 棚マスタ（A列に棚ID: `A-1`, `A-2`, `B-1` など）

### 5. デプロイ

```bash
npx clasp push
```

GAS エディタ → デプロイ → ウェブアプリ → アクセス権限を設定して公開。

## カスタマイズ

`src/webapp.js` の先頭でサイト名を設定：

```javascript
var SITE_NAME = 'XY大学Z研究室 蔵書管理';
```

`src/Index.html` の `CONFIG` でその他を設定：

```javascript
var CONFIG = {
  defaultLang: 'ja',    // 'ja' or 'en'
  theme: 'blue'         // 'blue' | 'green' | 'purple' | 'warm'
};
```

### カラーテーマ

`blue` / `green` / `purple` / `warm` から選択。未指定時は CSS デフォルトの配色。

### パスワード保護（任意）

GAS エディタ → プロジェクトの設定 → スクリプトプロパティに追加：
- キー: `APP_PASSWORD`
- 値: 任意のパスワード

設定するとアクセス時にパスワード入力画面が表示される。未設定なら認証なし。

## Google Books API キー

1. [Google Cloud Console](https://console.cloud.google.com/) で Books API を有効化
2. API キーを作成
3. GAS エディタ → プロジェクトの設定 → スクリプトプロパティに追加:
   - キー: `GOOGLE_BOOKS_API_KEY`
   - 値: 取得した API キー

ローカルテスト時は `test/.env` ファイルに記述：

```
GOOGLE_BOOKS_API_KEY=AIza...
```

## スクリプトプロパティ一覧

| キー | 必須 | 説明 |
|------|------|------|
| `GOOGLE_BOOKS_API_KEY` | ○ | Google Books API キー |
| `APP_PASSWORD` | - | パスワード保護 |

## テスト

```bash
npm test                      # vitest
node test/fetchLocal.js       # API実地テスト（test/.env に API キーを記述）
```

## ライセンス

ISC
