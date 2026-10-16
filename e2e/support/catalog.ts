import { readFileSync } from 'node:fs';

/**
 * The catalog's source files (apps/api/db/catalog/*.json), read as the suite's
 * expectations. The North Carolina catalog is long and reviewed apart from the
 * code, so no spec pins its names or counts: it reads them from here.
 */
export interface CatalogTopic {
  id: string;
  code: string | null;
  number: number;
  unit: string | null;
  name: string;
  description: string | null;
}
export interface CatalogLevel {
  id: string;
  code: string | null;
  name: string;
  stage: number;
  topics: CatalogTopic[];
}
export interface CatalogCurriculum {
  id: string;
  name: string;
  edition: string | null;
  sort: number;
  levels: CatalogLevel[];
}

function read(file: string): CatalogCurriculum {
  return JSON.parse(readFileSync(new URL(`../../apps/api/db/catalog/${file}`, import.meta.url), 'utf8'));
}

export const BA = read('ba.json');
export const NC17 = read('nc-2017.json');
export const NC26 = read('nc-2026.json');

export const topicsOf = (curriculum: CatalogCurriculum) => curriculum.levels.flatMap((level) => level.topics);

/**
 * Text only North Carolina's catalog holds, for "nothing of it reaches an
 * organization that does not offer it": its ids, its curricula's and levels'
 * names, and its topics' names -- leaving out any that Beast Academy also uses
 * or that are short enough to turn up inside other text ("Area").
 */
export function northCarolinaWords(): string[] {
  const beastAcademy = new Set([BA.name, ...BA.levels.map((l) => l.name), ...topicsOf(BA).map((t) => t.name)]);
  const ids = [NC17, NC26].flatMap((curriculum) => [
    ...curriculum.levels.map((level) => level.id),
    ...topicsOf(curriculum).map((topic) => topic.id),
  ]);
  const names = [NC17, NC26].flatMap((curriculum) => [
    curriculum.name,
    ...curriculum.levels.map((level) => level.name),
    ...topicsOf(curriculum).map((topic) => topic.name),
  ]);
  return [
    ...new Set([...ids, ...names.filter((name) => name.length >= 12 && !beastAcademy.has(name))]),
  ];
}
