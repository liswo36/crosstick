# CLAUDE.md — Crosstick

ベトナム株ティッカーのパズルツール。単一HTMLにビルドされる静的サイト。詳細は README.md と docs/。

## 作業の基本
- 変更は `src/`・`public/`・`site.config.json` に加え、`npm run build` → `npm test` を通す。`dist/` は生成物なので手で編集しない（ただしコミットには含める）。
- 画面を触ったら `npm run test:e2e` も実行し、PC（1280×720, 1440×900, 1024×640）とスマホ（390×780, 390×700, 360×640）で **ページ全体がスクロールしない** ことを保つ。
- 変更したら `docs/CHANGELOG.md` に1行足す。仕様が変わったら `docs/SPEC.md` も直す。
- **ドキュメントとコードが食い違ったらコードが正。** 食い違いを見つけたら `docs/DISCREPANCIES.md` に追記し、作業報告の最後に一覧で伝える。

## デザイン方針（オーナーの指定）
- HTML は Google Material Design 3 準拠、ユニバーサルデザイン、明るい色、フォントは Noto Sans（日本語は Noto Sans JP）、文字はやや大きめ。
- ライト／ダーク両対応（`prefers-color-scheme`）。色はCSS変数（`src/styles.css` 冒頭）で定義し、直書きしない。
- 点数の数字は **背景を敷かず文字色だけ** で表す（プラス＝寒色、マイナス＝暖色、大きいほど目立つ色）。文字の太さは一定。

## 守る制約
- 入力はVN上場の3文字コードのみ（`src/data/vn-tickers.txt` に無いコードは受け付けない）。最大40銘柄。
- 外部へ通信しない（CSP `connect-src 'none'`）。`fetch`/XHR/WebSocket を入れない。外部読み込みは Google Fonts のみ。
- 書き出し画像: 1600² / 1920×1080 / 1080×1920。ファイル名は `crosstick-YYYYMMDD-HHMMSS-1x1|16x9|9x16.png`。点数表示は既定OFF。
- 配置は決定的（同じ入力・同じパターンなら同じ結果）。`core.js` を変えたら `tests/core.test.mjs` を確認する。

## 配置先
- 公開: Cloudflare Pages（プロジェクト名 `crosstick`、Direct Upload）。手順は `docs/DEPLOY.md`。
- Claude Artifact: `dist/artifact.html` を同じArtifactに再公開する（capability は `downloads`）。
