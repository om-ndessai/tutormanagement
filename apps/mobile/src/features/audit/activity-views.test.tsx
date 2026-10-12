import { screen } from '@testing-library/react-native';
import { createRef } from 'react';

import { renderWithProviders } from '@/test/render';
import { ActivityFiltersSheet } from './activity-filters-sheet';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = jest.requireActual('react-native');
  return {
    BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
    BottomSheetScrollView: View,
    BottomSheetBackdrop: () => null,
  };
});

const mockUseUsers = jest.fn();
jest.mock('@/features/users/api', () => ({
  useUsers: (params: unknown, options: { enabled?: boolean }) => mockUseUsers(params, options),
}));
jest.mock('./api', () => ({
  useAuditActions: () => ({ data: { data: ['comment.added', 'tutor.ssn_confirmed'] } }),
}));

beforeEach(() => {
  mockUseUsers.mockReset();
  mockUseUsers.mockReturnValue({
    data: { data: [{ id: 'alex', full_name: 'Alex Chen' }] },
  });
});

async function renderSheet(isAdmin: boolean) {
  await renderWithProviders(
    <ActivityFiltersSheet
      sheetRef={createRef()}
      filter={{}}
      onChange={jest.fn()}
      isAdmin={isAdmin}
      today="2026-10-09"
    />,
  );
}

describe('ActivityFiltersSheet', () => {
  it('offers a non-admin no person filter, and asks the server for no list of people', async () => {
    await renderSheet(false);
    expect(screen.queryByTestId('activity-filter-person')).toBeNull();
    expect(screen.getByTestId('activity-filter-action')).toBeTruthy();
    expect(mockUseUsers).toHaveBeenCalledWith(expect.anything(), { enabled: false });
  });

  it('offers an admin the person filter over everyone', async () => {
    await renderSheet(true);
    expect(screen.getByTestId('activity-filter-person')).toBeTruthy();
    expect(mockUseUsers).toHaveBeenCalledWith({ limit: 100, sort: 'full_name' }, { enabled: true });
  });

  it('starts both dates as any day', async () => {
    await renderSheet(true);
    expect(screen.getByTestId('activity-filter-from-any')).toBeTruthy();
    expect(screen.getByTestId('activity-filter-to-any')).toBeTruthy();
  });
});
