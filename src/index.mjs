import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const virtualConfigId = 'virtual:@ookam/helpbox/config';
const resolvedVirtualConfigId = `\0${virtualConfigId}`;
const reservedAudienceIds = new Set(['404', 'pagefind']);
const searchOutputMarker = '.helpbox-generated.json';

const routes = [
  ['/', './pages/index.astro'],
  ['/404', './pages/404.astro'],
  ['/[audience]', './pages/[audience]/index.astro'],
  ['/[audience]/category/[category]', './pages/[audience]/category/[category].astro'],
  ['/[audience]/notices', './pages/[audience]/notices.astro'],
  ['/[audience]/post/[slug]', './pages/[audience]/post/[slug].astro'],
  ['/[audience]/search', './pages/[audience]/search.astro'],
  ['/[audience]/tag/[tag]', './pages/[audience]/tag/[tag].astro'],
];

export function defineHelpbox(config) {
  return config;
}

export default function helpbox(options) {
  const config = normalizeConfig(options?.config);
  const serializedConfig = serializeConfig(config);

  return {
    name: '@ookam/helpbox',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig }) => {
        const configuredSite = process.env.SITE_URL
          ? safeUrl(process.env.SITE_URL, 'SITE_URL', false)
          : config.siteUrl;
        const nextConfig = {
          output: 'static',
          trailingSlash: 'always',
          build: {
            format: 'directory',
            assets: '_astro',
          },
          vite: {
            plugins: [createConfigPlugin(serializedConfig)],
          },
        };

        if (configuredSite) nextConfig.site = configuredSite;
        updateConfig(nextConfig);

        for (const [pattern, entrypoint] of routes) {
          injectRoute({
            pattern,
            entrypoint: new URL(entrypoint, import.meta.url),
            prerender: true,
          });
        }
      },
      'astro:config:done': ({ config: astroConfig, injectTypes }) => {
        if (astroConfig.base !== '/') {
          throw new Error('HelpBoxはAstroのbase="/"だけをサポートしています。');
        }
        if (astroConfig.build.format !== 'directory') {
          throw new Error('HelpBoxはAstroのbuild.format="directory"だけをサポートしています。');
        }
        if (astroConfig.build.assets !== '_astro') {
          throw new Error('HelpBoxはAstroのbuild.assets="_astro"だけをサポートしています。');
        }
        injectTypes({
          filename: 'helpbox.d.ts',
          content: [
            `declare module '${virtualConfigId}' {`,
            `  const config: import('@ookam/helpbox').ResolvedHelpboxConfig;`,
            '  export default config;',
            '}',
          ].join('\n'),
        });
      },
      'astro:build:done': async ({ dir, logger }) => {
        await buildSearchIndex(dir, logger);
      },
    },
  };
}

function createConfigPlugin(serializedConfig) {
  return {
    name: '@ookam/helpbox:config',
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualConfigId) return resolvedVirtualConfigId;
    },
    load(id) {
      if (id === resolvedVirtualConfigId) return `export default ${serializedConfig};`;
    },
  };
}

async function buildSearchIndex(outputDirectory, logger) {
  const pagefind = await import('pagefind');
  const directory = fileURLToPath(outputDirectory);
  const outputPath = fileURLToPath(new URL('pagefind/', outputDirectory));

  try {
    await prepareSearchOutput(outputPath);
    const created = await pagefind.createIndex({ verbose: false });
    assertNoPagefindErrors('検索インデックスを初期化できませんでした', created.errors);
    if (!created.index) throw new Error('Pagefind did not return an index.');

    const indexed = await created.index.addDirectory({ path: directory });
    assertNoPagefindErrors('HTMLを検索対象へ追加できませんでした', indexed.errors);
    if (indexed.page_count === 0) throw new Error('検索対象の記事が1件もありません。');

    const written = await created.index.writeFiles({
      outputPath,
    });
    assertNoPagefindErrors('検索インデックスを書き込めませんでした', written.errors);
    await writeSearchOutputMarker(outputPath);
    const manifest = JSON.parse(
      await readFile(new URL('pagefind/pagefind-entry.json', outputDirectory), 'utf8'),
    );
    const indexedArticles = Object.values(manifest.languages || {})
      .reduce((total, language) => total + (language.page_count || 0), 0);
    if (indexedArticles === 0) {
      logger.warn('公開中の記事がないため、空の検索インデックスを生成しました。');
    } else {
      logger.info(`${indexedArticles}件の記事を検索インデックスへ追加しました。`);
    }
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    logger.error(error.message);
    throw error;
  } finally {
    await pagefind.close();
  }
}

async function prepareSearchOutput(outputPath) {
  const files = await collectOutputFiles(outputPath);
  if (files.length === 0) return;

  const marker = files.find(({ relativePath }) => relativePath === searchOutputMarker);
  if (!marker || marker.kind !== 'file') throwSearchOutputConflict(outputPath);

  let manifest;
  try {
    manifest = JSON.parse(await readFile(marker.absolutePath, 'utf8'));
  } catch {
    throwSearchOutputConflict(outputPath);
  }
  if (manifest?.version !== 1 || !Array.isArray(manifest.files)) {
    throwSearchOutputConflict(outputPath);
  }

  const generatedFiles = new Map(
    manifest.files
      .filter((entry) => entry && typeof entry.path === 'string' && typeof entry.sha256 === 'string')
      .map((entry) => [entry.path, entry.sha256]),
  );
  if (generatedFiles.size !== manifest.files.length) throwSearchOutputConflict(outputPath);

  for (const file of files) {
    if (file.relativePath === searchOutputMarker) continue;
    if (file.kind !== 'file' || !generatedFiles.has(file.relativePath)) {
      throwSearchOutputConflict(outputPath);
    }
    if (await sha256(file.absolutePath) !== generatedFiles.get(file.relativePath)) {
      throwSearchOutputConflict(outputPath);
    }
  }

  for (const file of files) {
    if (file.kind === 'file') await rm(file.absolutePath, { force: true });
  }
}

async function writeSearchOutputMarker(outputPath) {
  const files = await collectOutputFiles(outputPath);
  const manifest = {
    version: 1,
    files: await Promise.all(files.map(async (file) => ({
      path: file.relativePath,
      sha256: await sha256(file.absolutePath),
    }))),
  };
  await writeFile(join(outputPath, searchOutputMarker), `${JSON.stringify(manifest)}\n`);
}

async function collectOutputFiles(directory, prefix = '') {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (cause) {
    if (cause && typeof cause === 'object' && cause.code === 'ENOENT') return [];
    throw cause;
  }

  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectOutputFiles(absolutePath, relativePath));
    } else {
      files.push({
        relativePath,
        absolutePath,
        kind: entry.isFile() ? 'file' : 'other',
      });
    }
  }
  return files;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function throwSearchOutputConflict(outputPath) {
  throw new Error(
    `検索出力先 ${outputPath} にHelpBox以外のファイルがあります。public/pagefindまたはViteの出力設定と競合していないか確認してください。`,
  );
}

function assertNoPagefindErrors(message, errors = []) {
  if (errors.length > 0) throw new Error(`${message}: ${errors.join('; ')}`);
}

function normalizeConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('helpbox({ config }) に設定オブジェクトを指定してください。');
  }

  const name = requiredString(input.name, 'config.name');
  const service = input.service;
  if (!service || typeof service !== 'object' || Array.isArray(service)) {
    throw new TypeError('config.service を指定してください。');
  }

  const serviceName = requiredString(service.name, 'config.service.name');
  const serviceUrl = safeUrl(requiredString(service.url, 'config.service.url'), 'config.service.url', true);
  const audiences = normalizeAudiences(input.audiences);
  const defaultAudience = optionalString(input.defaultAudience) || audiences[0].id;
  if (!audiences.some(({ id }) => id === defaultAudience)) {
    throw new TypeError(`config.defaultAudience "${defaultAudience}" はaudiencesに存在しません。`);
  }

  return {
    name,
    siteUrl: input.siteUrl ? safeUrl(input.siteUrl, 'config.siteUrl', false) : '',
    description: optionalString(input.description) || 'よくある質問と使い方をご案内するヘルプセンターです。',
    serviceName,
    serviceUrl,
    defaultAudience,
    audiences,
    contact: normalizeContact(input.contact),
    footerLinks: normalizeLinks(input.footerLinks),
    brandMark: input.brandMark ? safeUrl(input.brandMark, 'config.brandMark', true) : '',
    favicon: optionalString(input.favicon) || '/favicon.svg',
    theme: normalizeTheme(input.theme),
  };
}

function normalizeAudiences(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('config.audiences には1件以上の対象を指定してください。');
  }

  const audienceIds = new Set();
  return value.map((audience, audienceIndex) => {
    if (!audience || typeof audience !== 'object' || Array.isArray(audience)) {
      throw new TypeError(`config.audiences[${audienceIndex}] が不正です。`);
    }

    const id = identifier(audience.id, `config.audiences[${audienceIndex}].id`);
    if (reservedAudienceIds.has(id)) {
      throw new TypeError(`対象ID "${id}" はHelpBoxの予約語です。`);
    }
    if (audienceIds.has(id)) throw new TypeError(`対象ID "${id}" が重複しています。`);
    audienceIds.add(id);

    if (!Array.isArray(audience.categories) || audience.categories.length === 0) {
      throw new TypeError(`対象 "${id}" には1件以上のカテゴリーが必要です。`);
    }

    const categoryIds = new Set();
    const categories = audience.categories.map((category, categoryIndex) => {
      if (!category || typeof category !== 'object' || Array.isArray(category)) {
        throw new TypeError(`対象 "${id}" のカテゴリー${categoryIndex + 1}件目が不正です。`);
      }
      const categoryId = identifier(category.id, `category.id (${id})`);
      if (categoryIds.has(categoryId)) {
        throw new TypeError(`対象 "${id}" のカテゴリーID "${categoryId}" が重複しています。`);
      }
      categoryIds.add(categoryId);
      return {
        id: categoryId,
        label: requiredString(category.label, `category.label (${id}/${categoryId})`),
        description: optionalString(category.description),
      };
    });

    const label = requiredString(audience.label, `config.audiences[${audienceIndex}].label`);
    return {
      id,
      label,
      shortLabel: optionalString(audience.shortLabel) || label,
      description: optionalString(audience.description),
      categories,
    };
  });
}

function normalizeContact(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('config.contact が不正です。');
  }
  return {
    label: optionalString(value.label) || 'お問い合わせ',
    description: optionalString(value.description) || 'ヘルプで解決しない場合はお問い合わせください。',
    url: safeUrl(requiredString(value.url, 'config.contact.url'), 'config.contact.url', true),
    hours: optionalString(value.hours),
  };
}

function normalizeLinks(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError('config.footerLinks は配列で指定してください。');
  return value.map((link, index) => {
    if (!link || typeof link !== 'object' || Array.isArray(link)) {
      throw new TypeError(`config.footerLinks[${index}] が不正です。`);
    }
    return {
      label: requiredString(link.label, `config.footerLinks[${index}].label`),
      url: safeUrl(requiredString(link.url, `config.footerLinks[${index}].url`), `config.footerLinks[${index}].url`, true),
    };
  });
}

function normalizeTheme(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('config.theme が不正です。');
  }

  const theme = {};
  const fields = ['primary', 'primaryDark', 'primarySoft', 'accent', 'ink'];
  for (const field of fields) {
    if (value[field] === undefined) continue;
    const color = requiredString(value[field], `config.theme.${field}`);
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) {
      throw new TypeError(`config.theme.${field} は16進カラーで指定してください。`);
    }
    theme[field] = color;
  }
  return theme;
}

function requiredString(value, path) {
  const result = optionalString(value);
  if (!result) throw new TypeError(`${path} は空でない文字列で指定してください。`);
  return result;
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function identifier(value, path) {
  const result = requiredString(value, path);
  if (!/^[a-z0-9-]+$/.test(result)) {
    throw new TypeError(`${path} は英小文字、数字、ハイフンだけで指定してください。`);
  }
  return result;
}

function safeUrl(value, path, allowRelative) {
  const text = requiredString(value, path);
  if (allowRelative && text.startsWith('/') && !text.startsWith('//')) return text;

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new TypeError(`${path} は有効なURLで指定してください。`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError(`${path} はhttpまたはhttps URLで指定してください。`);
  }
  return url.href;
}

function serializeConfig(config) {
  return JSON.stringify(config)
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}
