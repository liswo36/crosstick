# 公開と更新

## Cloudflare Pages（現行・Direct Upload）
- プロジェクト名: `crosstick`、URL: https://crosstick.pages.dev/
1. `npm run build`
2. `dist/site/` の **中身**（`index.html`, `_headers`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `og.png`）をアップロードする。
   - 手動: Cloudflare ダッシュボード → Workers & Pages → `crosstick` → 新しいデプロイ → フォルダまたはzipをアップロード。zipの場合は `cd dist/site && zip -r ../crosstick-site.zip .`（フォルダごと入れない）。
   - CLI: `npx wrangler pages deploy dist/site --project-name crosstick`（要 `wrangler login`）。
3. 公開後の確認: ページが開く／ブラウザの開発者ツールで CSP エラーが出ない／画像保存できる／SNSでURLを貼ってOGP画像が出る。

### GitHub連携にする場合（任意）
Cloudflare Pages の「Git に接続」で本リポジトリを選び、ビルドコマンド `npm run build`、出力ディレクトリ `dist/site` に設定すると、push のたびに自動公開される。

### URLを変えたら
独自ドメインにしたときは `site.config.json` の `siteUrl` を直し（OGPの `og:url` / `og:image` に使われる）、再ビルド・再公開する。

## Claude Artifact
- Artifact: https://claude.ai/artifact/FYvFoHKYtEwchzahruowpY（capability: `downloads`）
- `npm run build` の後、`dist/artifact.html` を Claude に渡して同じ Artifact に再公開を頼む。断片HTML（`<!doctype>`や`<html>`なし）が正しい形式。
