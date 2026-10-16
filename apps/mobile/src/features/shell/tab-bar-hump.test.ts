// The hump's outline, computed from the bar's width (the tab bar, revised 2026-10-15).
import { DISC_CENTRE_BELOW_EDGE, humpEdgePath, humpFillPath } from './tab-bar-hump';

jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: null }) }));

test("at the mock-up's 390pt it is the mock-up's path", () => {
  expect(humpFillPath(390, 130, 40)).toBe(
    'M0 40H144Q153 40 154.2 32A42 42 0 0 1 235.8 32Q237 40 246 40H390V130H0Z',
  );
});

test('it stays centred on a narrower and a wider phone', () => {
  expect(humpEdgePath(360, 40)).toBe('M0 40H129Q138 40 139.2 32A42 42 0 0 1 220.8 32Q222 40 231 40H360');
  expect(humpEdgePath(430, 40)).toBe('M0 40H164Q173 40 174.2 32A42 42 0 0 1 255.8 32Q257 40 266 40H430');
});

test("the disc sits on the hump circle's centre, about 2pt below the flat edge", () => {
  expect(DISC_CENTRE_BELOW_EDGE).toBeCloseTo(1.97, 2);
});
