import { defineHelpbox } from '@ookam/helpbox';

export default defineHelpbox({
  name: 'HelpBox Example',
  description: 'パッケージの動作確認用ヘルプセンターです。',
  service: {
    name: 'Example Service',
    url: 'https://example.com',
  },
  defaultAudience: 'user',
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
  contact: {
    label: 'お問い合わせ',
    description: '記事で解決しない場合はお問い合わせください。',
    url: 'https://example.com/contact',
  },
  brandMark: '/favicon.svg',
  footerLinks: [
    { label: 'サービスサイト', url: 'https://example.com' },
  ],
  theme: {
    primary: '#3157d5',
    primaryDark: '#2342a8',
    primarySoft: '#eef2ff',
    accent: '#14a08b',
  },
});
