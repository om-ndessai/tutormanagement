// The PDF viewer's page (Phase 38): pdf.js inlined, nothing it could load from anywhere, and the
// PDF handed over only as data.
import {
  PDF_VIEWER_BASE_URL,
  PDF_VIEWER_CSP,
  imagesCall,
  pdfViewerHtml,
  readViewerMessage,
  renderCall,
} from './pdf-viewer-html';
import { PDFJS_LIB_BASE64, PDFJS_VERSION, PDFJS_WORKER_BASE64 } from './pdfjs.generated';

const page = pdfViewerHtml({ background: 'BG-TOKEN', border: 'BORDER-TOKEN' });

describe('the viewer page', () => {
  it('carries pdf.js and its worker, the web’s version, inline', () => {
    expect(PDFJS_VERSION).toBe('6.3.289');
    expect(page).toContain(PDFJS_LIB_BASE64);
    expect(page).toContain(PDFJS_WORKER_BASE64);
    expect(PDFJS_LIB_BASE64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    // One script element: base64 can never close it early.
    expect(page.match(/<script/g)).toHaveLength(1);
    expect(page.match(/<\/script/g)).toHaveLength(1);
  });

  it('may run only its own inline script and Blob URLs, and load nothing from any address', () => {
    expect(PDF_VIEWER_CSP).toContain("default-src 'none'");
    expect(PDF_VIEWER_CSP).toContain("script-src 'unsafe-inline' blob:");
    expect(PDF_VIEWER_CSP).toContain('worker-src blob:');
    expect(PDF_VIEWER_CSP).not.toMatch(/https?:|\*/);
    expect(page).toContain('Content-Security-Policy');
    expect(page.replace(PDFJS_LIB_BASE64, '').replace(PDFJS_WORKER_BASE64, '')).not.toMatch(/https?:\/\//);
  });

  it('has an origin of its own that can never resolve (a module worker needs one)', () => {
    expect(new URL(PDF_VIEWER_BASE_URL).hostname).toMatch(/\.invalid$/);
  });

  it('takes its colours from the tokens given', () => {
    expect(page).toContain('background:BG-TOKEN');
    expect(page).toContain('border:1px solid BORDER-TOKEN');
  });
});

describe('talking to the page', () => {
  it('reads only the messages it knows', () => {
    expect(readViewerMessage('{"t":"ready"}')).toEqual({ t: 'ready' });
    expect(readViewerMessage('{"t":"pages","n":11}')).toEqual({ t: 'pages', n: 11 });
    expect(readViewerMessage('{"t":"done","n":11}')).toEqual({ t: 'done', n: 11 });
    expect(readViewerMessage('{"t":"error"}')).toEqual({ t: 'error' });
    expect(readViewerMessage('{"t":"done"}')).toBeNull();
    expect(readViewerMessage('nope')).toBeNull();
  });

  it('takes back only the page’s own PNGs, and when all are in (Phase 40)', () => {
    expect(readViewerMessage('{"t":"image","n":2,"src":"data:image/png;base64,iVBOR"}')).toEqual({
      t: 'image',
      n: 2,
      src: 'data:image/png;base64,iVBOR',
    });
    expect(readViewerMessage('{"t":"image","n":2,"src":"https://example.com/x.png"}')).toBeNull();
    expect(readViewerMessage('{"t":"image","n":2,"src":"data:text/html;base64,PGI+"}')).toBeNull();
    expect(readViewerMessage('{"t":"images-done","n":11}')).toEqual({ t: 'images-done', n: 11 });
    expect(page).toContain('window.__images = function (base64, width)');
    expect(imagesCall('JVBERi0=', 1199.6)).toBe('window.__images && window.__images("JVBERi0=", 1200); true;');
  });

  it('hands the PDF over as string literals, whatever the label holds', () => {
    expect(renderCall('JVBERi0=', 'Sofia\'s "work"')).toBe(
      'window.__render && window.__render("JVBERi0=", "Sofia\'s \\"work\\""); true;',
    );
  });
});
