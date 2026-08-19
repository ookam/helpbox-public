import helpbox from '../src/index.mjs';

const validConfig = {
  name: 'Test Help',
  service: {
    name: 'Test Service',
    url: 'https://example.com',
  },
  audiences: [
    {
      id: 'user',
      label: 'User',
      categories: [{ id: 'guide', label: 'Guide' }],
    },
  ],
};

for (const id of ['404', 'pagefind']) {
  expectFailure(
    () => helpbox({
      config: {
        ...validConfig,
        audiences: [{ ...validConfig.audiences[0], id }],
      },
    }),
    `予約済みの対象ID "${id}" が受理されました。`,
  );
}

expectFailure(
  () => helpbox({ config: { ...validConfig, theme: { primary: '#12345' } } }),
  'CSSで無効なhex colorが受理されました。',
);

expectFailure(
  () => helpbox({ config: { ...validConfig, brandMark: 'javascript:alert(1)' } }),
  'http(s)または公開パス以外のbrandMarkが受理されました。',
);

const previousSiteUrl = process.env.SITE_URL;
process.env.SITE_URL = 'ftp://example.com';
try {
  const invalidEnvironmentIntegration = helpbox({ config: validConfig });
  expectFailure(
    () => invalidEnvironmentIntegration.hooks['astro:config:setup']({
      injectRoute() {},
      updateConfig() {},
    }),
    'http(s)以外のSITE_URLが受理されました。',
  );
} finally {
  if (previousSiteUrl === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = previousSiteUrl;
}

const integration = helpbox({ config: validConfig });
expectFailure(
  () => integration.hooks['astro:config:done']({
    config: { base: '/docs' },
    injectTypes() {},
  }),
  '非対応のAstro baseが受理されました。',
);
expectFailure(
  () => integration.hooks['astro:config:done']({
    config: { base: '/', build: { format: 'file', assets: '_astro' } },
    injectTypes() {},
  }),
  '非対応のAstro build.formatが受理されました。',
);
expectFailure(
  () => integration.hooks['astro:config:done']({
    config: { base: '/', build: { format: 'directory', assets: 'pagefind' } },
    injectTypes() {},
  }),
  '検索出力と衝突するAstro build.assetsが受理されました。',
);

console.log('設定の予約語、URL、brand mark、base、build format、asset directoryを検証しました。');

function expectFailure(action, message) {
  let failed = false;
  try {
    action();
  } catch {
    failed = true;
  }
  if (!failed) throw new Error(message);
}
