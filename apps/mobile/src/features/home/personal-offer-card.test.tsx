// Phase 80 (A12): someone placed in a space when approved is offered a space of their own, once, on the home. Make
// re-reads the session and offers Open it; No thanks re-reads it too (the card goes); a refusal is the server's words.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { PersonalOfferCard } from './personal-offer-card';

const mockRouter = { replace: jest.fn(), dismissAll: jest.fn(), canDismiss: jest.fn(() => false) };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockAnswer = jest.fn();
jest.mock('@/features/organizations/api', () => ({
  useMakePersonalSpace: () => ({ mutateAsync: mockAnswer, isPending: false, variables: undefined }),
}));

const refreshSession = jest.fn(async () => undefined);
const chooseOrganization = jest.fn(async () => undefined);
function as(over: Record<string, unknown> = {}) {
  mockAuth.mockReturnValue({
    personalSpaceOffer: true,
    organization: { slug: 'chmi', name: 'Chapel Hill Math Institute', personal: false },
    refreshSession,
    chooseOrganization,
    ...over,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PersonalOfferCard (Phase 80)', () => {
  it('offers a space of their own, naming the space they are in', async () => {
    as();
    await renderWithProviders(<PersonalOfferCard />);
    expect(screen.getByText('Want a space of your own too?')).toBeTruthy();
    expect(screen.getByTestId('home-personal-offer-text')).toHaveTextContent(
      "You're in Chapel Hill Math Institute. A space of your own is for practising on your own, or with your family later.",
    );
    expect(screen.getByTestId('home-personal-offer-no')).toHaveTextContent('No thanks');
    expect(screen.getByTestId('home-personal-offer-make')).toHaveTextContent('Make my space');
  });

  it('is not shown without the offer, nor in a space of their own', async () => {
    as({ personalSpaceOffer: false });
    await renderWithProviders(<PersonalOfferCard />);
    expect(screen.queryByTestId('home-personal-offer')).toBeNull();
    await screen.unmount();
    as({ organization: { slug: 'sams-space', name: "Sam's space", personal: true } });
    await renderWithProviders(<PersonalOfferCard />);
    expect(screen.queryByTestId('home-personal-offer')).toBeNull();
  });

  it('makes it: the session re-read, then "Your own space is ready." with Open it, which enters it', async () => {
    as();
    mockAnswer.mockResolvedValueOnce({ data: { made: true, slug: 'pias-space', name: "Pia's space" } });
    await renderWithProviders(<PersonalOfferCard />);
    await fireEvent.press(screen.getByTestId('home-personal-offer-make'));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
    expect(mockAnswer).toHaveBeenCalledWith({ make: true });
    expect(refreshSession).toHaveBeenCalled();
    const [text, action] = mockToast.success.mock.calls[0] as [string, { label: string; onPress: () => void }];
    expect(text).toBe('Your own space is ready.');
    expect(action.label).toBe('Open it');
    action.onPress();
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'));
    expect(chooseOrganization).toHaveBeenCalledWith('pias-space');
  });

  it('no thanks: put away, the session re-read, nothing said', async () => {
    as();
    mockAnswer.mockResolvedValueOnce({ data: { made: false, slug: null, name: null } });
    await renderWithProviders(<PersonalOfferCard />);
    await fireEvent.press(screen.getByTestId('home-personal-offer-no'));
    await waitFor(() => expect(refreshSession).toHaveBeenCalled());
    expect(mockAnswer).toHaveBeenCalledWith({ make: false });
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(chooseOrganization).not.toHaveBeenCalled();
  });

  it('says the server’s refusal', async () => {
    as();
    mockAnswer.mockRejectedValueOnce(new ApiRequestError(409, 'conflict', 'You already have a space of your own.'));
    await renderWithProviders(<PersonalOfferCard />);
    await fireEvent.press(screen.getByTestId('home-personal-offer-make'));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('You already have a space of your own.'));
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
