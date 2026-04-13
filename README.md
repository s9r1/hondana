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

### 3. スプレッドシート作成

[Google Sheets](https://sheets.google.com/) で新規スプレッドシートを作成。シート（Library / Manual / Shelves）は初回アクセス時に自動作成されるため、手動作成は不要。

### 4. GAS プロジェクト作成・デプロイ

```bash
npx clasp login                                         # 初回のみ
cd src
npx clasp create --parentId <スプレッドシートID> --title "My Library"
npx clasp push
```

スプレッドシートIDは URL の `https://docs.google.com/spreadsheets/d/`**ここ**`/edit` の部分。

`clasp create` で生成される `appsscript.json` のタイムゾーンがデフォルト `America/New_York` になるため、必要に応じて `Asia/Tokyo` 等に変更してから `clasp push`。

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

### パスワード保護（任意）

スクリプトプロパティに `APP_PASSWORD` を設定するとアクセス時にパスワード入力画面が表示される。未設定なら認証なし。

## Google Books API キー

1. [Google Cloud Console](https://console.cloud.google.com/) で Books API を有効化
2. API キーを作成
3. スクリプトプロパティに `GOOGLE_BOOKS_API_KEY` として追加

ローカルテスト時は `test/.env` に記述：

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
node test/fetchLocal.js       # API実地テスト
```

## ライセンス

ISC
