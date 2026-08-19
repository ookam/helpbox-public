import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const packageJsonRoot = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const temporaryRoot = await mkdtemp(join(tmpdir(), 'helpbox-cli-'));
const target = join(temporaryRoot, 'generated-help');

try {
  await exec(process.execPath, ['bin/helpbox.mjs', 'init', target, '--skip-install'], {
    cwd: new URL('../', import.meta.url),
  });

  const expected = [
    '.gitignore',
    'README.md',
    'astro.config.mjs',
    'content',
    'helpbox.config.ts',
    'package.json',
    'public',
    'src',
    'tsconfig.json',
    'wrangler.jsonc',
  ];
  const generated = (await readdir(target)).sort();
  if (JSON.stringify(generated) !== JSON.stringify(expected)) {
    throw new Error(`生成ファイルが一致しません: ${generated.join(', ')}`);
  }

  const packageJson = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  if (packageJson.name !== 'generated-help') throw new Error('生成したpackage名が不正です。');
  if (packageJson.dependencies['@ookam/helpbox'] !== `^${packageJsonRoot.version}`) {
    throw new Error('生成したHelpBoxの依存versionが不正です。');
  }

  let refusedOverwrite = false;
  try {
    await exec(process.execPath, ['bin/helpbox.mjs', 'init', target, '--skip-install'], {
      cwd: new URL('../', import.meta.url),
    });
  } catch {
    refusedOverwrite = true;
  }
  if (!refusedOverwrite) throw new Error('CLIが既存ファイルを上書きしようとしました。');

  let refusedUnknownFlag = false;
  try {
    await exec(process.execPath, ['bin/helpbox.mjs', 'init', '--force'], {
      cwd: new URL('../', import.meta.url),
    });
  } catch {
    refusedUnknownFlag = true;
  }
  if (!refusedUnknownFlag) throw new Error('CLIが不明なオプションを受け入れました。');

  const gitOnlyTarget = join(temporaryRoot, 'git-only');
  await mkdir(join(gitOnlyTarget, '.git', 'objects'), { recursive: true });
  const objectPath = join(gitOnlyTarget, '.git', 'objects', 'binary-object');
  const objectBytes = Buffer.from([0, 255, 1, 254, 2, 253]);
  await writeFile(objectPath, objectBytes);
  await exec(process.execPath, ['bin/helpbox.mjs', 'init', gitOnlyTarget, '--skip-install'], {
    cwd: new URL('../', import.meta.url),
  });
  const objectAfterInit = await readFile(objectPath);
  if (!objectAfterInit.equals(objectBytes)) throw new Error('CLIが.git配下のデータを変更しました。');

  console.log('CLIの生成内容と上書き防止を検証しました。');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
