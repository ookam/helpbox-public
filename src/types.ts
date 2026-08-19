export interface HelpCategory {
  id: string;
  label: string;
  description?: string;
}

export interface HelpAudience {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
  categories: HelpCategory[];
}

export interface HelpboxLink {
  label: string;
  url: string;
}

export interface HelpboxContact {
  url: string;
  label?: string;
  description?: string;
  hours?: string;
}

export interface HelpboxTheme {
  primary?: string;
  primaryDark?: string;
  primarySoft?: string;
  accent?: string;
  ink?: string;
}

export interface HelpboxConfig {
  name: string;
  siteUrl?: string;
  description?: string;
  service: {
    name: string;
    url: string;
  };
  defaultAudience?: string;
  audiences: HelpAudience[];
  contact?: HelpboxContact;
  footerLinks?: HelpboxLink[];
  brandMark?: string;
  favicon?: string;
  theme?: HelpboxTheme;
}

export interface ResolvedHelpCategory {
  id: string;
  label: string;
  description: string;
}

export interface ResolvedHelpAudience {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  categories: ResolvedHelpCategory[];
}

export interface ResolvedHelpboxConfig {
  name: string;
  siteUrl: string;
  description: string;
  serviceName: string;
  serviceUrl: string;
  defaultAudience: string;
  audiences: ResolvedHelpAudience[];
  contact: Required<HelpboxContact> | null;
  footerLinks: HelpboxLink[];
  brandMark: string;
  favicon: string;
  theme: HelpboxTheme;
}
