import { readFile, readdir, stat } from 'node:fs/promises';
import { relative } from 'node:path';

const dist = new URL('../examples/basic/dist/', import.meta.url);
const requiredFiles = [
  'index.html',
  '404.html',
  'user/index.html',
  'admin/index.html',
  'user/search/index.html',
  'user/post/welcome/index.html',
  'admin/post/welcome/index.html',
  'pagefind/pagefind.js',
];

for (const file of requiredFiles) await stat(new URL(file, dist));

const htmlFiles = await collectHtmlFiles(dist);
if (htmlFiles.length < 10) throw new Error('期待する静的ページが生成されていません。');

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const name = relative(dist.pathname, file.pathname);
  if (!html.includes('<html lang="ja">')) {
    throw new Error(`${name} に日本語のlang属性がありません。`);
  }
  if (html.includes('help.tiget.net')) {
    throw new Error(`${name} に外部サービス固有のURLが含まれています。`);
  }
}

const searchBundle = await readFile(new URL('pagefind/pagefind.js', dist), 'utf8');
if (!searchBundle.includes('Pagefind')) throw new Error('Pagefindのブラウザ用bundleが不正です。');

const searchPage = await readFile(new URL('user/search/index.html', dist), 'utf8');
for (const expected of [
  "normalize('NFKC')",
  'searchGeneration',
  '一致する記事が見つかりませんでした',
  '通信状況を確認して、ページを再読み込みしてください',
]) {
  if (!searchPage.includes(expected)) throw new Error(`検索ページに必要な処理がありません: ${expected}`);
}

const homePage = await readFile(new URL('user/index.html', dist), 'utf8');
for (const expected of [
  'class="brand-mark" src="/favicon.svg" alt=""',
  'aria-label="ヘルプカテゴリー"',
  'href="/user/category/getting-started/"',
  'href="/admin/category/getting-started/"',
  'class="footer-contact"',
  'href="https://example.com/contact"',
  'aria-label="Example Serviceの関連リンク"',
  'href="https://example.com/"',
]) {
  if (!homePage.includes(expected)) throw new Error(`フッターに必要な要素がありません: ${expected}`);
}

const cssFiles = (await readdir(new URL('_astro/', dist))).filter((name) => name.endsWith('.css'));
const styles = (await Promise.all(cssFiles.map((name) => readFile(new URL(`_astro/${name}`, dist), 'utf8')))).join('\n');
for (const expected of [
  '.search-more[hidden]',
  '.prose table',
  'outline:3px solid var(--color-primary)',
  '.footer-audience-grid',
  '.footer-contact-link',
]) {
  if (!styles.includes(expected)) throw new Error(`生成CSSに必要なスタイルがありません: ${expected}`);
}
if (/box-shadow:(?!none)/.test(styles)) throw new Error('生成CSSにshadowが残っています。');

console.log(`${htmlFiles.length}ページと${requiredFiles.length}件の必須成果物を検証しました。`);

async function collectHtmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await collectHtmlFiles(url));
    else if (entry.name.endsWith('.html')) files.push(url);
  }
  return files;
}
