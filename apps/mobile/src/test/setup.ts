// Jest setup: the native modules the app touches, replaced with their official mocks.
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Reanimated and its worklets runtime, with their official Jest mocks (no UI thread under Node).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// The official mock has no `useReducedMotion`; tests run as if motion were reduced.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));

// Gesture handler's own Jest setup: its native module and the detectors as plain views.
import 'react-native-gesture-handler/jestSetup';

// React Native's Jest environment reports a font scale of 2, past the 1.35 from which the layouts
// adapt (`use-large-text`). Tests run at the usual text size unless they set their own.
{
  const { Dimensions } = require('react-native') as typeof import('react-native');
  const window = Dimensions.get('window');
  const screen = Dimensions.get('screen');
  Dimensions.set({ window: { ...window, fontScale: 1 }, screen: { ...screen, fontScale: 1 } });
}

// The phone is online in tests unless one says otherwise (the offline banner, F-16).
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));

// No navigator under Jest: a form's unsaved-changes guard has nothing to hold (F-3). Its own test
// replaces these.
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));

// The live lesson's system surface (#45): no ActivityKit or notification manager under Jest. The
// facade's own test drives it through a fake driver.
jest.mock('@/features/teaching/live-surface-driver', () => ({
  liveSurfaceDriver: {
    show: jest.fn(async () => undefined),
    end: jest.fn(async () => undefined),
    isShowing: jest.fn(async () => false),
  },
}));

// react-native-webview (the question bank's maths, #54): a plain View that reports its body's height
// as the real page's injected reporter does -- once per page, and again for each body swapped in
// place (`window.__q(key, html)`). `global.webviewHeight` lets a test hold the report back.
jest.mock('react-native-webview', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  type MockWebViewProps = {
    source?: { html?: string };
    onMessage?: (event: unknown) => void;
    testID?: string;
  };
  const report = (props: MockWebViewProps, key: string | undefined) => {
    const height = (globalThis as { webviewHeight?: number | null }).webviewHeight;
    if (height === null) return;
    props.onMessage?.({ nativeEvent: { data: JSON.stringify({ k: key, h: height ?? 120 }) } });
  };
  const WebView = React.forwardRef<{ injectJavaScript: (js: string) => void }, MockWebViewProps>(
    function MockWebView(props, ref) {
      const latest = React.useRef(props);
      latest.current = props;
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: (js: string) => {
          const swap = /window\.__q\("((?:[^"\\]|\\.)*)"/.exec(js);
          if (swap) report(latest.current, JSON.parse(`"${swap[1]}"`) as string);
        },
      }));
      const html = props.source?.html ?? '';
      React.useEffect(() => {
        report(latest.current, /data-k="([^"]*)"/.exec(html)?.[1]);
      }, [html]);
      return React.createElement(View, { testID: 'mock-webview' });
    },
  );
  return { __esModule: true, default: WebView, WebView };
});
