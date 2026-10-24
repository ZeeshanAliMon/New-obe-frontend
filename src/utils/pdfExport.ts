import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

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
