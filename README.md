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
npx clasp login                                    # 初回のみ
cd src
npx clasp create --type sheets --title "My Library"
```

スプレッドシートと GAS プロジェクトが同時に作成される。

### 4. タイムゾーン設定

`clasp create` で生成される `appsscript.json` のタイムゾーンがデフォルトで `America/New_York` になるため、GAS エディタ → プロジェクトの設定 → タイムゾーンを `Asia/Tokyo` 等に変更し、ローカルに反映：

```bash
npx clasp pull
```

### 5. デプロイ

```bash
npx clasp push
```

スプレッドシートを開くと Library / Manual / Shelves シートが自動作成される。

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

ローカルで API レスポンスを確認する場合は `dev/.env` に記述：

```
GOOGLE_BOOKS_API_KEY=AIza...
```

## スクリプトプロパティ一覧

| キー | 必須 | 説明 |
|------|------|------|
| `GOOGLE_BOOKS_API_KEY` | ○ | Google Books API キー |
| `APP_PASSWORD` | - | パスワード保護 |

## テスト

GAS エディタで `src/test.js` の関数を選択して実行。ログビュー（Ctrl+Enter）で結果を確認。

ローカルで API レスポンスを確認したい場合、`dev/isbns.txt` に ISBN を記述して実行:

```bash
node dev/fetchLocal.js
```

取得したレスポンスは `dev/responses/` にキャッシュされ、次回以降はローカルから読み込む。再取得する場合はキャッシュファイルを削除する。

## 補足

- Google Books API の `language` フィールドは単一値のため、日英両方の内容を持つ書籍でも `"en"` のみ返されることがある。

## ライセンス

ISC
