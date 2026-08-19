#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const command = args[0];

if (command === '--version' || command === '-v') {
  console.log(packageJson.version);
  process.exit(0);
}

if (!command || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command !== 'init') {
  console.error(`不明なコマンドです: ${command}`);
  printHelp();
  process.exit(1);
}

const initArguments = args.slice(1);
if (initArguments.includes('--help') || initArguments.includes('-h')) {
  printHelp();
  process.exit(0);
}

const unknownFlags = initArguments.filter(
  (argument) => argument.startsWith('-') && argument !== '--skip-install',
);
if (unknownFlags.length > 0) {
  console.error(`不明なオプションです: ${unknownFlags.join(', ')}`);
  process.exit(1);
}

const targets = initArguments.filter((argument) => !argument.startsWith('-'));
if (targets.length > 1) {
  console.error('初期化先は1つだけ指定してください。');
  process.exit(1);
}

const skipInstall = initArguments.includes('--skip-install');
const targetArgument = targets[0] || '.';
const targetDirectory = resolve(process.cwd(), targetArgument);
const templateDirectory = new URL('../template/basic/', import.meta.url);
const projectName = packageName(basename(targetDirectory));
const workerName = workerSlug(projectName);

await mkdir(targetDirectory, { recursive: true });
const existingEntries = await readdir(targetDirectory);
const allowedEntries = new Set(['.git']);
const unexpectedEntries = existingEntries.filter((entry) => !allowedEntries.has(entry));
if (unexpectedEntries.length > 0) {
  console.error(`初期化先が空ではありません: ${targetDirectory}`);
  console.error(`既存ファイル: ${unexpectedEntries.join(', ')}`);
  process.exit(1);
}

await cp(templateDirectory, targetDirectory, { recursive: true, force: false });
await rename(join(targetDirectory, '_gitignore'), join(targetDirectory, '.gitignore'));

const replacements = new Map([
  ['__PROJECT_NAME__', projectName],
  ['__WORKER_NAME__', workerName],
  ['__HELPBOX_VERSION__', packageJson.version],
]);

const replacementFiles = ['package.json', 'README.md', 'wrangler.jsonc'];
for (const relativePath of replacementFiles) {
  const file = join(targetDirectory, relativePath);
  let content = await readFile(file, 'utf8');
  for (const [placeholder, value] of replacements) content = content.replaceAll(placeholder, value);
  await writeFile(file, content, 'utf8');
}

console.log(`HelpBoxを初期化しました: ${targetDirectory}`);

if (!skipInstall) {
  console.log('依存パッケージをインストールしています…');
  const invocation = npmInvocation(['install']);
  const exitCode = await run(invocation.executable, invocation.args, targetDirectory);
  if (exitCode !== 0) process.exit(exitCode);
}

const relativeTarget = targetArgument === '.' ? '.' : targetArgument;
console.log('\n次のコマンド:');
if (relativeTarget !== '.') console.log(`  cd ${relativeTarget}`);
if (skipInstall) console.log('  npm install');
console.log('  npm run dev');

function printHelp() {
  console.log(`HelpBox ${packageJson.version}

使い方:
  helpbox init [directory] [--skip-install]
  helpbox --version

例:
  npx @ookam/helpbox init my-help-center`);
}

function packageName(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'helpbox-site';
}

function workerSlug(value) {
  return value
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63) || 'helpbox-site';
}

function run(executable, childArgs, cwd) {
  return new Promise((resolveExitCode, reject) => {
    const child = spawn(executable, childArgs, { cwd, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code) => resolveExitCode(code ?? 1));
  });
}

function npmInvocation(childArgs) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && /npm-cli\.js$/i.test(npmExecPath)) {
    return {
      executable: process.execPath,
      args: [npmExecPath, ...childArgs],
    };
  }

  if (process.platform === 'win32') {
    return {
      executable: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm', ...childArgs],
    };
  }

  return { executable: 'npm', args: childArgs };
}
