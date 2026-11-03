# ティッカー一覧の更新

`src/data/vn-tickers.txt` が唯一のデータ源です。1行1コード、`#` 始まりはコメント。ビルド時に `src/app.js` へ埋め込まれ、大文字英数3文字・重複なしを検査します（違反するとビルドが失敗）。

## 現在の一覧
- 出典: Vietstock Finance（finance.vietstock.vn）企業一覧
- 全1,543件のうち3文字の **1,519件**、取得日 2026-11-03
- 対象: HOSE・HNX・UPCoM

## 更新の手順
1. Vietstock の企業一覧（`/data/corporateaz`）から全コードを取得する。確認できている仕様:
   - POST `/data/corporateaz`、パラメータ: `catID`, `industryID`, `page`, `pageSize`（50以下）, `type=1`, `code`（前方一致）, `businessTypeID`, `orderBy`, `orderDir`, `__RequestVerificationToken`
   - ページングは効かない（page=1のみ有効）。結果が `pageSize` 件に達したら、`code` の前方一致プレフィックスを1文字ずつ伸ばして再帰的に分割取得する。
   - 取得は自分のブラウザ（サイトを開いた状態）で行う。トークンはページから得る。
2. 3文字のコードだけを抜き出し、重複を除いて昇順に並べ、`src/data/vn-tickers.txt` に置く。先頭のコメント行（出典・件数・取得日）も更新する。
3. `npm run build && npm test`。件数は `tests/core.test.mjs`（1,500件以上・形式・主要銘柄の有無）で確認される。
4. `docs/CHANGELOG.md` に件数と取得日を書く。

> 新規上場・上場廃止は随時あるため、数か月に1回の更新を目安にする。別の出典（取引所公表リスト）と件数を突き合わせると確実。
