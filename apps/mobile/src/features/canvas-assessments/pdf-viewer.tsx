// Ported from apps/web/src/features/canvas-assessments/pdf-viewer.tsx @ 22b9701.
//
// An assessment's PDF, shown in the app rather than downloaded: it carries the answer key and the
// worked solutions, so it is never written to the device or offered to the share sheet. pdf.js
// draws each page in a react-native-webview (pdf-viewer-html.ts); the app fetches the bytes with the
// session and the organization (src/lib/download.ts), turns them into base64 on Hermes, and hands
// them to the page once it says it is ready. The web view keeps no cache and no storage.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Text } from 'react-native-paper';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { Skeleton } from '@/components/skeleton';
import { bytesToBase64 } from '@/lib/base64';
import { APP_VARIANT } from '@/lib/variant';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { fetchCanvasAssessmentPdf } from './api';
import { PDF_VIEWER_BASE_URL, pdfViewerHtml, readViewerMessage, renderCall } from './pdf-viewer-html';

/** How long the page may take to draw before the viewer says it could not. */
const DRAW_TIMEOUT_MS = 30_000;

/** Only the page's own load: nothing is ever opened, here or outside the app. */
function onlyThePage(request: { url: string }): boolean {
  return request.url === PDF_VIEWER_BASE_URL || request.url === 'about:blank';
}

type ViewerState = 'loading' | 'ready' | 'error';

export function PdfViewer({ assessmentId, label }: { assessmentId: string; label: string }) {
  const theme = useAppTheme();
  const webview = useRef<WebView>(null);
  const [state, setState] = useState<ViewerState>('loading');
  const [pages, setPages] = useState(0);
  const [generation, setGeneration] = useState(0);
  // The PDF, as base64, once fetched; and whether the page has said it is ready for it.
  const pdf = useRef<string | null>(null);
  const pageReady = useRef(false);
  const handedOver = useRef(false);

  const source = useMemo(
    () => ({
      html: pdfViewerHtml({ background: theme.colors.background, border: theme.colors.outlineVariant }),
      baseUrl: PDF_VIEWER_BASE_URL,
    }),
    [theme.colors.background, theme.colors.outlineVariant],
  );

  function handOver() {
    if (handedOver.current || !pageReady.current || pdf.current === null) return;
    handedOver.current = true;
    webview.current?.injectJavaScript(renderCall(pdf.current, label));
  }

  useEffect(() => {
    let cancelled = false;
    pdf.current = null;
    fetchCanvasAssessmentPdf(assessmentId)
      .then((bytes) => {
        if (cancelled) return;
        pdf.current = bytesToBase64(bytes);
        handOver();
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
    // handOver reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  // A page that never finishes drawing is reported, not left spinning.
  useEffect(() => {
    if (state !== 'loading') return;
    const timer = setTimeout(() => setState('error'), DRAW_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state, generation]);

  function onMessage(event: WebViewMessageEvent) {
    const message = readViewerMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.t === 'ready') {
      pageReady.current = true;
      handOver();
    } else if (message.t === 'pages') {
      setPages(message.n);
    } else if (message.t === 'done') {
      setPages(message.n);
      setState('ready');
    } else {
      setState('error');
    }
  }

  /** The web view's process went away: a new page, and the PDF handed over again. */
  function remount() {
    pageReady.current = false;
    handedOver.current = false;
    setState('loading');
    setGeneration((value) => value + 1);
  }

  return (
    <View testID="assessment-pdf-viewer" style={{ flex: 1, gap: space.sm }}>
      {state === 'ready' ? (
        <Text testID="assessment-pdf-pages" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {`${pages} page${pages === 1 ? '' : 's'}`}
        </Text>
      ) : null}
      {state === 'error' ? (
        <Text testID="assessment-pdf-error" variant="bodyMedium" style={{ color: theme.colors.error }}>
          The PDF could not be shown.
        </Text>
      ) : null}
      <View style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden' }}>
        <WebView
          key={generation}
          ref={webview}
          source={source}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={onlyThePage}
          onMessage={onMessage}
          onContentProcessDidTerminate={remount}
          onRenderProcessGone={remount}
          bounces={false}
          overScrollMode="never"
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          allowsLinkPreview={false}
          // iOS only: Android's wrapper aborts on a string here (see the question bank's MathBody).
          dataDetectorTypes={Platform.OS === 'ios' ? 'none' : undefined}
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
          webviewDebuggingEnabled={APP_VARIANT === 'development'}
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            // Android: a web view on a screen that animates away can take the render thread down
            // with it; a hair under full opacity is the library's known workaround.
            opacity: Platform.OS === 'android' ? 0.99 : 1,
          }}
        />
        {state === 'loading' ? (
          <View
            accessibilityLabel="Loading the PDF…"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, gap: space.md, alignItems: 'center' }}
          >
            <Skeleton width="100%" height={420} style={{ borderRadius: radius.md }} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
