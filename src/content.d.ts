import type { CollectionConfig } from 'astro/content/config';
import type { z } from 'astro/zod';

export interface HelpboxDocumentData {
  title: string;
  summary: string;
  audience: string;
  category: string;
  tags: string[];
  featured: boolean;
  kind: 'guide' | 'notice';
  publishedAt?: Date;
  updatedAt: Date;
  draft: boolean;
  order: number;
}

type HelpboxSchema = z.ZodType<HelpboxDocumentData>;

export declare function defineHelpboxCollection(): CollectionConfig<HelpboxSchema>;
