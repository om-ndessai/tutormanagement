// The question bank's maths, drawn by KaTeX as the web draws it (#54): one react-native-webview per
// body, showing HTML built on Hermes (question-html.ts). The page runs no script and can fetch
// nothing; the only script is the host's own height reporter, injected natively (outside the page's
// CSP), which posts `{ k: <question id>, h }` whenever the body's box changes size.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { Skeleton } from '@/components/skeleton';
import { APP_VARIANT } from '@/lib/variant';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import type { AppTheme } from '@/theme/paper-theme';
import { radius, space } from '@/theme/tokens';
import { mathShell, type ShellColors } from './question-html';

/** How long a body may take to report its height before the plain text is shown instead. */
export const DRAW_TIMEOUT_MS = 3000;

/**
 * Reports `#q`'s height with its key, now, whenever its box changes (ResizeObserver), and once the
 * fonts are in. With it, each `.choice` box's top and height (`c`), which the assessment lays native
 * buttons over (Phase 38); the bank ignores them. `window.__q` swaps the body in place (Review keeps one web view for the session).
 */
const REPORTER = `(function () {
  var q = document.getElementById('q');
  if (!q || !window.ReactNativeWebView) return;
  function post() {
    var h = Math.ceil(q.getBoundingClientRect().height);
    var c = [];
    var boxes = q.querySelectorAll('.choice');
    for (var i = 0; i < boxes.length; i++) {
      var r = boxes[i].getBoundingClientRect();
      c.push([Math.round(r.top), Math.round(r.height)]);
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({ k: q.getAttribute('data-k'), h: h, c: c }));
  }
  window.__q = function (k, html) { q.setAttribute('data-k', k); q.innerHTML = html; post(); };
  try { new ResizeObserver(post).observe(q); } catch (e) {}
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(post);
  post();
})();
true;`;

export function shellColors(theme: AppTheme): ShellColors {
  return {
    fg: theme.colors.onSurface,
    muted: theme.colors.onSurfaceVariant,
    border: theme.colors.outlineVariant,
    key: theme.tokens.success,
    keyBg: withAlpha(theme.tokens.success, 0.12),
    soft: withAlpha(theme.colors.surfaceVariant, 0.5),
    error: theme.colors.error,
    accent: theme.colors.primary,
    accentBg: withAlpha(theme.colors.primary, 0.1),
  };
}

/** A choice's box in the body, in points from its top. */
export interface ChoiceBox {
  top: number;
  height: number;
}

/** The page's `c`, read defensively: pairs of finite numbers only. */
export function choiceBoxes(raw: unknown[]): ChoiceBox[] {
  return raw.flatMap((entry) =>
    Array.isArray(entry) &&
    typeof entry[0] === 'number' &&
    typeof entry[1] === 'number' &&
    Number.isFinite(entry[0]) &&
    Number.isFinite(entry[1])
      ? [{ top: entry[0], height: entry[1] }]
      : [],
  );
}

/** Only the page's own load: nothing is ever opened, here or outside the app. */
function onlyThePage(request: { url: string }): boolean {
  return request.url === 'about:blank';
}

interface Page {
  key: string;
  html: string;
  look: string;
}

/**
 * One question's body. `html` is `questionBodyHtml(...)`; `speech` reads it in order for assistive
 * tech (the web view itself is hidden from it); `plain` is shown if the page cannot draw within
 * three seconds. `onRendered(key)` fires once the page has drawn `contentKey` (or the plain text
 * stands in for it). `persistent` keeps one page and swaps each new body in place -- Review's,
 * where Approve -> the next question costs a few ms of KaTeX and a repaint, never a new web view.
 */
export function MathBody({
  html,
  speech,
  plain,
  contentKey,
  onRendered,
  onChoiceBoxes,
  persistent = false,
  testID,
}: {
  html: string;
  speech: string;
  plain: string;
  contentKey: string;
  onRendered?: (key: string) => void;
  /** Each `.choice` box's top and height in the body, as the page reports them (Phase 38). */
  onChoiceBoxes?: (key: string, boxes: ChoiceBox[]) => void;
  persistent?: boolean;
  testID?: string;
}) {
  const theme = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const colors = useMemo(() => shellColors(theme), [theme]);
  // What the page looks like apart from its body: a change rebuilds the shell.
  const look = `${theme.scheme}|${fontScale}|${Object.values(colors).join(',')}`;
  const webview = useRef<WebView>(null);
  // The body the page was loaded with. Without `persistent` it always follows the props.
  const [page, setPage] = useState<Page>({ key: contentKey, html, look });
  const [generation, setGeneration] = useState(0);
  const [measured, setMeasured] = useState<{ key: string; height: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // What the page shows now (a swap changes it without a reload), and whether it has spoken yet.
  const shown = useRef({ key: contentKey, html });
  const ready = useRef(false);
  const reported = useRef<string | null>(null);

  if (page.look !== look || (!persistent && (page.key !== contentKey || page.html !== html))) {
    setPage({ key: contentKey, html, look });
  }

  const source = useMemo(
    () => ({
      html: mathShell({ colors, fontScale, scheme: theme.scheme, body: page.html, key: page.key }),
    }),
    [colors, fontScale, theme.scheme, page.html, page.key],
  );

  // A new page (or a remount): it has not spoken yet, and shows the body it was loaded with.
  useEffect(() => {
    ready.current = false;
    shown.current = { key: page.key, html: page.html };
  }, [page.key, page.html, generation]);

  /** Review's swap: the next body goes into the page that is there, in place. */
  function swapIn(key: string, body: string) {
    shown.current = { key, html: body };
    webview.current?.injectJavaScript(
      `window.__q && window.__q(${JSON.stringify(key)}, ${JSON.stringify(body)}); true;`,
    );
  }

  // A page not ready yet takes the new body from its first message (onMessage).
  useEffect(() => {
    if (!persistent || !ready.current) return;
    if (shown.current.key !== contentKey || shown.current.html !== html) swapIn(contentKey, html);
  }, [persistent, contentKey, html]);

  // No height for this body within three seconds: show it as plain text instead.
  useEffect(() => {
    const timer = setTimeout(() => setFailed(contentKey), DRAW_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [contentKey, generation]);

  useEffect(() => {
    if (failed !== contentKey || reported.current === contentKey) return;
    reported.current = contentKey;
    onRendered?.(contentKey);
  }, [failed, contentKey, onRendered]);

  function onMessage(event: WebViewMessageEvent) {
    let message: { k?: unknown; h?: unknown; c?: unknown };
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message;
    } catch {
      return;
    }
    ready.current = true;
    if (persistent && (shown.current.key !== contentKey || shown.current.html !== html)) {
      swapIn(contentKey, html);
      return;
    }
    if (message.k !== contentKey || typeof message.h !== 'number' || message.h <= 0) return;
    // Before onRendered, so a listener knows the boxes once it hears the body is drawn.
    if (onChoiceBoxes && Array.isArray(message.c)) onChoiceBoxes(contentKey, choiceBoxes(message.c));
    const height = Math.ceil(message.h) + 2;
    setMeasured((was) =>
      was?.key === contentKey && was.height === height ? was : { key: contentKey, height },
    );
    setFailed(null);
    if (reported.current !== contentKey) {
      reported.current = contentKey;
      onRendered?.(contentKey);
    }
  }

  function remount() {
    ready.current = false;
    setPage({ key: contentKey, html, look });
    setGeneration((value) => value + 1);
  }

  const drawn = measured !== null;
  const showPlain = failed === contentKey && measured?.key !== contentKey;
  // Between two bodies in place, the last height holds until the new one reports (no flicker).
  const height = drawn ? measured.height : 160;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={speech}
      pointerEvents="none"
      style={{ minHeight: showPlain ? undefined : height }}
    >
      {showPlain ? (
        <View style={{ gap: space.xs }}>
          <Text
            testID="question-bank-body-fallback"
            variant="bodySmall"
            style={{ color: theme.colors.error }}
          >
            Couldn’t draw the maths; showing it as text.
          </Text>
          <Text variant="bodyLarge">{plain}</Text>
        </View>
      ) : null}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={showPlain ? { height: 1, opacity: 0 } : { height }}
      >
        <WebView
          key={generation}
          ref={webview}
          source={source}
          // Every request reaches onlyThePage, which refuses all but the page itself. (An origin
          // list would hand a refused address to Linking.openURL; this never opens anything.)
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={onlyThePage}
          injectedJavaScript={REPORTER}
          onMessage={onMessage}
          onContentProcessDidTerminate={remount}
          onRenderProcessGone={remount}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          allowsLinkPreview={false}
          // iOS only. Android's wrapper hands the value to the native props parser as it is, where a
          // string (not an array) aborted the app.
          dataDetectorTypes={Platform.OS === 'ios' ? 'none' : undefined}
          textInteractionEnabled={false}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          domStorageEnabled={false}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          geolocationEnabled={false}
          mediaPlaybackRequiresUserAction
          allowsInlineMediaPlayback={false}
          mixedContentMode="never"
          saveFormDataDisabled
          cacheEnabled={false}
          incognito
          textZoom={100}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          webviewDebuggingEnabled={APP_VARIANT === 'development'}
          // Android: a web view on a screen that animates away can take the render thread down with
          // it; a hair under full opacity is the library's known workaround.
          style={{ backgroundColor: 'transparent', opacity: Platform.OS === 'android' ? 0.99 : 1 }}
        />
      </View>
      {!drawn && !showPlain ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, gap: space.sm }}>
          <Skeleton width="90%" height={18} style={{ borderRadius: radius.sm }} />
          <Skeleton width="70%" height={18} style={{ borderRadius: radius.sm }} />
          <Skeleton width="100%" height={44} style={{ borderRadius: radius.md }} />
          <Skeleton width="100%" height={44} style={{ borderRadius: radius.md }} />
        </View>
      ) : null}
    </View>
  );
}
