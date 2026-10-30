// Phase 58: the progress report's panel (its defaults, the range check, the link it opens) and its
// screen (the shared pdf.js viewer, and the server's own words when a report is refused).
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { fetchProgressReportPdf } from './api';
import { defaultReportFrom, ProgressReportPanel } from './progress-report-panel';
import { ProgressReportScreen } from './progress-report-screen';

const mockParams = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams(),
}));
jest.mock('./api', () => ({
  fetchProgressReportPdf: jest.fn(),
  useStudentProgress: () => ({ data: { data: { student: { full_name: 'Sofia Okafor' } } } }),
}));
// The platform picker, as a text field a test can type a date into.
jest.mock('@/components/date-time-field', () => {
  const { TextInput } = jest.requireActual('react-native');
  return {
    DateTimeField: ({ testID, value, onChange }: { testID: string; value: string; onChange: (v: string) => void }) => (
      <TextInput testID={testID} value={value} onChangeText={onChange} />
    ),
  };
});

const push = router.push as jest.Mock;
const fetchPdf = fetchProgressReportPdf as jest.Mock;

beforeEach(() => {
  push.mockClear();
  fetchPdf.mockReset();
});

describe('defaultReportFrom', () => {
  it('starts at the plan, else 90 days before today', () => {
    expect(defaultReportFrom('2026-09-01', '2026-10-29')).toBe('2026-09-01');
    expect(defaultReportFrom(null, '2026-10-29')).toBe('2026-07-31');
    // A plan that starts later than today is not a range at all.
    expect(defaultReportFrom('2026-12-01', '2026-10-29')).toBe('2026-07-31');
  });
});

describe('ProgressReportPanel', () => {
  it('defaults to the plan’s start and today, without the original assessment', async () => {
    await renderWithProviders(<ProgressReportPanel studentId="student-1" planStartsOn="2026-09-01" today="2026-10-29" />);
    expect(screen.getByTestId('progress-report')).toBeTruthy();
    expect(screen.getByTestId('progress-report-from').props.value).toBe('2026-09-01');
    expect(screen.getByTestId('progress-report-to').props.value).toBe('2026-10-29');
    expect(screen.queryByTestId('progress-report-problem')).toBeNull();

    await fireEvent.press(screen.getByTestId('progress-report-generate'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/progress/report/[studentId]',
      params: { studentId: 'student-1', from: '2026-09-01', to: '2026-10-29' },
    });
  });

  it('without a plan, starts 90 days back', async () => {
    await renderWithProviders(<ProgressReportPanel studentId="student-1" planStartsOn={null} today="2026-10-29" />);
    expect(screen.getByTestId('progress-report-from').props.value).toBe('2026-07-31');
  });

  it('refuses a reversed range and disables the button', async () => {
    await renderWithProviders(<ProgressReportPanel studentId="student-1" planStartsOn="2026-09-01" today="2026-10-29" />);
    await fireEvent.changeText(screen.getByTestId('progress-report-to'), '2026-08-01');
    expect(screen.getByTestId('progress-report-problem')).toHaveTextContent('The "To" date is before the "From" date.');
    const button = screen.getByTestId('progress-report-generate');
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(push).not.toHaveBeenCalled();
  });

  it('refuses a range longer than two years', async () => {
    await renderWithProviders(<ProgressReportPanel studentId="student-1" planStartsOn="2026-09-01" today="2026-10-29" />);
    await fireEvent.changeText(screen.getByTestId('progress-report-from'), '2024-01-01');
    expect(screen.getByTestId('progress-report-problem')).toHaveTextContent('A report covers at most two years.');
    expect(screen.getByTestId('progress-report-generate')).toBeDisabled();
  });

  it('passes the chosen dates and the original assessment', async () => {
    await renderWithProviders(<ProgressReportPanel studentId="student-1" planStartsOn="2026-09-01" today="2026-10-29" />);
    await fireEvent.changeText(screen.getByTestId('progress-report-from'), '2026-09-15');
    await fireEvent.changeText(screen.getByTestId('progress-report-to'), '2026-10-15');
    await fireEvent.press(screen.getByTestId('progress-report-original'));
    await fireEvent.press(screen.getByTestId('progress-report-generate'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/progress/report/[studentId]',
      params: { studentId: 'student-1', from: '2026-09-15', to: '2026-10-15', original: '1' },
    });
  });
});

describe('ProgressReportScreen', () => {
  it('fetches the report into the shared viewer with the params it was given', async () => {
    mockParams.mockReturnValue({ studentId: 'student-1', from: '2026-09-01', to: '2026-10-29', original: '1' });
    fetchPdf.mockReturnValue(new Promise(() => {}));
    await renderWithProviders(<ProgressReportScreen />);
    expect(screen.getByTestId('screen-progress-report')).toBeTruthy();
    expect(screen.getByTestId('progress-report-pdf-viewer')).toBeTruthy();
    expect(screen.getByTestId('progress-report-title')).toHaveTextContent('Sofia Okafor · Progress report');
    expect(fetchPdf).toHaveBeenCalledWith('student-1', { from: '2026-09-01', to: '2026-10-29', original: true });
  });

  it('shows the server’s message when the report is refused', async () => {
    mockParams.mockReturnValue({ studentId: 'student-9', from: '2026-09-01', to: '2026-10-29' });
    fetchPdf.mockRejectedValue(new ApiRequestError(404, 'internal_error', 'Not found.'));
    await renderWithProviders(<ProgressReportScreen />);
    await waitFor(() => expect(screen.getByTestId('progress-report-pdf-error')).toHaveTextContent('Not found.'));
    expect(fetchPdf).toHaveBeenCalledWith('student-9', { from: '2026-09-01', to: '2026-10-29', original: false });
  });
});
