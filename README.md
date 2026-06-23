# なこ用ツール箱

ダナがなこのために作った、公開安全な個人用PWAツール箱。

## 収録ツール

- 名前置換メーカー
- ワード変換メーカー

## 公開安全方針

GitHubには空の道具本体だけを置く。
キャラ名、変換ルール、入力文は端末内のブラウザ保存領域に保持し、リポジトリへ送らない。

## ファイル構成

```text
index.html
name-replacer.html
word-replacer.html
manifest.json
service-worker.js
assets/
  css/app.css
  js/common.js
  js/dashboard.js
  js/name-replacer.js
  js/word-replacer.js
  images/dana-dashboard.jpg
icons/
docs/PROJECT_BRIEF.md
```

## GitHub Pages

リポジトリ直下へこのZIPの中身をアップロードし、
Settings → Pages → Deploy from a branch → main / root を指定する。

## 更新時の注意

`service-worker.js` の `CACHE_NAME` を変更しないと、古いファイルが端末側に残る場合がある。
