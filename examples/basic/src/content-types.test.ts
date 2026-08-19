import type { CollectionEntry } from 'astro:content';

export function assertHelpboxContentTypes(entry: CollectionEntry<'helpbox'>) {
  const title: string = entry.data.title;
  const updatedAt: Date = entry.data.updatedAt;
  const kind: 'guide' | 'notice' = entry.data.kind;

  // @ts-expect-error Unknown frontmatter fields must not be typed as valid data.
  entry.data.unknownField;

  return { title, updatedAt, kind };
}
