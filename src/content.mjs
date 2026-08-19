import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articleFilenamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const tagSchema = z
  .string()
  .trim()
  .min(1, 'tag must not be empty')
  .refine((tag) => tag !== '.' && tag !== '..', 'tag must not be a dot segment')
  .refine((tag) => !/[\\/\u0000-\u001f\u007f]/.test(tag), 'tag contains an invalid path character');

export function defineHelpboxCollection() {
  const base = './content';
  const markdownLoader = glob({
    pattern: '**/*.md',
    base,
    generateId: ({ entry }) => {
      const normalizedEntry = entry.replaceAll('\\', '/');
      const filename = normalizedEntry.split('/').at(-1) || '';
      assertArticleFilename(filename);
      return normalizedEntry.replace(/\.md$/i, '');
    },
  });

  return defineCollection({
    loader: {
      name: '@ookam/helpbox/content',
      async load(context) {
        const baseUrl = new URL(base, context.config.root);
        if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/';
        await validateArticleFilenames(fileURLToPath(baseUrl));
        await markdownLoader.load(context);
      },
    },
    schema: z
      .object({
        title: z.string(),
        summary: z.string(),
        audience: z.string(),
        category: z.string(),
        tags: z.array(tagSchema).default([]),
        featured: z.boolean().default(false),
        kind: z.enum(['guide', 'notice']).default('guide'),
        publishedAt: z.coerce.date().optional(),
        updatedAt: z.coerce.date(),
        draft: z.boolean().default(false),
        order: z.number().int().default(100),
      })
      .superRefine((data, context) => {
        if (data.kind === 'notice' && !data.publishedAt) {
          context.addIssue({
            code: 'custom',
            path: ['publishedAt'],
            message: 'publishedAt is required when kind is notice',
          });
        }
      }),
  });
}

async function validateArticleFilenames(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (cause) {
    if (cause && typeof cause === 'object' && cause.code === 'ENOENT') return;
    throw cause;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      await validateArticleFilenames(join(directory, entry.name));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      assertArticleFilename(entry.name);
    }
  }
}

function assertArticleFilename(filename) {
  if (!articleFilenamePattern.test(filename)) {
    throw new Error(
      `記事ファイル名 "${filename}" は英小文字、数字、ハイフンだけで指定してください。`,
    );
  }
}
