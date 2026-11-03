# Crosstick（クロスティック）

ベトナム株のティッカーコード（HOSE・HNX・UPCoM の3文字コード）を、共通する文字で交差させて **クロスワード風のカラフルなパズル** にするWebツールです。重なりの多さを点数にし、1:1 / 16:9 / 9:16 の画像として保存できます。入力内容は端末の外へ送信されません。

- 公開サイト: https://crosstick.pages.dev/
- Claude Artifact 版（非公開）: https://claude.ai/artifact/FYvFoHKYtEwchzahruowpY

## 使い方（変更する人向け）

```bash
npm run build        # dist/ を生成（Node 18 以上。外部パッケージ不要）
npm test             # 単体テスト（配置エンジン・ティッカー一覧・ビルド）
npm run test:e2e     # 画面チェック（要 Python + Playwright。CHROME=Chromeのパス で指定可）
```

| 変えたいこと | 触るファイル |
|---|---|
| 見た目（色・余白・フォント） | `src/styles.css` |
| 画面の部品・文言 | `src/body.html` |
| 画面の動き・画像書き出し | `src/app.js` |
| 配置アルゴリズム・採点・色の割り当て | `src/core.js`（画面に依存しない。`tests/core.test.mjs` で検証） |
| ティッカー一覧の更新 | `src/data/vn-tickers.txt`（手順: `docs/DATA.md`） |
| ロゴ | `src/partials/logo-symbol.html`（元SVGは `assets/logo/`） |
| サイトURL・タイトル・説明文（OGP） | `site.config.json` |
| ファビコン・OGP画像・セキュリティヘッダ | `public/` |

`dist/` は **生成物** です。直接編集せず、`src/` を直してから `npm run build` します。`dist/` もコミットしてあるので、そのままアップロードできます。

## 構成

```
src/            ソース（HTML/CSS/JS を部品ごとに分割）
  core.js         配置・採点エンジン
  app.js          画面処理・画像書き出し（ティッカー一覧は埋め込み用の目印だけ持つ）
  styles.css      スタイル（Material Design 3 の配色トークン）
  body.html       画面の骨組み
  head.artifact.html  Artifact 版だけの <head> 断片
  partials/       ロゴSVG
  data/           ティッカー一覧
public/         公開時にそのままコピーするファイル
scripts/build.mjs  ビルド
tests/          単体テスト・画面チェック
docs/           仕様・設計・データ更新・公開手順・変更履歴・ドキュメントとコードの差異
dist/           生成物（site/ = 公開サイト, artifact.html = Claude Artifact 用）
```

## ドキュメント

- [CLAUDE.md](CLAUDE.md) … Claude Code / Claude に作業を頼むときの前提・ルール
- [docs/SPEC.md](docs/SPEC.md) … 仕様（コードが正）
- [docs/DESIGN.md](docs/DESIGN.md) … デザイン方針・トークン・判断の理由
- [docs/DATA.md](docs/DATA.md) … ティッカー一覧の更新手順
- [docs/DEPLOY.md](docs/DEPLOY.md) … Cloudflare Pages への公開、Artifact の更新
- [docs/CHANGELOG.md](docs/CHANGELOG.md) … 変更履歴
- [docs/DISCREPANCIES.md](docs/DISCREPANCIES.md) … 旧仕様書とコードの差異（コードが正）
