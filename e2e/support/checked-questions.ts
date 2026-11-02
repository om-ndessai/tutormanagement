import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Phase 62 (P1): whether a space draws checked questions is the platform admins' switch
 * (`checked_questions`, on by default -- the soft launch), set through the console's features route.
 * The space admins' old `canvas_assessments_unreviewed` is still accepted and no longer applied.
 */
export async function setCheckedQuestions(platform: Page, slug: string, on: boolean): Promise<void> {
  const list = await platform.request.get('/api/platform/organizations');
  expect(list.status()).toBe(200);
  const org = ((await list.json()).data as any[]).find((row) => row.slug === slug);
  expect(org, `space ${slug}`).toBeTruthy();
  const response = await platform.request.put(`/api/platform/organizations/${org.id}/features`, {
    data: {
      feature_tutoring: org.feature_tutoring,
      feature_assessment: org.feature_assessment,
      feature_quest: org.feature_quest,
      checked_questions: on,
    },
  });
  expect(response.status(), 'setting checked questions').toBe(200);
}
