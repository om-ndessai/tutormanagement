// The unsaved-changes guard (ux-audit F-3): a dirty form asks before it goes; a save leaves quietly.
import { act, renderHook } from '@testing-library/react-native';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Alert, Platform } from 'react-native';

import { useDirty, useUnsavedChangesGuard } from './use-unsaved-changes';

const mockPrevent = usePreventRemove as jest.Mock;

beforeEach(() => mockPrevent.mockClear());

describe('useDirty', () => {
  it('is false as the form opened, true once a value changes, false again when it is put back', async () => {
    const { result, rerender } = await renderHook(({ amount }: { amount: string }) => useDirty({ amount }), {
      initialProps: { amount: '' },
    });
    expect(result.current).toBe(false);
    await rerender({ amount: '12.50' });
    expect(result.current).toBe(true);
    await rerender({ amount: '' });
    expect(result.current).toBe(false);
  });
});

describe('useUnsavedChangesGuard', () => {
  it('holds the sheet only while dirty, and asks "Discard changes?" with Keep editing first', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { rerender } = await renderHook(({ dirty }: { dirty: boolean }) => useUnsavedChangesGuard(dirty), {
      initialProps: { dirty: false },
    });
    expect(mockPrevent).toHaveBeenLastCalledWith(false, expect.any(Function));
    await rerender({ dirty: true });
    expect(mockPrevent).toHaveBeenLastCalledWith(true, expect.any(Function));

    const onBeforeRemove = mockPrevent.mock.calls.at(-1)![1] as (event: unknown) => void;
    onBeforeRemove({ data: { action: { type: 'POP' } } });
    expect(alert).toHaveBeenCalledWith(
      'Discard changes?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Keep editing', style: 'cancel' }),
        expect.objectContaining({ text: 'Discard', style: 'destructive' }),
      ]),
    );
    alert.mockRestore();
  });

  it('lets an Android sheet already dragged away go, rather than ask about a screen that is gone', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderHook(() => useUnsavedChangesGuard(true));
    const onBeforeRemove = mockPrevent.mock.calls.at(-1)![1] as (event: unknown) => void;
    onBeforeRemove({ data: { action: { type: 'POP' } } });
    expect(alert).not.toHaveBeenCalled();
    onBeforeRemove({ data: { action: { type: 'GO_BACK' } } });
    expect(alert).toHaveBeenCalledTimes(1);
    alert.mockRestore();
    jest.restoreAllMocks();
  });

  it('stands down before a saved form closes, so saving never asks', async () => {
    const close = jest.fn();
    const { result } = await renderHook(() => useUnsavedChangesGuard(true));
    expect(mockPrevent).toHaveBeenLastCalledWith(true, expect.any(Function));
    await act(async () => result.current.leave(close));
    expect(mockPrevent).toHaveBeenLastCalledWith(false, expect.any(Function));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
