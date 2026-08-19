# HelpBox

> このプログラムは完全なAI生成です。

Markdownから検索付きの日本語ヘルプセンターを生成するAstro Integrationです。画面、ルーティング、記事スキーマ、Pagefindの検索索引生成をパッケージ側で管理し、利用側は設定と記事だけを保持します。

生成結果は静的HTMLです。実行時のサーバー、データベース、外部検索APIを必要とせず、Cloudflare Workers Static Assetsなどへ配置できます。

## 必要なもの

- Node.js 22.12以降
- npm

## 新しいサイトを作る

```bash
npx @ookam/helpbox init my-help-center
cd my-help-center
npm run dev
```

初期化コマンドは、空のディレクトリに次のファイルを生成して依存パッケージをインストールします。

```text
my-help-center/
├── astro.config.mjs
├── helpbox.config.ts
├── src/content.config.ts
├── content/
├── public/favicon.svg
├── package.json
├── tsconfig.json
└── wrangler.jsonc
```

既存ディレクトリへファイルだけ生成する場合は次を使います。

```bash
npx @ookam/helpbox init . --skip-install
npm install
```

既存ファイルを誤って上書きしないよう、初期化先に`.git`以外のファイルがある場合は停止します。

## 設定

`helpbox.config.ts`がサイト固有の設定です。

```ts
import { defineHelpbox } from '@ookam/helpbox';

export default defineHelpbox({
  name: 'My Help Center',
  siteUrl: 'https://help.example.com',
  description: 'よくある質問と使い方をご案内します。',
  service: {
    name: 'My Service',
    url: 'https://example.com',
  },
  audiences: [
    {
      id: 'user',
      label: 'ご利用者向けヘルプ',
      categories: [
        { id: 'getting-started', label: 'はじめに' },
      ],
    },
  ],
});
```

設定できる主な項目は次のとおりです。

- `name`、`description`、`siteUrl`
- 元サービスの`name`と`url`
- 対象ユーザーとカテゴリー
- 問い合わせ先とフッターリンク
- ヘッダーのブランド画像とfaviconのパス
- 主要色のテーマ設定

対象IDとカテゴリーIDには英小文字、数字、ハイフンだけを使用します。重複や不正なURLは起動時に検出されます。
`404`と`pagefind`は内部ルートの予約語のため、対象IDには使用できません。現在はルートドメイン向けの構成で、Astroの`base`は`/`、`build.format`は`directory`、`build.assets`は`_astro`だけをサポートします。

対象ユーザーとカテゴリーは、各ページのフッターにある「ヘルプを探す」にも自動で反映されます。`contact`を設定すると問い合わせ先が、`footerLinks`を設定すると関連リンクがフッターに表示されます。`brandMark`にはヘッダーへ表示する画像のURLまたは`/favicon.svg`のような公開パスを指定できます。未設定の場合はテキストのサイト名だけを表示します。

## 記事を追加する

記事は利用側の`content/`以下にMarkdownで配置します。

```md
---
title: 利用を開始する
summary: 初回利用時の手順をご案内します。
audience: user
category: getting-started
tags:
  - はじめに
featured: true
updatedAt: 2026-08-18
order: 10
---

## 設定を確認する

画面の案内に沿って必要な項目を設定します。
```

| 項目 | 必須 | 内容 |
| --- | --- | --- |
| `title` | はい | 記事タイトル |
| `summary` | はい | 一覧と検索結果に使う概要 |
| `audience` | はい | 設定に登録した対象ID |
| `category` | はい | 対象内に登録したカテゴリーID |
| `tags` | いいえ | タグの配列 |
| `featured` | いいえ | トップの「まず読む記事」に表示 |
| `kind` | いいえ | `guide`または`notice` |
| `publishedAt` | お知らせのみ | お知らせの公開日 |
| `updatedAt` | はい | 記事の更新日 |
| `draft` | いいえ | `true`なら公開対象外 |
| `order` | いいえ | 小さい値から表示 |

記事URLは`/{audience}/post/{ファイル名}/`です。ファイル名は英小文字、数字、ハイフンだけで付け、同じ対象内では重複させないでください（例: `getting-started.md`）。

## Astroへの組み込み

初期化後の`astro.config.mjs`は次の構成です。

```js
import { defineConfig } from 'astro/config';
import helpbox from '@ookam/helpbox';
import config from './helpbox.config.ts';

export default defineConfig({
  integrations: [helpbox({ config })],
});
```

Integrationはヘルプセンターのルートを登録し、静的ビルド完了後にPagefind索引を`dist/pagefind/`へ生成します。通常の`astro dev`では検索索引がないため、検索を含めた確認には`npm run preview`を使用します。

## バージョンアップ

画面や検索処理を利用側へコピーしないため、通常の更新は依存パッケージの更新だけで完了します。

```bash
npm update @ookam/helpbox
npm run check
npm run build
```

互換性を壊す設定変更はメジャーバージョンで提供します。

## Cloudflareへ公開する

初期化時に静的アセット専用の`wrangler.jsonc`を生成します。

```bash
npm run deploy
```

Cloudflare Buildsではビルドコマンドを`npm run build`、出力ディレクトリを`dist`に設定してください。独自ドメインを使う場合は`helpbox.config.ts`の`siteUrl`も同じURLにします。

## 公開パッケージの安全確認

公開対象は`package.json`の`files`でIntegration、UI、CLI、汎用テンプレートだけに制限しています。`prepublishOnly`では型検査、実サイト相当のビルド、CLI生成テスト、`npm pack`内容のallowlist検査、秘密情報・個人情報・不適切なサンプル文言の検査を実行します。

## ライセンス

[MIT](LICENSE)
