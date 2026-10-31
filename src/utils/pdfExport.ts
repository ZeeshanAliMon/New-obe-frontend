import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

/** Elements marked with this class (e.g. download buttons) are left out of every export. */
export const PDF_EXCLUDE_CLASS = 'pdf-exclude';
export const excludeFromExport = (node: HTMLElement) => !node.classList?.contains(PDF_EXCLUDE_CLASS);

/**
 * Export a rendered DOM element to a multi-page A4 portrait PDF.
 *
 * Shared by the student transcript and the CLO / GA attainment reports so all
 * three behave the same. What it does, and why:
 *
 *  - FLEXIBLE WIDTH: lays the element out at 800px, but renders wider if the
 *    content needs it (long names), then scales to the page. A fixed 800px
 *    capture cut off anything wider at the right edge.
 *  - Resets margin/padding/card chrome during capture. html-to-image copies
 *    COMPUTED styles, so an `mx-auto` centring margin on the preview was baked
 *    into the image, shifting it right and clipping its right edge.
 *  - Page breaks only between table rows / top-level blocks. Fixed-height
 *    slicing could cut a row of text in half across two pages.
 *  - 12mm margins on every page; compressed JPEG pages (a lossless PNG of the
 *    whole document made files tens of MB).
 *
 * The element's inline styles are restored afterwards.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const touched = ['width', 'max-width', 'min-height', 'box-shadow', 'border', 'border-radius', 'padding', 'margin'];
  const saved = touched.map(prop => [prop, element.style.getPropertyValue(prop), element.style.getPropertyPriority(prop)] as const);

  try {
    element.style.setProperty('width', '800px', 'important');
    element.style.setProperty('max-width', 'none', 'important');
    element.style.setProperty('min-height', '0', 'important');
    element.style.setProperty('box-shadow', 'none', 'important');
    element.style.setProperty('border', 'none', 'important');
    element.style.setProperty('border-radius', '0px', 'important');
    element.style.setProperty('padding', '0px', 'important');
    element.style.setProperty('margin', '0px', 'important');
    void element.offsetHeight;
    await new Promise(resolve => setTimeout(resolve, 150));

    const renderWidth = Math.max(800, Math.ceil(element.scrollWidth));
    if (renderWidth > 800) {
      element.style.setProperty('width', `${renderWidth}px`, 'important');
      void element.offsetHeight;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const totalHeight = Math.ceil(element.scrollHeight);

    // Safe places to start a new page: the bottom of every table row and of
    // each top-level block (and anything marked data-pdf-block).
    const originTop = element.getBoundingClientRect().top;
    // tbody rows only: breaking right after a column-header row would leave the
    // header stranded at the bottom of a page.
    const breakPoints = Array.from(element.querySelectorAll('tbody tr, :scope > *, [data-pdf-block]'))
      .map(el => Math.round((el as HTMLElement).getBoundingClientRect().bottom - originTop))
      .filter(y => y > 0 && y < totalHeight)
      .sort((x, y) => x - y);

    const PIXEL_RATIO = 2;
    const canvas = await toCanvas(element, {
      pixelRatio: PIXEL_RATIO,
      backgroundColor: '#ffffff',
      width: renderWidth,
      height: totalHeight,
      filter: excludeFromExport,
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const MARGIN = 12;
    const contentWmm = 210 - MARGIN * 2;
    const contentHmm = 297 - MARGIN * 2;
    const pxPerMm = renderWidth / contentWmm;
    const pageHeightPx = Math.floor(contentHmm * pxPerMm);

    let y = 0;
    let first = true;
    while (y < totalHeight - 1) {
      let end = Math.min(y + pageHeightPx, totalHeight);
      if (end < totalHeight) {
        // Pull the break up to the last boundary that still fits, as long as
        // that leaves a reasonably full page.
        const candidates = breakPoints.filter(bp => bp > y + pageHeightPx * 0.4 && bp <= end);
        if (candidates.length) end = candidates[candidates.length - 1];
      }
      const sliceHeight = end - y;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.ceil(sliceHeight * PIXEL_RATIO);
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, Math.floor(y * PIXEL_RATIO), canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);

      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, contentWmm, sliceHeight / pxPerMm, undefined, 'FAST');
      y = end;
    }

    pdf.save(filename);
  } finally {
    saved.forEach(([prop, value, priority]) => {
      if (value) element.style.setProperty(prop, value, priority);
      else element.style.removeProperty(prop);
    });
  }
}

/**
 * Export several elements as a PDF with exactly one element per page (used by
 * the CLO CQI report: one course offering per page). Each element is laid out
 * at `renderWidth` px, then scaled to fit the page — shrunk further if it is
 * too tall, so nothing is cut off. `onProgress(done, total)` lets the caller
 * show progress on long exports.
 */
export async function exportPagesToPdf(
  elements: HTMLElement[],
  filename: string,
  { orientation = 'l', renderWidth = 1100, onProgress }: { orientation?: 'p' | 'l'; renderWidth?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<void> {
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
  const MARGIN = 8;
  const pageW = orientation === 'l' ? 297 : 210;
  const pageH = orientation === 'l' ? 210 : 297;
  const maxW = pageW - MARGIN * 2;
  const maxH = pageH - MARGIN * 2;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const savedWidth = [el.style.getPropertyValue('width'), el.style.getPropertyPriority('width')] as const;
    const savedMaxWidth = [el.style.getPropertyValue('max-width'), el.style.getPropertyPriority('max-width')] as const;
    try {
      el.style.setProperty('width', `${renderWidth}px`, 'important');
      el.style.setProperty('max-width', 'none', 'important');
      void el.offsetHeight;
      await new Promise(resolve => setTimeout(resolve, 50));

      const w = Math.ceil(el.scrollWidth);
      const h = Math.ceil(el.scrollHeight);
      const canvas = await toCanvas(el, { pixelRatio: 2, backgroundColor: '#ffffff', width: w, height: h, filter: excludeFromExport });

      const scale = Math.min(maxW / w, maxH / h);
      const imgW = w * scale;
      const imgH = h * scale;
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (pageW - imgW) / 2, MARGIN, imgW, imgH, undefined, 'FAST');
      pdf.setFontSize(7);
      pdf.setTextColor(120);
      pdf.text(`Page : ${i + 1}`, pageW / 2, pageH - 3, { align: 'center' });
    } finally {
      if (savedWidth[0]) el.style.setProperty('width', savedWidth[0], savedWidth[1]); else el.style.removeProperty('width');
      if (savedMaxWidth[0]) el.style.setProperty('max-width', savedMaxWidth[0], savedMaxWidth[1]); else el.style.removeProperty('max-width');
    }
    onProgress?.(i + 1, elements.length);
  }

  pdf.save(filename);
}
