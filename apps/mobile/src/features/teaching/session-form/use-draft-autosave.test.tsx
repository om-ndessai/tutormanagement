import { act, renderHook } from '@testing-library/react-native';
import type { SessionDraftInput } from '@tmi/shared';
import { AppState } from 'react-native';

import { useDraftAutosave, withDraft, type DraftAutosaveOptions } from './use-draft-autosave';

const TUTOR = '00000000-0000-4000-8000-000000000003';
const STUDENT = '00000000-0000-4000-8000-000000000009';

function body(notes: string | null, overrides: Partial<SessionDraftInput> = {}): SessionDraftInput {
  return {
    tutor_user_id: TUTOR,
    student_user_id: STUDENT,
    occurred_on: '2026-10-08',
    started_at: '16:00',
    ended_at: '17:00',
    mode: 'in_person',
    notes,
    write_up: {
      planned: null,
      previous_review: null,
      homework_review: null,
      homework_status: null,
      homework_assigned: null,
    },
    ...overrides,
  };
}

/** A save that answers when told to, so a test can hold one in flight. */
function deferredSave() {
  const calls: {
    id: string | undefined;
    body: SessionDraftInput;
    resolve: () => void;
    reject: () => void;
  }[] = [];
  const save = jest.fn(
    (id: string | undefined, input: SessionDraftInput) =>
      new Promise<{ data: { id: string } }>((resolve, reject) => {
        calls.push({
          id,
          body: input,
          resolve: () => resolve({ data: { id: id ?? 'draft-1' } }),
          reject: () => reject(new Error('offline')),
        });
      }),
  );
  return { save, calls };
}

async function setup(overrides: Partial<DraftAutosaveOptions> & { current?: SessionDraftInput | null } = {}) {
  const state = { current: overrides.current === undefined ? body('Fractions') : overrides.current };
  const { save, calls } = deferredSave();
  const onInvalid = jest.fn();
  const onValid = jest.fn();
  const onKeptAsDraft = jest.fn();
  const hook = await renderHook(() =>
    useDraftAutosave({
      enabled: true,
      getBody: () => state.current,
      save,
      onInvalid,
      onValid,
      onKeptAsDraft,
      intervalMs: 3000,
      ...overrides,
    }),
  );
  return { hook, state, save, calls, onInvalid, onValid, onKeptAsDraft };
}

async function tick(ms = 3000) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

async function settle(call: { resolve: () => void }) {
  await act(async () => {
    call.resolve();
    await Promise.resolve();
  });
}

let listeners: ((status: string) => void)[] = [];
beforeEach(() => {
  jest.useFakeTimers();
  listeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (status: string) => void);
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the 3-second autosave', () => {
  it('waits for something worth keeping, then POSTs once and PATCHes the same draft after', async () => {
    const { state, save, calls, hook } = await setup({ current: null });
    await tick();
    expect(save).not.toHaveBeenCalled();
    expect(hook.result.current.state.kind).toBe('idle');

    state.current = body('Fractions');
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]!.id).toBeUndefined();
    expect(hook.result.current.state.kind).toBe('saving');
    await settle(calls[0]!);
    expect(hook.result.current.state.kind).toBe('saved');
    expect(hook.result.current.draftId()).toBe('draft-1');

    // Unchanged: nothing is sent.
    await tick();
    expect(save).toHaveBeenCalledTimes(1);

    state.current = body('Fractions and decimals');
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1]!.id).toBe('draft-1');
  });

  it('never overlaps: a slow save holds the next one back', async () => {
    const { state, save, calls } = await setup();
    await tick();
    state.current = body('Changed while saving');
    await tick();
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    await settle(calls[0]!);
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('checks the shared draft schema first: an SSN-shaped note is never sent, and says why', async () => {
    const { state, save, onInvalid, onValid, hook, calls } = await setup({
      current: body('SSN 123-45-6789'),
    });
    await tick();
    expect(save).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(Object.keys(onInvalid.mock.calls[0]![0])).toContain('notes');
    expect(hook.result.current.state.kind).toBe('failed');
    // The same body is not checked again every 3 s.
    await tick();
    expect(onInvalid).toHaveBeenCalledTimes(1);

    state.current = body('Fractions');
    await tick();
    expect(onValid).toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    await settle(calls[0]!);
  });

  it('does not retry a failed save until the body changes', async () => {
    const { state, save, calls, hook } = await setup();
    await tick();
    await act(async () => {
      calls[0]!.reject();
      await Promise.resolve();
    });
    expect(hook.result.current.state.kind).toBe('failed');
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    state.current = body('Fractions, again');
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('is off while editing a lesson on the record', async () => {
    const { save } = await setup({ enabled: false });
    await tick(10_000);
    expect(save).not.toHaveBeenCalled();
  });

  it('saves when the app goes to the background', async () => {
    const { save, calls } = await setup();
    await act(async () => listeners.forEach((listener) => listener('background')));
    expect(save).toHaveBeenCalledTimes(1);
    await settle(calls[0]!);
  });

  it('closing saves what was typed since, then says where the new draft is', async () => {
    const { state, save, calls, hook, onKeptAsDraft } = await setup();
    await tick();
    await settle(calls[0]!);
    state.current = body('Typed just before closing');
    await hook.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1]!.id).toBe('draft-1');
    await settle(calls[1]!);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onKeptAsDraft).toHaveBeenCalledTimes(1);
  });

  it('after settling (recording or posting), closing saves nothing', async () => {
    const { save, calls, hook, onKeptAsDraft } = await setup();
    await tick();
    await settle(calls[0]!);
    await act(async () => {
      await hook.result.current.settle();
    });
    await hook.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(onKeptAsDraft).not.toHaveBeenCalled();
  });

  it('a draft picked back up is not re-sent until it changes, and closing it says nothing', async () => {
    const { state, save, hook, onKeptAsDraft, calls } = await setup({ initialDraftId: 'draft-9' });
    await tick();
    expect(save).not.toHaveBeenCalled();
    state.current = body('Finished at home');
    await tick();
    expect(calls[0]!.id).toBe('draft-9');
    await settle(calls[0]!);
    await hook.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(onKeptAsDraft).not.toHaveBeenCalled();
  });
});

describe('the cached drafts list', () => {
  it('takes each quiet save, so Continue opens what was last kept, not the first tick', () => {
    const half = { id: 'draft-1', notes: 'Aut' } as never;
    const full = { id: 'draft-1', notes: 'Autosaved from the phone' } as never;
    const other = { id: 'draft-2', notes: 'Another' } as never;
    const list = withDraft({ data: [half, other] }, full);
    expect(list?.data).toEqual([full, other]);
    expect(withDraft(undefined, full)).toBeUndefined();
  });
});
