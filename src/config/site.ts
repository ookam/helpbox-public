import config from 'virtual:@ookam/helpbox/config';
import type {
  ResolvedHelpAudience,
  ResolvedHelpCategory,
  ResolvedHelpboxConfig,
} from '../types';

export type HelpAudience = ResolvedHelpAudience;
export type HelpCategory = ResolvedHelpCategory;
export type SiteConfig = ResolvedHelpboxConfig;

export const siteConfig = config;

export function getAudience(audienceId: string) {
  return siteConfig.audiences.find((audience) => audience.id === audienceId);
}

export function getCategory(audienceId: string, categoryId: string) {
  return getAudience(audienceId)?.categories.find((category) => category.id === categoryId);
}
