import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execNpm } from './npm-command.mjs';

const exec = promisify(execFile);
const root = new URL('../', import.meta.url);
const temporaryRoot = await mkdtemp(join(tmpdir(), 'helpbox-packed-'));
const harness = join(temporaryRoot, 'harness');
const site = join(temporaryRoot, 'site');

try {
  const { stdout } = await execNpm(['pack', '--json', '--pack-destination', temporaryRoot], {
    cwd: root,
    maxBuffer: 20 * 1024 * 1024,
  });
  const packed = JSON.parse(stdout)[0];
  const tarball = join(temporaryRoot, packed.filename);

  await writeFile(join(temporaryRoot, 'package.json'), JSON.stringify({
    name: 'helpbox-packed-test-root',
    private: true,
    workspaces: [],
  }, null, 2));

  await mkdir(harness, { recursive: true });
  await writeFile(join(harness, 'package.json'), JSON.stringify({
    name: 'helpbox-packed-test',
    private: true,
    type: 'module',
    dependencies: {
      '@ookam/helpbox': `file:${tarball}`,
      astro: '^7.2.2',
    },
  }, null, 2));

  await runNpm(['install'], harness);
  const versionResult = await runNpm(['exec', '--', 'helpbox', '--version'], harness);
  if (versionResult.stdout.trim() !== packed.version) {
    throw new Error('インストール後のhelpbox CLIをnpm execで起動できません。');
  }
  await run(process.execPath, [
    join(harness, 'node_modules/@ookam/helpbox/bin/helpbox.mjs'),
    'init',
    site,
    '--skip-install',
  ], harness);

  const sitePackagePath = join(site, 'package.json');
  const sitePackage = JSON.parse(await readFile(sitePackagePath, 'utf8'));
  sitePackage.dependencies['@ookam/helpbox'] = `file:${tarball}`;
  await writeFile(sitePackagePath, `${JSON.stringify(sitePackage, null, 2)}\n`);

  await runNpm(['install'], site);
  await runNpm(['run', 'check'], site);
  await runNpm(['run', 'build'], site);

  await stat(join(site, 'dist/index.html'));
  await stat(join(site, 'dist/user/post/welcome/index.html'));
  await stat(join(site, 'dist/pagefind/pagefind.js'));

  const invalidArticle = join(site, 'content/user/c#-guide.md');
  await writeFile(invalidArticle, '# invalid filename\n');
  await expectNpmFailure(['run', 'build'], site, '記事ファイル名');
  await rm(invalidArticle, { force: true });

  for (const article of [
    join(site, 'content/user/welcome.md'),
    join(site, 'content/admin/welcome.md'),
  ]) {
    const markdown = await readFile(article, 'utf8');
    await writeFile(article, markdown.replace('featured: true', 'featured: true\ndraft: true'));
  }
  await runNpm(['run', 'build'], site);
  await stat(join(site, 'dist/pagefind/pagefind.js'));
  const emptySearchPage = await readFile(join(site, 'dist/user/search/index.html'), 'utf8');
  if (!emptySearchPage.includes('公開中の記事はまだありません')) {
    throw new Error('公開記事0件の検索ページに空状態が表示されません。');
  }

  const publicSearchDirectory = join(site, 'public/pagefind');
  await mkdir(publicSearchDirectory, { recursive: true });
  await writeFile(join(publicSearchDirectory, 'keep.txt'), 'consumer-owned file\n');
  await expectNpmFailure(['run', 'build'], site, '検索出力先');
  await stat(join(site, 'dist/pagefind/keep.txt'));
  await rm(publicSearchDirectory, { recursive: true, force: true });
  await rm(join(site, 'dist/pagefind/keep.txt'), { force: true });

  const astroConfigPath = join(site, 'astro.config.mjs');
  const astroConfig = await readFile(astroConfigPath, 'utf8');
  await writeFile(
    astroConfigPath,
    astroConfig.replace(
      'integrations: [helpbox({ config })],',
      `integrations: [helpbox({ config })],
  vite: {
    build: {
      rollupOptions: {
        output: { assetFileNames: 'pagefind/[name].[hash][extname]' },
      },
    },
  },`,
    ),
  );
  await expectNpmFailure(['run', 'build'], site, '検索出力先');
  const conflictingAssets = await readdir(join(site, 'dist/pagefind'));
  if (!conflictingAssets.some((name) => name.endsWith('.css'))) {
    throw new Error('競合検出時にViteのCSSが保持されませんでした。');
  }

  console.log('npm tarballを空環境へ導入し、CLI生成・型検査・静的ビルド・検索生成・出力競合保護を検証しました。');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function run(executable, args, cwd) {
  return exec(executable, args, {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function runNpm(args, cwd) {
  return execNpm(args, {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function expectNpmFailure(args, cwd, expectedMessage) {
  try {
    await runNpm(args, cwd);
  } catch (cause) {
    const output = `${cause.stdout || ''}\n${cause.stderr || ''}`;
    if (!output.includes(expectedMessage)) {
      throw new Error(`想定外の理由でnpmコマンドが失敗しました。\n${output}`);
    }
    return;
  }
  throw new Error('失敗が必要なnpmコマンドが成功しました。');
}
