import { quickSheetMaxHeight } from './quick-sheet';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => false } }));

// Phase 75: a fitted sheet on Android takes its content's whole height, past the screen's edge, and then never
// scrolls -- the office's lessons owed hid "Another lesson" under the screen. The root is capped there.
describe('quickSheetMaxHeight', () => {
  it('caps the sheet at the window under the status bar on Android', () => {
    expect(quickSheetMaxHeight('android', 915, 24)).toBe(891);
  });

  it('never goes below nothing', () => {
    expect(quickSheetMaxHeight('android', 10, 24)).toBe(0);
  });

  it('leaves iOS to size its own form sheet', () => {
    expect(quickSheetMaxHeight('ios', 874, 62)).toBeUndefined();
  });
});
