# __PROJECT_NAME__

> このプログラムは完全なAI生成です。

`@ookam/helpbox`で生成した静的ヘルプセンターです。

## 開発

```bash
npm install
npm run dev
```

サイト設定は`helpbox.config.ts`、記事は`content/`以下のMarkdownを編集してください。
記事ファイル名には英小文字、数字、ハイフンだけを使用してください（例: `getting-started.md`）。

全文検索は静的ビルド時に生成されるため、検索を確認する場合は`npm run preview`を使用します。

## Cloudflareへ公開

```bash
npm run deploy
```

公開前に`helpbox.config.ts`の`siteUrl`と`wrangler.jsonc`のWorker名を確認してください。
