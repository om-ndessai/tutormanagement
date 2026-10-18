import { useEffect, useState } from 'react';

// Phase 40: the submitted PDF's pages as images, so the review editor can lay
// the tutor's ink over each one. pdf.js draws them (as Phase 38's viewer
// does), loaded only when a review is opened.

export interface PdfPageImage {
  /** 1-based, as the PDF numbers them. */
  number: number;
  src: string;
}

export function usePdfPageImages(url: string, width = 1000) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pages, setPages] = useState<PdfPageImage[]>([]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setPages([]);
    (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()) }).promise;
      const images: PdfPageImage[] = [];
      for (let number = 1; number <= doc.numPages; number += 1) {
        const page = await doc.getPage(number);
        const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
        images.push({ number, src: canvas.toDataURL('image/png') });
        if (cancelled) return;
      }
      setPages(images);
      setState('ready');
    })().catch(() => {
      if (!cancelled) setState('error');
    });
    return () => {
      cancelled = true;
    };
  }, [url, width]);

  return { state, pages };
}
