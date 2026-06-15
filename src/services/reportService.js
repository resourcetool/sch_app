// src/services/reportService.js
//
// Changes:
// - All PDF styling driven by school.reportStyle (colors, font, font sizes, border style)
// - Signatures from school.signatures drawn as images in the signature block
// - Border style: single / double / none
// - Watermark support ("DRAFT" diagonal text)
// - Font family: helvetica / times / courier
// - Custom table header bg/text colors
// - generateStudentReportPDF fully updated; generateClassReportPDF preserved

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { defaultGradingScale, applyGradingScale } from './scoreService';

// ── DEFAULTS ──────────────────────────────────────────────────────
const STYLE_DEFAULTS = {
  primaryColor:    '#0f3460',
  accentColor:     '#e94560',
  tableHeaderBg:   '#0f3460',
  tableHeaderText: '#ffffff',
  borderStyle:     'single',
  fontSize:        8,
  titleFontSize:   13,
  font:            'helvetica',
  showLogo:        true,
  showWatermark:   false,
  headerBg:        '#ffffff',
};

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function termLabel(term) {
  return { '1': 'FIRST', '2': 'SECOND', '3': 'THIRD' }[String(term)] || `TERM ${term}`;
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function addLogoToDoc(doc, logoBase64, x, y, size) {
  if (!logoBase64) return;
  try {
    const fmt = logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(logoBase64, fmt, x, y, size, size);
  } catch (e) {
    console.warn('Logo render failed:', e.message);
  }
}

function gradeNo(grade, gradingScale) {
  const sorted = [...gradingScale].sort((a, b) => b.min - a.min);
  const idx    = sorted.findIndex(g => g.grade === grade);
  return idx >= 0 ? idx + 1 : '—';
}

// Draw outer border (single or double)
function drawOuterBorder(doc, style, pageW, pageH) {
  if (style.borderStyle === 'none') return;
  const primary = hexToRgb(style.primaryColor);
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  if (style.borderStyle === 'double') {
    doc.setLineWidth(0.3);
    doc.rect(10.5, 10.5, pageW - 21, pageH - 21);
  }
}

// Draw "DRAFT" watermark diagonally across the page
function drawWatermark(doc, pageW, pageH) {
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.07 }));
  doc.setFontSize(60);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('DRAFT', pageW / 2, pageH / 2, {
    align: 'center', angle: 45,
  });
  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
}

// ── STUDENT REPORT CARD ───────────────────────────────────────────
export async function generateStudentReportPDF(
  student, enrollment, result, classInfo, school, term, academicYear, extraInfo = {}
) {
  const S      = { ...STYLE_DEFAULTS, ...(school?.reportStyle || {}) };
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const margin = 12;
  const cW     = pageW - margin * 2;

  const PRIMARY  = hexToRgb(S.primaryColor);
  const HEADER_BG = hexToRgb(S.tableHeaderBg);
  const HEADER_TX = hexToRgb(S.tableHeaderText);
  const LGRAY    = [230, 230, 230];
  const MGRAY    = [180, 180, 180];
  const BLACK    = [20, 20, 20];
  const WHITE    = [255, 255, 255];

  const gradingScale = school?.gradingScale?.length
    ? school.gradingScale
    : defaultGradingScale();

  const fontName = S.font || 'helvetica';

  // ── WATERMARK ────────────────────────────────────────────────
  if (S.showWatermark) drawWatermark(doc, pageW, pageH);

  // ── OUTER BORDER ─────────────────────────────────────────────
  drawOuterBorder(doc, S, pageW, pageH);

  // ── SCHOOL HEADER ─────────────────────────────────────────────
  const logoSize = 22;
  const logoY    = 13;

  if (S.showLogo) {
    addLogoToDoc(doc, school?.logoBase64, margin, logoY, logoSize);
    addLogoToDoc(doc, school?.logoBase64, pageW - margin - logoSize, logoY, logoSize);
  }

  doc.setFont(fontName, 'bold');
  doc.setFontSize(S.titleFontSize);
  doc.setTextColor(...PRIMARY);
  doc.text((school?.name || 'SCHOOL NAME').toUpperCase(), pageW / 2, 18, { align: 'center' });

  doc.setFontSize(S.fontSize + 2);
  doc.setFont(fontName, 'bold');
  doc.setTextColor(...BLACK);
  doc.text(`END OF ${termLabel(term)} TERM REPORT`, pageW / 2, 24, { align: 'center' });

  const schoolType = school?.schoolType || '';
  if (schoolType) {
    doc.setFontSize(S.fontSize);
    doc.setFont(fontName, 'normal');
    doc.text(`(${schoolType.toUpperCase()})`, pageW / 2, 29, { align: 'center' });
  }

  let y = 33;
  doc.setLineWidth(0.4);
  doc.setDrawColor(...PRIMARY);
  doc.line(margin, y, pageW - margin, y);

  // ── INFO GRID ─────────────────────────────────────────────────
  y += 5;
  doc.setFontSize(S.fontSize);
  doc.setTextColor(...BLACK);

  const nextTermBegins = extraInfo.nextTermBegins || school?.nextTermBegins || '';
  const mec            = extraInfo.mec            || school?.mec            || '';
  const noOnRoll       = extraInfo.noOnRoll        || result.totalStudents   || '';
  const attendance     = extraInfo.attendance      || student.attendance     || '';
  const noOfOnes       = extraInfo.noOfOnes        || 0;
  const rawScore       = result.totalScore || 0;
  const outOf          = result.subjectResults?.length
    ? result.subjectResults.reduce((s) => s + 100, 0) : 0;
  const aggregate      = result.aggregate || result.position || '';

  const col1x = margin, col2x = pageW / 2 + 2, lineH = 5.5;

  const leftInfo  = [
    ['ACADEMIC YEAR:', academicYear],
    ['NAME:',          `${student.firstName} ${student.lastName}`],
    ['NO. ON ROLL:',   noOnRoll],
    ['NO. OF ONES:',   noOfOnes],
  ];
  const rightInfo = [
    ['CURRENT TERM',     ordinal(Number(term))],
    ['NEXT TERM BEGINS:', nextTermBegins],
    ['MEC:',             mec],
    ['ATTENDANCE:',      attendance],
  ];
  const rightInfo2 = [
    ['RAW SCORE:',  rawScore],
    ['OUT OF:',     outOf || '—'],
    ['OUT OF 1000', ''],
    ['AGGREGATE:',  aggregate],
  ];

  leftInfo.forEach(([label, val], i) => {
    doc.setFont(fontName, 'bold');   doc.text(label,        col1x,      y + i * lineH);
    doc.setFont(fontName, 'normal'); doc.text(String(val ?? ''), col1x + 32, y + i * lineH);
  });
  rightInfo.forEach(([label, val], i) => {
    doc.setFont(fontName, 'bold');   doc.text(label,        col2x,      y + i * lineH);
    doc.setFont(fontName, 'normal'); doc.text(String(val ?? ''), col2x + 30, y + i * lineH);
  });
  y += leftInfo.length * lineH + 1;
  rightInfo2.forEach(([label, val], i) => {
    doc.setFont(fontName, 'bold');   doc.text(label,        col2x,      y + i * lineH);
    doc.setFont(fontName, 'normal'); doc.text(String(val ?? ''), col2x + 30, y + i * lineH);
  });

  y += 4;
  doc.setLineWidth(0.3);
  doc.setDrawColor(...LGRAY);
  doc.line(margin, y, pageW - margin, y);

  // ── QUANTITATIVE ASSESSMENT ───────────────────────────────────
  y += 5;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(S.fontSize + 0.5);
  doc.setTextColor(...PRIMARY);
  doc.text('QUANTITATIVE ASSESSMENT', pageW / 2, y, { align: 'center' });
  y += 3;

  const subjectRows = (result.subjectResults || []).map(sr => {
    const grInfo = applyGradingScale(sr.total || 0, gradingScale);
    const gNo    = gradeNo(grInfo.grade, gradingScale);
    return [
      sr.subjectName || '—',
      typeof sr.classScore === 'number' ? sr.classScore.toFixed(2) : (sr.classScore || '—'),
      typeof sr.examScore  === 'number' ? sr.examScore.toFixed(2)  : (sr.examScore  || '—'),
      typeof sr.total      === 'number' ? sr.total.toFixed(2)      : (sr.total      || '—'),
      grInfo.grade,
      gNo,
      grInfo.remarks || '—',
    ];
  });

  doc.autoTable({
    startY: y,
    head: [[
      'SUBJECT',
      `CLASS SCORE\n(${school?.classScorePercent || 50}%)`,
      `EXAM SCORE\n(${school?.examScorePercent  || 50}%)`,
      'TOTAL SCORE\n(100%)',
      'GRADE',
      'GRADE NO.',
      'REMARKS',
    ]],
    body: subjectRows,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor:   HEADER_BG,
      textColor:   HEADER_TX,
      lineColor:   MGRAY,
      lineWidth:   0.2,
      fontSize:    S.fontSize - 0.5,
      fontStyle:   'bold',
      halign:      'center',
      valign:      'middle',
      cellPadding: 2,
      font:        fontName,
    },
    bodyStyles: {
      fontSize:    S.fontSize,
      textColor:   BLACK,
      lineColor:   LGRAY,
      lineWidth:   0.2,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 2 },
      font:        fontName,
    },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center' },
    },
    tableLineColor: MGRAY,
    tableLineWidth: 0.2,
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── GRADES LEGEND + QUALITATIVE side-by-side ──────────────────
  const leftW  = cW * 0.42;
  const rightW = cW * 0.55;
  const leftX  = margin;
  const rightX = margin + leftW + 4;

  const sortedScale = [...gradingScale].sort((a, b) => b.min - a.min);

  doc.autoTable({
    startY: y,
    head:   [['GRADES', 'TOTAL MARKS', 'REMARKS']],
    body:   sortedScale.map((g, i) => [`Grade ${g.grade}`, `${g.min} – ${g.max}`, g.remarks || '']),
    margin: { left: leftX, right: pageW - leftX - leftW },
    tableWidth: leftW,
    headStyles: {
      fillColor: HEADER_BG, textColor: HEADER_TX,
      lineColor: MGRAY, lineWidth: 0.2,
      fontSize: S.fontSize - 1.5, fontStyle: 'bold',
      halign: 'center', cellPadding: 1.5, font: fontName,
    },
    bodyStyles: {
      fontSize: S.fontSize - 1.5, textColor: BLACK,
      lineColor: LGRAY, lineWidth: 0.15,
      cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 },
      font: fontName,
    },
    columnStyles: {
      0: { cellWidth: leftW * 0.34 },
      1: { cellWidth: leftW * 0.34, halign: 'center' },
      2: { halign: 'center' },
    },
    tableLineColor: MGRAY, tableLineWidth: 0.2,
  });

  const gradesBottom = doc.lastAutoTable.finalY;

  const conductItems = [
    'Contribution during lessons',
    'Behaviour and comportment in class',
    'Interest in studying',
    'Socializing with peers',
    'Attitude towards adults',
    'Neatness and appearance',
    'Interest in Arts and Craft',
    'Interest in reading',
  ];

  doc.autoTable({
    startY: y,
    head:   [['CONDUCT', 'EXCELLENT', 'SATISFACTORY', 'POOR']],
    body:   conductItems.map(c => [c, '', '', '']),
    margin: { left: rightX, right: margin },
    tableWidth: rightW,
    headStyles: {
      fillColor: HEADER_BG, textColor: HEADER_TX,
      lineColor: MGRAY, lineWidth: 0.2,
      fontSize: S.fontSize - 1.5, fontStyle: 'bold',
      halign: 'center', cellPadding: 1.5, font: fontName,
    },
    bodyStyles: {
      fontSize: S.fontSize - 1.5, textColor: BLACK,
      lineColor: LGRAY, lineWidth: 0.15,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      font: fontName,
    },
    columnStyles: {
      0: { cellWidth: rightW * 0.52 },
      1: { cellWidth: rightW * 0.16, halign: 'center' },
      2: { cellWidth: rightW * 0.16, halign: 'center' },
      3: { halign: 'center' },
    },
    tableLineColor: MGRAY, tableLineWidth: 0.2,
  });

  y = Math.max(gradesBottom, doc.lastAutoTable.finalY) + 6;

  // ── SIGNATURE BLOCK ───────────────────────────────────────────
  if (y > pageH - 50) { doc.addPage(); y = 14; }

  const sigItems = [
    { key: 'classTeacher',  label: "Class Teacher's Name:",    name: extraInfo.classTeacher  || school?.classTeacher  || '' },
    { key: 'counsellor',    label: "School Counsellor's Name:", name: extraInfo.counsellor   || school?.counsellor    || '' },
    { key: 'academicHead',  label: "Academic Head's Name:",    name: extraInfo.academicHead  || school?.academicHead  || '' },
    { key: 'administrator', label: "Administrator's Name:",    name: extraInfo.administrator || school?.administrator || '' },
  ];

  const sigLabelX = margin;
  const sigNameX  = margin + 44;
  const sigImgX   = pageW / 2 + 2;
  const sigLineX  = sigImgX + 18;
  const sigLineW  = pageW - margin - sigLineX;
  const rowH      = 14;

  doc.setFontSize(S.fontSize);
  doc.setTextColor(...BLACK);

  sigItems.forEach((sig, i) => {
    const rowY = y + i * rowH;

    // Label
    doc.setFont(fontName, 'bold');
    doc.text(sig.label, sigLabelX, rowY + 4);

    // Name in primary color
    doc.setFont(fontName, 'bold');
    doc.setTextColor(...PRIMARY);
    doc.text((sig.name || '').toUpperCase(), sigNameX, rowY + 4);
    doc.setTextColor(...BLACK);

    // Signature image (if available)
    const sigImg = school?.signatures?.[sig.key];
    if (sigImg) {
      try {
        const fmt = sigImg.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(sigImg, fmt, sigImgX, rowY - 2, 30, 10);
      } catch (e) {
        // Signature image failed — draw blank line instead
      }
    }

    // "Signature:" label + line
    doc.setFont(fontName, 'normal');
    doc.setFontSize(S.fontSize - 1);
    doc.text('Signature:', sigImgX, rowY + 4);
    doc.setFontSize(S.fontSize);
    doc.setLineWidth(0.3);
    doc.setDrawColor(...MGRAY);
    doc.line(sigLineX, rowY + 4.5, sigLineX + sigLineW, rowY + 4.5);

    // Row separator
    if (i < sigItems.length - 1) {
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, rowY + rowH - 1, pageW - margin, rowY + rowH - 1);
    }
  });

  y += sigItems.length * rowH + 4;

  // ── FOOTER ────────────────────────────────────────────────────
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated: ${new Date().toLocaleString()} | ${school?.name || ''}`,
    pageW / 2, pageH - 10, { align: 'center' }
  );

  // Re-draw border on top of content (ensures it's not obscured)
  drawOuterBorder(doc, S, pageW, pageH);

  return doc;
}

// ── CLASS RESULT SHEET ────────────────────────────────────────────
export async function generateClassReportPDF(classInfo, results, students, school, academicYear, term) {
  const S      = { ...STYLE_DEFAULTS, ...(school?.reportStyle || {}) };
  const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();

  const HEADER_BG = hexToRgb(S.tableHeaderBg);
  const HEADER_TX = hexToRgb(S.tableHeaderText);
  const fontName  = S.font || 'helvetica';
  const margin    = 12;

  doc.setFillColor(...hexToRgb(S.primaryColor));
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(S.titleFontSize);
  doc.setFont(fontName, 'bold');
  doc.text(`${school?.name || ''} — Class Result Sheet`, pageW / 2, 10, { align: 'center' });
  doc.setFontSize(S.fontSize);
  doc.setFont(fontName, 'normal');
  doc.text(`Class: ${classInfo?.name || ''} | ${academicYear} | Term ${term}`, pageW / 2, 17, { align: 'center' });

  const studentMap   = Object.fromEntries(students.map(s => [s.id, s]));
  const subjectNames = results[0]?.subjectResults?.map(sr => sr.subjectName) || [];
  const headers      = [['#', 'Student ID', 'Student Name', ...subjectNames, 'Total', 'Average', 'Position']];
  const rows         = results.map((r, i) => {
    const s = studentMap[r.studentId];
    return [
      i + 1,
      s?.studentCode || '',
      s ? `${s.firstName} ${s.lastName}` : 'Unknown',
      ...r.subjectResults.map(sr => `${sr.total}\n(${sr.grade})`),
      r.totalScore, r.average, r.position,
    ];
  });

  doc.autoTable({
    startY: 26,
    head: headers,
    body: rows,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: HEADER_BG, textColor: HEADER_TX,
      fontSize: S.fontSize, fontStyle: 'bold', font: fontName,
    },
    bodyStyles: { fontSize: S.fontSize, cellPadding: 2, font: fontName },
    alternateRowStyles: { fillColor: [245, 248, 255] },
  });

  return doc;
}

export function downloadPDF(doc, filename) {
  doc.save(filename);
}
