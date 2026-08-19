import { readFile } from 'node:fs/promises';
import { execNpm } from './npm-command.mjs';

const root = new URL('../', import.meta.url);
const { stdout } = await execNpm(['pack', '--dry-run', '--json'], {
  cwd: root,
  maxBuffer: 10 * 1024 * 1024,
});
const result = JSON.parse(stdout)[0];
const paths = result.files.map(({ path }) => path);

const allowed = /^(?:(?:LICENSE|README\.md|package\.json)$|(?:bin|src|template)\/)/;
const unexpected = paths.filter((path) => !allowed.test(path));
if (unexpected.length > 0) {
  throw new Error(`npm packageに予期しないファイルがあります: ${unexpected.join(', ')}`);
}

const required = [
  'LICENSE',
  'README.md',
  'package.json',
  'bin/helpbox.mjs',
  'src/index.mjs',
  'src/index.d.ts',
  'src/content.mjs',
  'src/pages/index.astro',
  'src/styles/global.css',
  'template/basic/package.json',
];
for (const path of required) {
  if (!paths.includes(path)) throw new Error(`npm packageに必須ファイルがありません: ${path}`);
}

const forbiddenPathPattern = /(^|\/)(?:\.env(?:\.[^/]+)?|\.dev\.vars(?:\.[^/]+)?|\.npmrc|\.git|dist|examples|node_modules)(?:\/|$)/i;
const forbiddenPaths = paths.filter((path) => forbiddenPathPattern.test(path));
if (forbiddenPaths.length > 0) {
  throw new Error(`npm packageに非公開ファイルがあります: ${forbiddenPaths.join(', ')}`);
}

const checks = [
  ['秘密鍵', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['npm token', /\bnpm_[A-Za-z0-9]{20,}\b/],
  ['API secret', /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}\b/],
  ['Cloudflare credential', /\b(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_ZONE_ID|account_id|zone_id)\b\s*["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/i],
  ['32文字の識別子', /\b[a-f0-9]{32}\b/i],
  ['メールアドレス', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['ローカル絶対パス', /(?:[A-Z]:\\Users\\|\/Users\/|\/home\/)[^\s"']+/i],
  ['外部サービス固有URL', /help\.tiget\.net/i],
  ['不適切なサンプル文言', /(?:fuck|shit|死ね|殺す|差別語)/i],
];

for (const regressionPath of ['src/.env.local', 'template/basic/.env.production', 'src/.dev.vars.production']) {
  if (!forbiddenPathPattern.test(regressionPath)) {
    throw new Error(`監査の回帰テストに失敗しました: ${regressionPath}`);
  }
}

for (const path of paths) {
  const content = await readFile(new URL(path, root), 'utf8');
  for (const [label, pattern] of checks) {
    if (pattern.test(content)) throw new Error(`${path}から${label}を検出しました。`);
  }
}

const readme = await readFile(new URL('README.md', root), 'utf8');
if (!readme.includes('このプログラムは完全なAI生成です')) {
  throw new Error('READMEにAI生成の明記がありません。');
}

const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
if (packageJson.private === true) throw new Error('package.jsonがnpm公開を禁止しています。');
if (packageJson.publishConfig?.access !== 'public') throw new Error('公開範囲がpublicではありません。');
if (packageJson.author) throw new Error('package.jsonに不要な個人情報となるauthorがあります。');
if (packageJson.bin?.helpbox !== 'bin/helpbox.mjs') {
  throw new Error('npmが自動修正しない形式でhelpbox CLIを指定してください。');
}

console.log(`npm公開対象${paths.length}ファイルを安全監査しました。`);
