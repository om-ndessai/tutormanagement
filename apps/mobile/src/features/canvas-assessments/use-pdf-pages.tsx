// Ported from apps/web/src/features/canvas-assessments/use-pdf-pages.ts (Phase 40).
//
// The submitted PDF's pages as images, so the review editor can lay the tutor's ink over each one.
// Mobile: the same pdf.js page as the viewer (pdf-viewer-html.ts) draws them, in a hidden web view;
// each page comes back as a PNG data URL (`window.__images`) and is shown natively. The PDF is
// fetched into memory, as the viewer's is: nothing is written to the device.
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { bytesToBase64 } from '@/lib/base64';
import { useAppTheme } from '@/providers/theme-provider';
import { fetchCanvasAssessmentPdf } from './api';
import { LOCKED_WEBVIEW_PROPS } from './pdf-viewer';
import { imagesCall, PDF_VIEWER_BASE_URL, pdfViewerHtml, readViewerMessage } from './pdf-viewer-html';

export interface PdfPageImage {
  /** 1-based, as the PDF numbers them. */
  number: number;
  src: string;
}

/** How long drawing every page may take before the editor says it could not. */
const DRAW_TIMEOUT_MS = 45_000;

/**
 * The submitted PDF's pages as PNGs `width` pixels wide. `renderer` is the hidden web view that
 * draws them: the screen mounts it anywhere (it takes no room and no touches).
 */
export function usePdfPageImages(
  assessmentId: string,
  width = 1200,
): { state: 'loading' | 'ready' | 'error'; pages: PdfPageImage[]; renderer: ReactElement } {
  const theme = useAppTheme();
  const webview = useRef<WebView>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pages, setPages] = useState<PdfPageImage[]>([]);
  const [generation, setGeneration] = useState(0);
  const pdf = useRef<string | null>(null);
  const pageReady = useRef(false);
  const handedOver = useRef(false);
  // Pages arrive one at a time; they are shown together once all are in.
  const arriving = useRef<PdfPageImage[]>([]);

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
    arriving.current = [];
    webview.current?.injectJavaScript(imagesCall(pdf.current, width));
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
    } else if (message.t === 'image') {
      arriving.current.push({ number: message.n, src: message.src });
    } else if (message.t === 'images-done') {
      setPages([...arriving.current].sort((a, b) => a.number - b.number));
      arriving.current = [];
      setState('ready');
    } else if (message.t === 'error') {
      setState('error');
    }
  }

  function remount() {
    pageReady.current = false;
    handedOver.current = false;
    setGeneration((value) => value + 1);
  }

  const renderer = (
    // A web view must be laid out to run: one point, invisible, out of the way of touches and of
    // assistive tech.
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
    >
      {state === 'loading' ? (
        <WebView
          key={generation}
          ref={webview}
          source={source}
          {...LOCKED_WEBVIEW_PROPS}
          onMessage={onMessage}
          onContentProcessDidTerminate={remount}
          onRenderProcessGone={remount}
          scrollEnabled={false}
          style={{ width: 1, height: 1 }}
        />
      ) : null}
    </View>
  );

  return { state, pages, renderer };
}
