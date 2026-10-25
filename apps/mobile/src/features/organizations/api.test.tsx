// Phase 52's space hooks, ported line for line from the web: the same keys, the code's cache
// written by a renewal and by the switch, the requests read again after a decline, and a delete
// that names the space.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  codeKey,
  requestsKey,
  useAskToJoin,
  useDeclineJoinRequest,
  useDeleteSpace,
  useRenewSpaceCode,
  useSetJoinByCode,
  useWithdrawRequest,
} from './api';

const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: jest.fn(),
    post: (path: string, body?: unknown) => mockPost(path, body),
    put: (path: string, body?: unknown) => mockPut(path, body),
    delete: (path: string, body?: unknown) => mockDelete(path, body),
  },
}));
const mockRefresh = jest.fn(async () => undefined);
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ refreshSession: mockRefresh }) }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => jest.clearAllMocks());

describe('spaces api (Phase 52)', () => {
  it('keeps the web’s keys', () => {
    expect(codeKey).toEqual(['organization', 'code']);
    expect(requestsKey).toEqual(['organization', 'join-requests']);
  });

  it('writes a new code and the switch into the code’s cache', async () => {
    const { client, wrapper } = setup();
    const renewed = { data: { code: 'NEWC-2345', join_by_code: true } };
    mockPost.mockResolvedValue(renewed);
    const renew = await renderHook(() => useRenewSpaceCode(), { wrapper });
    await act(() => renew.result.current.mutateAsync());
    expect(mockPost).toHaveBeenCalledWith('/organization/code', undefined);
    expect(client.getQueryData(codeKey)).toEqual(renewed);

    const off = { data: { code: 'NEWC-2345', join_by_code: false } };
    mockPut.mockResolvedValue(off);
    const joining = await renderHook(() => useSetJoinByCode(), { wrapper });
    await act(() => joining.result.current.mutateAsync(false));
    expect(mockPut).toHaveBeenCalledWith('/organization/code', { join_by_code: false });
    expect(client.getQueryData(codeKey)).toEqual(off);
  });

  it('reads the requests again after a decline', async () => {
    const { client, wrapper } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    mockPost.mockResolvedValue(undefined);
    const decline = await renderHook(() => useDeclineJoinRequest(), { wrapper });
    await act(() => decline.result.current.mutateAsync('u-1'));
    expect(mockPost).toHaveBeenCalledWith('/organization/join-requests/u-1/decline', undefined);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: requestsKey });
  });

  it('asks and withdraws, then reads the session again', async () => {
    const { wrapper } = setup();
    mockPost.mockResolvedValue({ data: { requested: true, slug: 'assess' } });
    const ask = await renderHook(() => useAskToJoin(), { wrapper });
    await act(() => ask.result.current.mutateAsync('fmxy2345'));
    expect(mockPost).toHaveBeenCalledWith('/spaces/join-requests', { code: 'fmxy2345' });
    mockDelete.mockResolvedValue(undefined);
    const withdraw = await renderHook(() => useWithdrawRequest(), { wrapper });
    await act(() => withdraw.result.current.mutateAsync('assess'));
    expect(mockDelete).toHaveBeenCalledWith('/spaces/join-requests/assess', undefined);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it('deletes a space by its typed name', async () => {
    const { wrapper } = setup();
    mockDelete.mockResolvedValue(undefined);
    const remove = await renderHook(() => useDeleteSpace(), { wrapper });
    await act(() => remove.result.current.mutateAsync('Maker Test Space'));
    expect(mockDelete).toHaveBeenCalledWith('/organization', { confirm_name: 'Maker Test Space' });
  });
});
