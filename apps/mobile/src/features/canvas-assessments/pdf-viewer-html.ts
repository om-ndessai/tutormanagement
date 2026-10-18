// The page of the assessment PDF viewer's web view (Phase 38), after
// apps/web/src/features/canvas-assessments/pdf-viewer.tsx @ 22b9701: pdf.js draws each page onto a
// canvas, one under the other, and the web view scrolls them. Mobile: the page loads nothing from
// anywhere. pdf.js comes inlined (pdfjs.generated.ts, base64): the library is imported from a Blob
// URL and the worker runs from another (pdf.js falls back to its own in-page worker if a worker is
// refused). The PDF itself arrives from the host as base64 through `window.__render`, fetched by
// the app with the session -- it is never a URL the page could load, and never a file on the device.
// The page tells the host `ready`, `pages` and `done` (or `error`). Pure: no React.
import { escapeHtml } from '@/features/question-bank/question-html';
import { PDFJS_LIB_BASE64, PDFJS_WORKER_BASE64 } from './pdfjs.generated';

/**
 * Scripts only inline or from the page's own Blob URLs (pdf.js and its worker); no fetch, frame,
 * form or address of any kind. pdf.js's fonts and images come from memory (`blob:`/`data:`).
 */
export const PDF_VIEWER_CSP =
  "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; style-src 'unsafe-inline'; img-src blob: data:; font-src blob: data:; connect-src blob: data:; base-uri 'none'; form-action 'none'";

/**
 * The page's own address, and its origin. A page loaded with no address has an opaque origin, from
 * which WebKit and Chrome refuse a module worker (pdf.js's worker is a module); with this one its
 * Blob URLs are its own, and the worker runs off the main thread. `.invalid` can never resolve, the
 * CSP lets the page fetch nothing, and the host refuses any navigation but the page's own load.
 */
export const PDF_VIEWER_BASE_URL = 'https://pdf-viewer.invalid/';

/** The page's colours: the theme's tokens. The PDF's own pages are white, as pdf.js paints them. */
export interface PdfViewerColors {
  background: string;
  border: string;
}

/** The most device pixels per point a page is drawn at: sharp, and a 10-page PDF stays in memory. */
export const MAX_PIXEL_RATIO = 2;
/** The widest a page is drawn, in points (an iPad's width would make each one enormous). */
export const MAX_PAGE_WIDTH = 900;

const SCRIPT = `(function () {
  var LIB = '${PDFJS_LIB_BASE64}';
  var WORKER = '${PDFJS_WORKER_BASE64}';
  function post(message) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  function bytes(base64) {
    var text = atob(base64);
    var out = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
    return out;
  }
  function scriptUrl(base64) {
    return URL.createObjectURL(new Blob([bytes(base64)], { type: 'text/javascript' }));
  }
  var loading = null;
  function pdfjs() {
    if (!loading) {
      loading = import(scriptUrl(LIB)).then(function (lib) {
        lib.GlobalWorkerOptions.workerSrc = scriptUrl(WORKER);
        return lib;
      });
    }
    return loading;
  }
  window.__render = function (base64, label) {
    var host = document.getElementById('pages');
    host.textContent = '';
    pdfjs()
      .then(function (lib) {
        // Our own PDFs, from our own Worker: standard fonts, no scripts, no forms.
        return lib.getDocument({ data: bytes(base64), isEvalSupported: false }).promise;
      })
      .then(function (doc) {
        post({ t: 'pages', n: doc.numPages });
        var ratio = Math.min(window.devicePixelRatio || 1, ${MAX_PIXEL_RATIO});
        var chain = Promise.resolve();
        for (var n = 1; n <= doc.numPages; n++) {
          (function (number) {
            chain = chain.then(function () {
              return doc.getPage(number).then(function (page) {
                var width = Math.min(host.clientWidth || window.innerWidth, ${MAX_PAGE_WIDTH});
                var base = page.getViewport({ scale: 1 });
                var viewport = page.getViewport({ scale: (width / base.width) * ratio });
                var canvas = document.createElement('canvas');
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.style.width = Math.floor(viewport.width / ratio) + 'px';
                canvas.setAttribute('role', 'img');
                canvas.setAttribute('aria-label', label + ', page ' + number + ' of ' + doc.numPages);
                host.appendChild(canvas);
                return page.render({ canvas: canvas, viewport: viewport }).promise;
              });
            });
          })(n);
        }
        return chain.then(function () {
          post({ t: 'done', n: doc.numPages });
        });
      })
      .catch(function () {
        post({ t: 'error' });
      });
  };
  post({ t: 'ready' });
})();`;

export function pdfViewerHtml(colors: PdfViewerColors): string {
  const css =
    `:root{color-scheme:normal}` +
    `html,body{margin:0;padding:0;background:${colors.background}}` +
    `#pages{display:grid;gap:12px;justify-items:center;padding:4px 0 24px}` +
    `canvas{display:block;max-width:100%;height:auto;border:1px solid ${colors.border};border-radius:6px}`;
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(PDF_VIEWER_CSP)}">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3">' +
    `<style>${css}</style></head><body><div id="pages"></div><script>${SCRIPT}</script></body></html>`
  );
}

/** What the page tells the host, read defensively. */
export type PdfViewerMessage =
  | { t: 'ready' }
  | { t: 'pages'; n: number }
  | { t: 'done'; n: number }
  | { t: 'error' };

export function readViewerMessage(data: string): PdfViewerMessage | null {
  try {
    const message = JSON.parse(data) as { t?: unknown; n?: unknown };
    if (message.t === 'ready' || message.t === 'error') return { t: message.t };
    if ((message.t === 'pages' || message.t === 'done') && typeof message.n === 'number') {
      return { t: message.t, n: message.n };
    }
    return null;
  } catch {
    return null;
  }
}

/** The call that hands the PDF to the page: base64 and a label, both as JSON string literals. */
export function renderCall(base64: string, label: string): string {
  return `window.__render && window.__render(${JSON.stringify(base64)}, ${JSON.stringify(label)}); true;`;
}
