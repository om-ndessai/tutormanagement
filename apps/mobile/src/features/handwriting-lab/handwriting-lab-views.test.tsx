// The Handwriting lab's screen (design #64), with the api client mocked at the network edge so the
// real hooks run: a sample line is written, read once the pen rests (the fake reader: its strokes),
// confirmed or corrected and saved; a failed read says why and reads again; the samples are listed,
// shared and deleted.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { HandwritingReading, HandwritingSample, ReadHandwritingInput } from '@tmi/shared';
import { Alert } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';
import { ThemeProvider } from '@/providers/theme-provider';
import { HandwritingLabScreen } from './handwriting-lab-screen';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    delete: (path: string) => mockDelete(path),
  },
}));
const mockShare = jest.fn();
jest.mock('@/lib/download', () => ({
  downloadAndShare: (path: string, name: string) => mockShare(path, name),
}));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
jest.mock('@/lib/haptics', () => ({
  haptics: { selection: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(), impact: jest.fn() },
}));

const PICTURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAB6CAAAAAAAU/tmAAABFUlEQVR4';

const SAMPLE: HandwritingSample = {
  id: 'b7c1a0de-0000-4000-8000-000000000001',
  stroke_count: 9,
  truth: '\\frac{3}{4}',
  category: 'fraction',
  reading: '3/4',
  reading_status: 'read',
  reading_model: 'fake',
  matched: false,
  written_by_name: 'Nav Dessai',
  created_at: '2026-10-28T10:00:00.000Z',
};

let samples: HandwritingSample[] = [];

/** The fake reader, as the local Worker: each line read as its number of strokes. */
function fakeRead(input: ReadHandwritingInput) {
  const readings: HandwritingReading[] = input.lines.map((line) => ({
    key: line.key,
    status: 'read',
    latex: String(line.strokes.length),
    is_math: true,
    confidence: 1,
    matched: null,
    ms: 3,
    image: input.include_image ? PICTURE : null,
    error: null,
  }));
  return { data: { readings, provider: 'fake', model: 'claude-haiku-5-5' } };
}

beforeEach(() => {
  jest.clearAllMocks();
  samples = [];
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/platform/handwriting/samples?limit=50') {
      const matched = samples.filter((s) => s.matched).length;
      return {
        data: {
          samples,
          summary: {
            total: samples.length,
            matched,
            by_category: samples.length ? [{ category: 'clear', total: samples.length, matched }] : [],
          },
        },
      };
    }
    throw new Error(`unexpected GET ${path}`);
  });
  mockPost.mockImplementation(async (path: string, body: unknown) => {
    if (path === '/platform/handwriting/read') return fakeRead(body as ReadHandwritingInput);
    if (path === '/platform/handwriting/samples') {
      const input = body as { truth: string; reading: string | null; category: HandwritingSample['category'] };
      const sample: HandwritingSample = {
        ...SAMPLE,
        id: `b7c1a0de-0000-4000-8000-00000000000${samples.length + 2}`,
        truth: input.truth,
        reading: input.reading,
        category: input.category,
        matched: input.reading === input.truth,
      };
      samples = [sample, ...samples];
      return { data: sample };
    }
    throw new Error(`unexpected POST ${path}`);
  });
  mockDelete.mockImplementation(async (path: string) => {
    const id = path.split('/').pop()!;
    samples = samples.filter((s) => s.id !== id);
    return { data: { id } };
  });
});

let client: QueryClient | undefined;
afterEach(() => {
  client?.clear();
});

async function renderLab() {
  // No garbage-collection timers (gcTime: Infinity): they would hold Jest open for five minutes.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  return await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <HandwritingLabScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

async function writeAndRead() {
  await fireEvent.press(screen.getByTestId('lab-write-sample'));
  await waitFor(() => expect(screen.getByTestId('reading-text-1').props.accessibilityLabel).toMatch(/I read: 9/), {
    timeout: 4000,
  });
}

describe('HandwritingLabScreen', () => {
  it('reads a sample line once the pen rests, and saves it when it was read right', async () => {
    await renderLab();
    expect(screen.getByTestId('screen-handwriting-lab')).toBeTruthy();
    expect(screen.getByText('Write a step on the page. Each line is read once the pen rests.')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText('No samples yet. Write a line, then say whether it was read right.')).toBeTruthy(),
    );
    expect(screen.getByTestId('lab-read-now')).toBeDisabled();

    await writeAndRead();
    // One request, blind (no truth), asking for the picture; the line's nine strokes in the wire format.
    const reads = mockPost.mock.calls.filter(([path]) => path === '/platform/handwriting/read');
    expect(reads).toHaveLength(1);
    const sent = reads[0]![1] as ReadHandwritingInput;
    expect(sent.include_image).toBe(true);
    expect(sent.lines).toHaveLength(1);
    expect(sent.lines[0]!.strokes).toHaveLength(9);
    expect(sent.lines[0]).not.toHaveProperty('truth');
    expect(screen.getByTestId('reading-text-1').props.accessibilityLabel).toBe(
      "Line 1. I read: 9. The reader's own confidence: 100%.",
    );
    expect(screen.getByText('Fake reader')).toBeTruthy();
    expect(screen.getByTestId('lab-line-1')).toBeTruthy();

    // What the reader saw.
    expect(screen.queryByTestId('line-image-1')).toBeNull();
    await fireEvent.press(screen.getByTestId('line-picture-1'));
    expect(screen.getByTestId('line-image-1').props.source).toEqual({ uri: PICTURE });

    await fireEvent.press(screen.getByTestId('line-right-1'));
    await waitFor(() => expect(screen.getByTestId('line-saved-1')).toBeTruthy());
    expect(mockPost).toHaveBeenCalledWith(
      '/platform/handwriting/samples',
      expect.objectContaining({
        truth: '9',
        category: 'clear',
        reading: '9',
        reading_status: 'read',
        reading_model: 'fake',
      }),
    );
    expect(mockToast.success).toHaveBeenCalledWith('Line 1 saved: read right.');
    await waitFor(() => expect(screen.getByTestId('samples-total')).toHaveTextContent('1 sample · read right 100%'));
    // The line is not read again: its ink has not changed.
    expect(mockPost.mock.calls.filter(([path]) => path === '/platform/handwriting/read')).toHaveLength(1);
  });

  it('corrects a misreading, refusing an SSN-shaped line before it is sent', async () => {
    await renderLab();
    await writeAndRead();
    await fireEvent.press(screen.getByTestId('line-fix-1'));
    const field = screen.getByTestId('line-truth-1');
    expect(field.props.value).toBe('9');

    await fireEvent.changeText(field, '123-45-6789');
    await fireEvent.press(screen.getByTestId('line-save-1'));
    expect(mockPost.mock.calls.some(([path]) => path === '/platform/handwriting/samples')).toBe(false);
    expect(screen.getByText(/Social Security/i)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('line-truth-1'), '\\frac{3}{4}');
    expect(screen.getByTestId('line-preview-1').props.accessibilityLabel).toBe('Preview: \\frac{3}{4}');
    await fireEvent.press(screen.getByTestId('line-save-1'));
    await waitFor(() => expect(screen.getByTestId('line-saved-1')).toBeTruthy());
    expect(mockPost).toHaveBeenCalledWith(
      '/platform/handwriting/samples',
      expect.objectContaining({ truth: '\\frac{3}{4}', reading: '9' }),
    );
    expect(mockToast.success).toHaveBeenCalledWith('Line 1 saved: misread.');
  });

  it("shows the server's refusal of what the line says under the field", async () => {
    await renderLab();
    await writeAndRead();
    mockPost.mockImplementationOnce(async () => {
      throw new ApiRequestError(422, 'validation_failed', 'Please correct the highlighted fields.', {
        truth: ['That is not how this line reads.'],
      });
    });
    await fireEvent.press(screen.getByTestId('line-fix-1'));
    await fireEvent.changeText(screen.getByTestId('line-truth-1'), '10');
    await fireEvent.press(screen.getByTestId('line-save-1'));
    await waitFor(() => expect(screen.getByText('That is not how this line reads.')).toBeTruthy());
    expect(screen.queryByTestId('line-saved-1')).toBeNull();
  });

  it('says why a line could not be read, and reads it again', async () => {
    mockPost.mockImplementationOnce(async () => {
      throw new ApiRequestError(403, 'forbidden', 'Reading is switched off.');
    });
    await renderLab();
    await fireEvent.press(screen.getByTestId('lab-write-sample'));
    await waitFor(() => expect(screen.getByText('Reading is switched off.')).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByTestId('line-right-1')).toBeNull();
    expect(screen.getByTestId('line-fix-1-text')).toHaveTextContent('Say what it says');

    await fireEvent.press(screen.getByTestId('line-read-again-1'));
    await waitFor(() => expect(screen.getByTestId('reading-text-1').props.accessibilityLabel).toMatch(/I read: 9/));
  });

  it('lists the samples, shares the corpus and deletes after a confirm', async () => {
    samples = [SAMPLE];
    const alert = jest.spyOn(Alert, 'alert');
    await renderLab();
    await waitFor(() => expect(screen.getByTestId(`sample-row-${SAMPLE.id}`)).toBeTruthy());
    expect(screen.getByTestId('samples-total')).toHaveTextContent('1 sample · read right 0%');
    expect(screen.getByText('3/4')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('samples-download-synthetic'));
    expect(mockShare).toHaveBeenCalledWith('/platform/handwriting/corpus?source=synthetic', 'handwriting-synthetic.json');

    await fireEvent.press(screen.getByTestId(`sample-delete-${SAMPLE.id}`));
    expect(mockDelete).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => {
      buttons.find((b) => b.style === 'destructive')!.onPress!();
    });
    expect(mockDelete).toHaveBeenCalledWith(`/platform/handwriting/samples/${SAMPLE.id}`);
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Sample deleted.'));
    await waitFor(() => expect(screen.queryByTestId(`sample-row-${SAMPLE.id}`)).toBeNull());
  });
});
