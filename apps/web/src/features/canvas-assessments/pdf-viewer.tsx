import { useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

// Phase 38: an assessment's PDF, shown in the page rather than downloaded.
// pdf.js draws each page onto a canvas, which works the same in every browser
// -- including an iPad's Safari and Android's Chrome, which do not show a PDF
// inside a page on their own. Loaded only when a PDF is opened.

export function PdfViewer({ url, label }: { url: string; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pages, setPages] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const host = container.current;
    if (!host) return;
    host.replaceChildren();
    setState('loading');
    setProblem(null);

    (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) {
        // The Worker's refusal is the shared envelope; say why when it does (Phase 58).
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        if (!cancelled && body?.error?.message) setProblem(body.error.message);
        throw new Error(`HTTP ${response.status}`);
      }
      const data = new Uint8Array(await response.arrayBuffer());
      // Our own PDFs, from our own Worker: standard fonts, no scripts, no forms.
      const doc = await pdfjs.getDocument({ data }).promise;
      if (cancelled) return;
      setPages(doc.numPages);
      const ratio = window.devicePixelRatio || 1;
      for (let number = 1; number <= doc.numPages; number += 1) {
        const page = await doc.getPage(number);
        if (cancelled) return;
        const width = Math.min(host.clientWidth || 800, 900);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.className = 'mx-auto block max-w-full rounded-md border bg-white shadow-sm';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${label}, page ${number} of ${doc.numPages}`);
        canvas.dataset.testid = 'pdf-page';
        host.appendChild(canvas);
        await page.render({ canvas, viewport }).promise;
      }
      if (!cancelled) setState('ready');
    })().catch(() => {
      if (!cancelled) setState('error');
    });

    return () => {
      cancelled = true;
    };
  }, [url, label]);

  return (
    <div className="grid gap-3" data-testid="pdf-viewer" data-state={state} data-pages={pages}>
      {state === 'loading' && <Skeleton className="mx-auto h-[70vh] w-full max-w-[900px]" />}
      {state === 'error' && (
        <p className="text-destructive text-sm" data-testid="pdf-viewer-error">
          {problem ?? 'The PDF could not be shown.'}
        </p>
      )}
      <div ref={container} className="grid gap-4" />
    </div>
  );
}
