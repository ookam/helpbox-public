import { defineHelpbox } from '@ookam/helpbox';

export default defineHelpbox({
  name: 'My Help Center',
  description: 'よくある質問と使い方をご案内します。',
  service: {
    name: 'My Service',
    url: 'https://example.com',
  },
  defaultAudience: 'user',
  brandMark: '/favicon.svg',
  audiences: [
    {
      id: 'user',
      label: 'ご利用者向けヘルプ',
      shortLabel: 'ご利用者',
      description: 'サービスをご利用の方向けのご案内です。',
      categories: [
        { id: 'getting-started', label: 'はじめに', description: '利用開始までの流れ' },
      ],
    },
    {
      id: 'admin',
      label: '管理者向けヘルプ',
      shortLabel: '管理者',
      description: 'サービスを管理する方向けのご案内です。',
      categories: [
        { id: 'getting-started', label: 'はじめに', description: '初期設定の流れ' },
      ],
    },
  ],
});
