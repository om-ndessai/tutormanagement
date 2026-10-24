// Phase 50: the welcome wizard's Add a student follows the space's feature sets.
import { studentFlowSteps } from './student-flow';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ organization: {} }) }));

const keys = (sets: { tutoring: boolean; assessment: boolean }) => studentFlowSteps(sets).map((step) => step.key);

it('with Tutoring, is the family and student, the assessment, the plan and a tutor', () => {
  expect(keys({ tutoring: true, assessment: true })).toEqual(['student', 'assessment', 'plan', 'pairing']);
  expect(keys({ tutoring: true, assessment: false })).toEqual(['student', 'assessment', 'plan', 'pairing']);
});

it('without Tutoring, is the family and student, then the first canvas assessment where Assessment is on', () => {
  expect(keys({ tutoring: false, assessment: true })).toEqual(['student', 'start']);
  expect(studentFlowSteps({ tutoring: false, assessment: true })[1]?.label).toBe('Start an assessment');
});

it('without either, is the family and student alone', () => {
  expect(keys({ tutoring: false, assessment: false })).toEqual(['student']);
});
