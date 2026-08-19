import type { AstroIntegration } from 'astro';
import type { HelpboxConfig } from './types.js';

export type {
  HelpAudience,
  HelpCategory,
  HelpboxConfig,
  HelpboxContact,
  HelpboxLink,
  HelpboxTheme,
  ResolvedHelpAudience,
  ResolvedHelpCategory,
  ResolvedHelpboxConfig,
} from './types.js';

export interface HelpboxIntegrationOptions {
  config: HelpboxConfig;
}

export declare function defineHelpbox<const Config extends HelpboxConfig>(config: Config): Config;
export default function helpbox(options: HelpboxIntegrationOptions): AstroIntegration;
