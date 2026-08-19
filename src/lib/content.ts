import { getCollection, type CollectionEntry } from 'astro:content';
import { getAudience, getCategory, siteConfig } from '../config/site';

export type HelpDoc = CollectionEntry<'helpbox'>;

export async function getPublishedDocs() {
  return getCollection('helpbox', ({ data }) => !data.draft);
}

export async function getAudienceDocs(audienceId: string) {
  const docs = await getPublishedDocs();
  return docs
    .filter(({ data }) => data.audience === audienceId)
    .sort(compareDocs);
}

export function compareDocs(a: HelpDoc, b: HelpDoc) {
  if (a.data.order !== b.data.order) return a.data.order - b.data.order;
  return b.data.updatedAt.getTime() - a.data.updatedAt.getTime();
}

export function getDocSlug(doc: HelpDoc) {
  return doc.id.split('/').at(-1)?.replace(/\.(md|mdx)$/, '') ?? doc.id;
}

export function getDocPath(doc: HelpDoc) {
  return `/${doc.data.audience}/post/${encodeURIComponent(getDocSlug(doc))}/`;
}

export function getTagPath(audienceId: string, tag: string) {
  return `/${audienceId}/tag/${encodeURIComponent(tag)}/`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function validateContentReferences(docs: HelpDoc[]) {
  const seenPaths = new Set<string>();
  const seenAudiences = new Set<string>();

  for (const audience of siteConfig.audiences) {
    if (!/^[a-z0-9-]+$/.test(audience.id)) {
      throw new Error(`Audience ID "${audience.id}" must use lowercase ASCII letters, numbers, and hyphens.`);
    }
    if (seenAudiences.has(audience.id)) {
      throw new Error(`Duplicate audience ID "${audience.id}".`);
    }
    seenAudiences.add(audience.id);

    const seenCategories = new Set<string>();
    for (const category of audience.categories) {
      if (!/^[a-z0-9-]+$/.test(category.id)) {
        throw new Error(`Category ID "${category.id}" must use lowercase ASCII letters, numbers, and hyphens.`);
      }
      if (seenCategories.has(category.id)) {
        throw new Error(`Duplicate category ID "${category.id}" in audience "${audience.id}".`);
      }
      seenCategories.add(category.id);
    }
  }

  for (const doc of docs) {
    const audience = getAudience(doc.data.audience);
    if (!audience) {
      throw new Error(`Unknown audience "${doc.data.audience}" in ${doc.id}`);
    }
    if (!getCategory(doc.data.audience, doc.data.category)) {
      throw new Error(
        `Unknown category "${doc.data.category}" for audience "${doc.data.audience}" in ${doc.id}`,
      );
    }

    for (const tag of doc.data.tags) {
      if (!tag || tag === '.' || tag === '..' || /[\\/\u0000-\u001f\u007f]/.test(tag)) {
        throw new Error(`Tag "${tag}" in ${doc.id} cannot be used as a URL path segment.`);
      }
    }

    const path = getDocPath(doc);
    if (seenPaths.has(path)) {
      throw new Error(`Duplicate article path "${path}". Article filenames must be unique per audience.`);
    }
    seenPaths.add(path);
  }

  const audienceIds = new Set(siteConfig.audiences.map(({ id }) => id));
  if (!audienceIds.has(siteConfig.defaultAudience)) {
    throw new Error(`defaultAudience "${siteConfig.defaultAudience}" is not configured`);
  }
}
