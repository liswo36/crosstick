# デザイン

## 方針（オーナー指定）
Google Material Design 3 準拠／ユニバーサルデザイン（誰でも見やすい）／明るい色／Noto Sans（日本語UIは Noto Sans JP）／文字はやや大きめ。ライト・ダーク両対応。

## トークン（`src/styles.css` の `:root`）
| 用途 | 変数 |
|---|---|
| 背景・面 | `--bg` `--surface` `--stage`（ステージは白） `--plate` `--seg-bg` |
| 文字 | `--on-surface` `--on-surface-var` `--outline` `--outline-var` |
| 主色（MD3ブルー） | `--primary` `--on-primary` `--primary-container` `--on-primary-container` |
| 点数の色 | `--p1` `--p3` `--p6` `--m3`（選択チップ上は暗い `*-on`） |
| スコアバッジ | `--score-bg` `--on-score` |
| 注意欄 | `--note-bg` `--note-fg` |
| 非強調 | `--dim`（#cfd4d9）、`--neg` |
| フォント | `--font-ui` `--font-glyph` |

ダークは `@media (prefers-color-scheme: dark)` と `[data-theme]` で上書き。色をコードに直書きしない（パズルの11色パレットは `core.js` に定義）。

## 判断の記録
- **レイアウト**: ギャラリー展示型。中央に大きな白いステージ、その下に銘柄行、最下部に浮かぶ操作ドック。撮影モードは操作を隠して枠だけ。
- **点数の数字**: 背景（ベース）を敷かず文字色のみ。太さは一定（強調は色で）。大きい値ほど目立つ色。
- **ロゴ**: 英語＋カタカナのバイリンガル（中央揃え）。パスに展開（フォント非依存）し、`<symbol id="cx-logo">` として1つ定義して画面と書き出しで共用。比率 3.925。
- **書き出しのスコア**: 既定OFF（絵として使うことが多いため）。
- **非強調グレー**: #cfd4d9（旧仕様書は #a0a0a0）。
- **タイルの隙間**: ステージ背景色の隙間で見せる（白枠ではない）。
