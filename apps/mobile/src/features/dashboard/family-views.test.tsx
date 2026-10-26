import type { ParentDashboard, StudentDashboard } from '@tmi/shared';
import { screen } from '@testing-library/react-native';

import { session, studentProgress } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { ParentView } from './parent-balance-view';
import { StudentView } from './student-view';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), push: jest.fn() } }));
jest.mock('@/providers/auth-provider', () => ({
  useOrgTimeZone: () => 'America/New_York',
  useAuth: () => ({ organization: null }),
}));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));

const prompt = {
  session_id: 'p1',
  occurred_on: '2026-10-06',
  started_at: '16:00',
  student_user_id: 'student-1',
  student_name: 'Sofia Okafor',
  tutor_user_id: 'tutor-1',
  tutor_name: 'Alex Chen',
};

// The server sends a student's own lessons from the family's side, with the price.
const familySession = session({ money_view: 'family' });

const studentDashboard: StudentDashboard = {
  kind: 'student',
  goal: 'Ready for Prealgebra',
  current_math_course: 'Grade 7',
  tutors: [{ user_id: 'tutor-1', full_name: 'Alex Chen', session_count: 2 }],
  totals: { session_count: 2, total_minutes: 150 },
  recent_sessions: [familySession],
  progress: studentProgress,
  awaiting_reflection: [prompt],
};

const parentDashboard: ParentDashboard = {
  kind: 'parent',
  paid_directly: false,
  direct_balances: [],
  children: [
    {
      student_user_id: 'student-1',
      student_name: 'Sofia Okafor',
      guardians: [],
      charged_cents: 18_000,
      paid_cents: 10_000,
      balance_cents: 8_000,
      session_count: 2,
    },
  ],
  totals: { charged_cents: 18_000, paid_cents: 10_000, balance_cents: 8_000 },
  recent_sessions: [familySession],
  recent_payments: [],
  progress: [studentProgress],
  awaiting_reflection: [prompt],
};

function allText(): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string' || typeof node === 'number') return void out.push(String(node));
    if (Array.isArray(node)) return node.forEach(walk);
    walk((node as { children?: unknown }).children);
  };
  walk(screen.toJSON());
  return out.join(' | ');
}

describe('family dashboards', () => {
  it('a student sees no money at all, even on lessons the server prices for the family', async () => {
    await renderWithProviders(
      <StudentView data={studentDashboard} studentId="student-1" studentName="Sofia Okafor" />,
    );
    expect(screen.getByTestId('reflection-prompts')).toBeTruthy();
    expect(screen.getByText('How did your lessons go?')).toBeTruthy();
    expect(screen.getByTestId('student-sessions')).toBeTruthy();
    expect(screen.queryByTestId('session-money')).toBeNull();
    expect(allText()).not.toMatch(/\$/);
  });

  it("a parent sees the family's side: You pay, never Your pay", async () => {
    await renderWithProviders(<ParentView data={parentDashboard} />);
    expect(screen.getByTestId('stat-outstanding-value')).toHaveTextContent('$80.00');
    expect(screen.getByText('Reflect with your children')).toBeTruthy();
    expect(screen.getByTestId('session-money')).toBeTruthy();
    const text = allText();
    expect(text).toContain('You pay');
    expect(text).not.toMatch(/Your pay(?!ments)/);
    expect(text.replace(/ \| /g, '')).toContain('2 sessions · $180.00 charged');
  });
});

describe("a parent's dashboard in a space paid directly (Phase 54)", () => {
  const direct = (tutor: string, name: string, charged: number, paid: number) => ({
    student_user_id: 'student-1',
    student_name: 'Sofia Okafor',
    tutor_user_id: tutor,
    tutor_name: name,
    guardians: [],
    charged_cents: charged,
    paid_cents: paid,
    balance_cents: charged - paid,
    session_count: 1,
  });

  it('lists what they owe each tutor, and counts it in their figures and the child', async () => {
    const data: ParentDashboard = {
      ...parentDashboard,
      paid_directly: true,
      children: [
        {
          ...parentDashboard.children[0]!,
          charged_cents: 0,
          paid_cents: 0,
          balance_cents: 0,
          session_count: 0,
        },
      ],
      totals: { charged_cents: 0, paid_cents: 0, balance_cents: 0 },
      direct_balances: [
        direct('hannah', 'Hannah Brooks', 6_000, 6_000),
        direct('diego', 'Diego Ramos', 5_000, 0),
      ],
    };
    await renderWithProviders(<ParentView data={data} />);
    expect(screen.getByText('What you owe each tutor')).toBeTruthy();
    expect(screen.getByTestId('direct-balance-student-1-diego')).toBeTruthy();
    expect(screen.getByText(/^for Sofia Okafor · 1 lesson · \$0\.00 paid$/)).toBeTruthy();
    expect(screen.getByTestId('stat-outstanding-value')).toHaveTextContent('$50.00');
    expect(allText().replace(/ \| /g, '')).toContain('2 sessions · $110.00 charged');
  });

  it('shows no such panel in a space run by an organization', async () => {
    await renderWithProviders(<ParentView data={parentDashboard} />);
    expect(screen.queryByText('What you owe each tutor')).toBeNull();
  });
});
