import { jsPDF } from 'jspdf';

export interface GaTranscriptCourse { code: string; title: string; credit: number; grade: string; status: string }
export interface GaTranscriptGa { label: string; title: string; status: string; courses: GaTranscriptCourse[] }
export interface GaTranscriptDoc {
  university: string;
  name: string;
  department: string;
  regNo: string;
  program: string;
  kpi: number;
  printedDate: string;
  gas: GaTranscriptGa[];
}

export const GA_TRANSCRIPT_NOTE = 'This report shows the running direct assessment of GA of the student. The final result will be achieved at the completion of the programme.';

const LEFT = 12;
const RIGHT = 198;
const BODY_BOTTOM = 270;
const ROW = 5.2;
const LINE = 3.8;
const TITLE_WIDTH = 88;
const COL = { code: 14, title: 40, credit: 143, grade: 162, status: 184 };

// The built-in PDF fonts only cover Latin text.
const clean = (s: unknown) => String(s ?? '')
  .replace(/[–—]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[^\x20-\xFF]/g, '?');

/**
 * Download the student GA transcript as a real text PDF, not a picture of the
 * page: text stays sharp and selectable, and every page repeats the student
 * details, the column headings, the note and "Page x of y".
 */
export function downloadGaTranscriptPdf(doc: GaTranscriptDoc, filename: string): void {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: `Student GA Transcript - ${clean(doc.regNo)}`, author: clean(doc.university) });
  pdf.setLineWidth(0.25);
  pdf.setTextColor(0);
  pdf.setDrawColor(0);

  const font = (style: 'normal' | 'bold', size: number) => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
  };

  const studentDetails = (top: number) => {
    let y = top;
    const rows: [string, string, string, string][] = [
      ['STUDENT NAME:', doc.name.toUpperCase(), 'REG NUMBER:', doc.regNo],
      ['DEPARTMENT:', doc.department || '-', 'PROGRAM:', doc.program || '-'],
    ];
    rows.forEach(([l1, v1, l2, v2]) => {
      font('normal', 9);
      const left = pdf.splitTextToSize(clean(v1), 62);
      const right = pdf.splitTextToSize(clean(v2), 68);
      font('bold', 9);
      pdf.text(l1, LEFT, y);
      pdf.text(l2, 104, y);
      font('normal', 9);
      pdf.text(left, 40, y);
      pdf.text(right, 130, y);
      y += Math.max(left.length, right.length) * LINE + 1;
    });
    font('bold', 9);
    const kpi = doc.kpi.toFixed(1);
    pdf.text('GA KPI :', RIGHT - pdf.getTextWidth(kpi) - 2, y, { align: 'right' });
    font('normal', 9);
    pdf.text(kpi, RIGHT, y, { align: 'right' });
    return y + 2;
  };

  const columnHeadings = (top: number) => {
    pdf.setFillColor(200, 200, 200);
    pdf.rect(LEFT, top, RIGHT - LEFT, 6, 'FD');
    font('bold', 8.5);
    const y = top + 4.2;
    pdf.text('Course Code', COL.code, y);
    pdf.text('Course Title', COL.title, y);
    pdf.text('Credit', COL.credit, y, { align: 'center' });
    pdf.text('Grade', COL.grade, y, { align: 'center' });
    pdf.text('GA Status', COL.status, y, { align: 'center' });
    return top + 6;
  };

  // ── First page heading ──
  font('bold', 15);
  pdf.text(clean(doc.university), 105, 16, { align: 'center' });
  font('bold', 11);
  pdf.text('Student GA Transcript', 105, 22, { align: 'center' });

  let tableTop = studentDetails(30);
  let y = columnHeadings(tableTop);

  const closeTable = () => {
    pdf.line(LEFT, tableTop, LEFT, y);
    pdf.line(RIGHT, tableTop, RIGHT, y);
    pdf.line(LEFT, y, RIGHT, y);
  };
  const nextPage = () => {
    closeTable();
    pdf.addPage();
    tableTop = studentDetails(14);
    y = columnHeadings(tableTop);
  };
  const titleLines = (title: string): string[] => {
    font('normal', 8.5);
    return pdf.splitTextToSize(clean(title), TITLE_WIDTH);
  };
  const rowHeight = (lines: string[]) => ROW + (lines.length - 1) * LINE;

  // ── One group of courses per GA ──
  doc.gas.forEach((ga, index) => {
    const gaTitle: string[] = (() => { font('bold', 8.5); return pdf.splitTextToSize(clean(ga.title), RIGHT - COL.title - 2); })();
    const groupHeight = rowHeight(gaTitle);
    const firstCourse = ga.courses[0] ? rowHeight(titleLines(ga.courses[0].title)) : 0;
    // Never leave a GA heading alone at the foot of a page.
    if (y + groupHeight + firstCourse > BODY_BOTTOM) nextPage();

    if (index > 0 && y > tableTop + 6) pdf.line(LEFT, y, RIGHT, y);
    font('bold', 8.5);
    pdf.text(clean(ga.label), COL.code, y + 3.7);
    pdf.text(gaTitle, COL.title, y + 3.7);
    y += groupHeight;

    ga.courses.forEach(course => {
      const lines = titleLines(course.title);
      const h = rowHeight(lines);
      if (y + h > BODY_BOTTOM) nextPage();
      font('normal', 8.5);
      const base = y + 3.7;
      pdf.text(clean(course.code), COL.code, base);
      pdf.text(lines, COL.title, base);
      pdf.text(Number(course.credit).toFixed(1), COL.credit, base, { align: 'center' });
      pdf.text(clean(course.grade || '-'), COL.grade, base, { align: 'center' });
      pdf.text(clean(course.status), COL.status, base, { align: 'center' });
      y += h;
    });
  });
  closeTable();

  // ── Summary, kept whole on one page ──
  const summaryHeight = 11 + 6 + doc.gas.length * ROW;
  y += 9;
  if (y + summaryHeight > BODY_BOTTOM) {
    pdf.addPage();
    y = studentDetails(14) + 6;
  }
  font('bold', 12);
  pdf.text('Summary', 20, y);
  y += 4;
  const [sumLeft, sumRight] = [20, 92];
  const sumTop = y;
  pdf.setFillColor(200, 200, 200);
  pdf.rect(sumLeft, y, sumRight - sumLeft, 6, 'FD');
  font('bold', 8.5);
  pdf.text('GA', sumLeft + 2, y + 4.2);
  pdf.text('Status', 58, y + 4.2);
  y += 6;
  font('normal', 8.5);
  doc.gas.forEach(ga => {
    pdf.text(clean(ga.label), sumLeft + 2, y + 3.7);
    pdf.text(clean(ga.status), 58, y + 3.7);
    pdf.line(sumLeft, y + ROW, sumRight, y + ROW);
    y += ROW;
  });
  pdf.rect(sumLeft, sumTop, sumRight - sumLeft, y - sumTop);
  pdf.line(54, sumTop, 54, y);

  // ── Footer on every page, once the page count is known ──
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    font('bold', 8);
    pdf.text('Note:', LEFT, 277);
    const noteX = LEFT + pdf.getTextWidth('Note: ');
    font('normal', 8);
    pdf.text(pdf.splitTextToSize(GA_TRANSCRIPT_NOTE, RIGHT - noteX), noteX, 277);
    pdf.text(`Printed Date: ${clean(doc.printedDate)}`, LEFT, 288);
    pdf.text(`Page ${page} of ${pages}`, 105, 288, { align: 'center' });
  }

  pdf.save(filename);
}
