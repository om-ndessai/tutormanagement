import type { User } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { RoleSelector } from './role-selector';
import { UserPickerSheet } from './user-picker';
import { chooseHomeRole, onHomeRoleChosen, publishHomeRole, useHomeRole } from './home-role';
import { onSubjectChosen } from './view-as';

const mockSetParams = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    setParams: (p: unknown) => mockSetParams(p),
    back: () => mockBack(),
    canGoBack: () => true,
    navigate: (to: unknown) => mockNavigate(to),
  },
}));
const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));
const mockUsers = jest.fn();
jest.mock('@/features/users/api', () => ({
  useUsers: (params: unknown, options: unknown) => mockUsers(params, options),
}));

function person(id: string, full_name: string, roles: User['roles']): User {
  return { id, full_name, roles } as User;
}
const priya = person('priya', 'Priya Raghavan', ['admin', 'tutor']);
const alex = person('alex', 'Alex Chen', ['tutor']);

beforeEach(() => {
  jest.clearAllMocks();
  mockUsers.mockReturnValue({ data: { data: [priya, alex] }, isFetching: false });
});

describe('role selector', () => {
  it('is not offered to someone with one role', async () => {
    await renderWithProviders(<RoleSelector roles={['tutor']} current="tutor" />);
    expect(screen.queryByTestId('dashboard-role-tutor')).toBeNull();
  });

  it('switches role through the params', async () => {
    await renderWithProviders(<RoleSelector roles={['parent', 'tutor']} current="tutor" />);
    await fireEvent.press(screen.getByTestId('dashboard-role-parent'));
    expect(mockSetParams).toHaveBeenCalledWith({ role: 'parent' });
  });
});

describe('role chips in the account sheet (UI upgrades U6)', () => {
  function Sheet() {
    const home = useHomeRole();
    return home ? <RoleSelector roles={home.roles} current={home.current} onChoose={chooseHomeRole} /> : null;
  }

  it("shows the roles Home publishes, and a choice closes the sheet and reaches Home's params", async () => {
    publishHomeRole({ roles: ['tutor', 'parent'], current: 'tutor' });
    const chosen = jest.fn();
    const unsubscribe = onHomeRoleChosen(chosen);
    await renderWithProviders(<Sheet />);
    expect(screen.getByTestId('dashboard-role-tutor').props.accessibilityState).toMatchObject({
      selected: true,
    });
    await fireEvent.press(screen.getByTestId('dashboard-role-parent'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/dashboard', params: { role: 'parent' } });
    expect(chosen).toHaveBeenCalledWith('parent');
    expect(mockSetParams).not.toHaveBeenCalled();
    unsubscribe();
    publishHomeRole(null);
  });

  it('shows nothing while Home shows somebody else', async () => {
    publishHomeRole(null);
    await renderWithProviders(<Sheet />);
    expect(screen.queryByTestId('dashboard-role-tutor')).toBeNull();
  });
});

describe('view-as people sheet', () => {
  it('lists everyone but the admin, and choosing pops back with the subject', async () => {
    mockAuth.mockReturnValue({ user: priya });
    const chosen = jest.fn();
    const unsubscribe = onSubjectChosen(chosen);
    await renderWithProviders(<UserPickerSheet current={null} />);
    expect(screen.queryByTestId('view-as-user-priya')).toBeNull();
    await fireEvent.press(screen.getByTestId('view-as-user-alex'));
    expect(mockBack).toHaveBeenCalled();
    expect(chosen).toHaveBeenCalledWith('alex');
    unsubscribe();
    expect(mockUsers.mock.calls[0]![0]).toEqual({ limit: 25, sort: 'full_name' });
  });

  it('asks for nobody when the reader is not an admin', async () => {
    mockAuth.mockReturnValue({ user: alex });
    await renderWithProviders(<UserPickerSheet current={null} />);
    expect(mockUsers.mock.calls[0]![1]).toEqual({ enabled: false });
    expect(screen.queryByTestId('view-as-user-alex')).toBeNull();
    expect(screen.queryByTestId('view-as-self')).toBeNull();
  });
});
