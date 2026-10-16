import type { Curriculum, CurriculumOffering } from '@tmi/shared';

import type { OrgId } from '../lib/org.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// Which curricula an organization offers (Phase 35). organization_curricula is
// the one choke point between an organization and the catalog; every statement
// here names the organization, and repeats the ownership test the insert
// trigger holds -- a curriculum is the platform's (organization_id NULL) or
// this organization's own, never another's -- because production's triggers
// are carried over by hand.

type CurriculumRow = Omit<Curriculum, 'is_default' | 'retired'> & { is_default: number; retired: number };

function toCurriculum({ is_default, retired, ...row }: CurriculumRow): Curriculum {
  return { ...row, is_default: is_default === 1, retired: retired === 1 };
}

/**
 * This organization's list: offered and retired alike, the default first,
 * retired last, then display order. What every member reads, so a picker can
 * offer a switch between the curricula still offered.
 */
export async function listOrganizationCurricula(db: D1Database, org: OrgId): Promise<Curriculum[]> {
  const result = await db
    .prepare(
      `SELECT c.id, c.name, c.source, c.edition, c.description, c.source_url,
              oc.is_default, oc.retired_at IS NOT NULL AS retired
       FROM organization_curricula oc
       JOIN curricula c ON c.id = oc.curriculum_id
                       AND (c.organization_id IS NULL OR c.organization_id = oc.organization_id)
       WHERE oc.organization_id = ?
       ORDER BY oc.retired_at IS NOT NULL, oc.is_default DESC, c.sort, c.id`,
    )
    .bind(org)
    .all<CurriculumRow>();

  return (result.results ?? []).map(toCurriculum);
}

/**
 * Every curriculum this organization may offer -- the platform's and its own
 * -- with its standing here and its size. For the admins' Curricula card.
 */
export async function listCurriculumOfferings(db: D1Database, org: OrgId): Promise<CurriculumOffering[]> {
  const result = await db
    .prepare(
      `SELECT c.id, c.name, c.source, c.edition, c.description, c.source_url,
              COALESCE(oc.is_default, 0) AS is_default,
              oc.retired_at IS NOT NULL AS retired,
              (oc.curriculum_id IS NOT NULL AND oc.retired_at IS NULL) AS offered,
              (SELECT COUNT(*) FROM curriculum_levels l WHERE l.curriculum_id = c.id) AS level_count,
              (SELECT COUNT(*) FROM curriculum_topics t JOIN curriculum_levels l ON l.id = t.level_id
               WHERE l.curriculum_id = c.id) AS topic_count
       FROM curricula c
       LEFT JOIN organization_curricula oc ON oc.curriculum_id = c.id AND oc.organization_id = ?
       WHERE c.organization_id IS NULL OR c.organization_id = ?
       ORDER BY c.sort, c.id`,
    )
    .bind(org, org)
    .all<CurriculumRow & { offered: number; level_count: number; topic_count: number }>();

  return (result.results ?? []).map(({ offered, level_count, topic_count, ...row }) => ({
    ...toCurriculum(row),
    offered: offered === 1,
    level_count,
    topic_count,
  }));
}

/**
 * Replaces the organization's choice in one batch, modelled on
 * setDefaultOrganization: clear the default, retire what is no longer
 * offered, add (or bring back) what is, then set the default. A batch is one
 * transaction, so there is never a moment with no default or two -- the
 * partial unique index would refuse two anyway. Rows are never deleted.
 *
 * The caller has checked every id is one this organization may offer and
 * that the default is among them.
 */
export async function setCurriculumOffering(
  db: D1Database,
  org: OrgId,
  offered: string[],
  defaultId: string,
): Promise<void> {
  const ids = JSON.stringify(offered);
  await db.batch([
    db
      .prepare('UPDATE organization_curricula SET is_default = 0 WHERE organization_id = ? AND is_default = 1')
      .bind(org),
    db
      .prepare(
        `UPDATE organization_curricula SET retired_at = ${NOW}
         WHERE organization_id = ? AND retired_at IS NULL
           AND curriculum_id NOT IN (SELECT value FROM json_each(?))`,
      )
      .bind(org, ids),
    db
      .prepare(
        `INSERT INTO organization_curricula (organization_id, curriculum_id)
         SELECT ?, c.id FROM curricula c
         WHERE c.id IN (SELECT value FROM json_each(?))
           AND (c.organization_id IS NULL OR c.organization_id = ?)
         ON CONFLICT (organization_id, curriculum_id) DO UPDATE SET retired_at = NULL`,
      )
      .bind(org, ids, org),
    db
      .prepare(
        'UPDATE organization_curricula SET is_default = 1 WHERE organization_id = ? AND curriculum_id = ?',
      )
      .bind(org, defaultId),
  ]);
}
