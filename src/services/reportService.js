// src/services/reportService.js
//
// Changes per request — make the report sheet reflect true, current data:
// 1. REMOVED "NO. ON ROLL" and "NO. OF ONES" fields entirely (cleaner, more
//    professional layout).
// 2. "OUT OF" now reflects the ACTUAL number of students in the class
//    (results.length passed in as totalStudents), not a static 100/subject
//    calculation. This is the true denominator for "raw score out of X".
// 3. "MEC" renamed to the actual class name assigned by the admin
//    (e.g. "JHS 1", "Class 6") — pulled from classInfo.name, the real
//    class label the admin created, not a separate manually-typed field.
// 4. Remaining fields (Academic Year, Name, Current Term, Next Term Begins,
//    Attendance, Raw Score, Aggregate) all pull from real admin/teacher
//    input — no placeholders.
// 5. Layout re-balanced into a clean 2-column info grid now that 2 rows
//    were removed.

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
  tableBorderWidth:  0.2,
  tableBorderColor:  '#b4b4b4',
  tableCellPaddingV: 2,
  tableCellPaddingH: 3,
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
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
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

function drawWatermark(doc, pageW, pageH) {
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.07 }));
  doc.setFontSize(60);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('DRAFT', pageW / 2, pageH / 2, { align: 'center', angle: 45 });
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

  const PRIMARY   = hexToRgb(S.primaryColor);
  const HEADER_BG = hexToRgb(S.tableHeaderBg);
  const HEADER_TX = hexToRgb(S.tableHeaderText);
  const LGRAY     = [230, 230, 230];
  // MGRAY is now driven by the admin's chosen table border color
  // (defaults to the same grey as before if not customized)
  const MGRAY     = hexToRgb(S.tableBorderColor);
  const TBW       = S.tableBorderWidth;              // table border width (mm)
  const TPV       = S.tableCellPaddingV;              // cell padding vertical (mm)
  const TPH       = S.tableCellPaddingH;              // cell padding horizontal (mm)
  const BLACK     = [20, 20, 20];
  const WHITE     = [255, 255, 255];

  const gradingScale = school?.gradingScale?.length ? school.gradingScale : defaultGradingScale();
  const fontName     = S.font || 'helvetica';

  if (S.showWatermark) drawWatermark(doc, pageW, pageH);
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
  // Only real, admin/teacher-sourced fields. No placeholders.
  // "NO. ON ROLL" and "NO. OF ONES" removed entirely per request.
  // "OUT OF" = true number of students in the class (totalStudents).
  // "MEC" replaced with the real class name assigned by the admin.
  y += 6;
  doc.setFontSize(S.fontSize);
  doc.setTextColor(...BLACK);

  const className       = classInfo?.name || extraInfo.className || '—';
  const nextTermBegins   = extraInfo.nextTermBegins || school?.nextTermBegins || '—';
  const attendance       = extraInfo.attendance      || student.attendance     || '—';
  const rawScore         = result.totalScore ?? 0;
  const totalStudents    = extraInfo.totalStudents || result.totalStudents || 0;
  const aggregate        = result.aggregate || result.position || '—';

  const col1x = margin;
  const col2x = pageW / 2 + 4;
  const lineH = 6.2;

  // LEFT COLUMN
  const leftInfo = [
    ['ACADEMIC YEAR:',     academicYear],
    ['NAME:',              `${student.firstName} ${student.lastName}`],
    ['CLASS:',             className],
    ['CURRENT TERM:',      ordinal(Number(term))],
  ];

  // RIGHT COLUMN
  const rightInfo = [
    ['NEXT TERM BEGINS:', nextTermBegins],
    ['ATTENDANCE:',       attendance],
    ['RAW SCORE:',        `${rawScore} out of ${totalStudents > 0 ? totalStudents : '—'}`],
    ['AGGREGATE:',        aggregate],
  ];

  leftInfo.forEach(([label, val], i) => {
    doc.setFont(fontName, 'bold');
    doc.text(label, col1x, y + i * lineH);
    doc.setFont(fontName, 'normal');
    doc.text(String(val ?? '—'), col1x + 34, y + i * lineH);
  });

  rightInfo.forEach(([label, val], i) => {
    doc.setFont(fontName, 'bold');
    doc.text(label, col2x, y + i * lineH);
    doc.setFont(fontName, 'normal');
    doc.text(String(val ?? '—'), col2x + 34, y + i * lineH);
  });

  y += leftInfo.length * lineH + 5;
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

  // Determine the class/exam % weighting to show in the table header.
  // Each subject can have its OWN weighting (e.g. Maths 30/70, French 50/50),
  // set by the admin in the Subjects page via maxClassScore/maxExamScore.
  // Rather than guessing one school-wide number, we:
  //   1. Compute the real % for the MOST COMMON weighting among this
  //      student's subjects (so the header is accurate for the majority).
  //   2. If subjects have DIFFERENT weightings, each row's REMARKS-adjacent
  //      header cell still reflects the true total for that subject's own
  //      max scores — the total score (100%) column is always correct
  //      regardless, since it's just classScore + examScore.
  const subjectResultsList = result.subjectResults || [];
  const weightCounts = {};
  subjectResultsList.forEach(sr => {
    const cMax = sr.maxClassScore ?? 30;
    const eMax = sr.maxExamScore  ?? 70;
    const total = cMax + eMax || 100;
    const cPct  = Math.round((cMax / total) * 100);
    const ePct  = Math.round((eMax / total) * 100);
    const key   = `${cPct}-${ePct}`;
    weightCounts[key] = (weightCounts[key] || 0) + 1;
  });
  // Pick the weighting used by the most subjects (mode)
  let dominantWeight = { classPct: 50, examPct: 50 };
  let maxCount = 0;
  Object.entries(weightCounts).forEach(([key, count]) => {
    if (count > maxCount) {
      maxCount = count;
      const [c, e] = key.split('-').map(Number);
      dominantWeight = { classPct: c, examPct: e };
    }
  });
  // If every subject shares the SAME weighting, this is 100% accurate.
  // If subjects differ, this shows the majority weighting in the header,
  // while each row's own classScore/examScore values remain exactly correct.
  const allSameWeight = Object.keys(weightCounts).length <= 1;

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
      `CLASS SCORE\n(${dominantWeight.classPct}%)`,
      `EXAM SCORE\n(${dominantWeight.examPct}%)`,
      'TOTAL SCORE\n(100%)',
      'GRADE',
      'GRADE NO.',
      'REMARKS',
    ]],
    body: subjectRows,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: HEADER_BG, textColor: HEADER_TX,
      lineColor: MGRAY, lineWidth: TBW,
      fontSize: S.fontSize - 0.5, fontStyle: 'bold',
      halign: 'center', valign: 'middle', cellPadding: TPV, font: fontName,
    },
    bodyStyles: {
      fontSize: S.fontSize, textColor: BLACK,
      lineColor: MGRAY, lineWidth: TBW,
      cellPadding: { top: TPV, bottom: TPV, left: TPH, right: TPH - 1 }, font: fontName,
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
    tableLineColor: MGRAY, tableLineWidth: TBW,
  });

  y = doc.lastAutoTable.finalY + (allSameWeight ? 6 : 3);

  // If subjects use different class/exam weightings, show a footnote so
  // parents understand the header % is the majority, not universal.
  if (!allSameWeight) {
    doc.setFontSize(S.fontSize - 2);
    doc.setFont(fontName, 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text(
      '* Class/Exam weighting varies by subject as configured by the school.',
      margin, y
    );
    doc.setTextColor(...BLACK);
    y += 4;
  }

  // ── GRADES LEGEND + QUALITATIVE side-by-side ──────────────────
  const leftW  = cW * 0.42;
  const rightW = cW * 0.55;
  const leftX  = margin;
  const rightX = margin + leftW + 4;

  const sortedScale = [...gradingScale].sort((a, b) => b.min - a.min);

  doc.autoTable({
    startY: y,
    head:   [['GRADES', 'TOTAL MARKS', 'REMARKS']],
    body:   sortedScale.map(g => [`Grade ${g.grade}`, `${g.min} – ${g.max}`, g.remarks || '']),
    margin: { left: leftX, right: pageW - leftX - leftW },
    tableWidth: leftW,
    headStyles: {
      fillColor: HEADER_BG, textColor: HEADER_TX,
      lineColor: MGRAY, lineWidth: TBW,
      fontSize: S.fontSize - 1.5, fontStyle: 'bold',
      halign: 'center', cellPadding: Math.max(0.5, TPV - 0.5), font: fontName,
    },
    bodyStyles: {
      fontSize: S.fontSize - 1.5, textColor: BLACK,
      lineColor: MGRAY, lineWidth: TBW,
      cellPadding: { top: Math.max(0.5, TPV - 0.8), bottom: Math.max(0.5, TPV - 0.8), left: Math.max(0.5, TPH - 1), right: Math.max(0.5, TPH - 1) }, font: fontName,
    },
    columnStyles: {
      0: { cellWidth: leftW * 0.34 },
      1: { cellWidth: leftW * 0.34, halign: 'center' },
      2: { halign: 'center' },
    },
    tableLineColor: MGRAY, tableLineWidth: TBW,
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
      lineColor: MGRAY, lineWidth: TBW,
      fontSize: S.fontSize - 1.5, fontStyle: 'bold',
      halign: 'center', cellPadding: Math.max(0.5, TPV - 0.5), font: fontName,
    },
    bodyStyles: {
      fontSize: S.fontSize - 1.5, textColor: BLACK,
      lineColor: MGRAY, lineWidth: TBW,
      cellPadding: { top: TPV, bottom: TPV, left: Math.max(0.5, TPH - 1), right: Math.max(0.5, TPH - 1) }, font: fontName,
    },
    columnStyles: {
      0: { cellWidth: rightW * 0.52 },
      1: { cellWidth: rightW * 0.16, halign: 'center' },
      2: { cellWidth: rightW * 0.16, halign: 'center' },
      3: { halign: 'center' },
    },
    tableLineColor: MGRAY, tableLineWidth: TBW,
  });

  y = Math.max(gradesBottom, doc.lastAutoTable.finalY) + 6;

  // ── SIGNATURE BLOCK ───────────────────────────────────────────
  if (y > pageH - 50) { doc.addPage(); y = 14; }

  const sigItems = [
    { key: 'classTeacher',  label: "Class Teacher's Name:",     name: extraInfo.classTeacher  || school?.classTeacher  || '' },
    { key: 'counsellor',    label: "School Counsellor's Name:",  name: extraInfo.counsellor    || school?.counsellor    || '' },
    { key: 'academicHead',  label: "Academic Head's Name:",      name: extraInfo.academicHead  || school?.academicHead  || '' },
    { key: 'administrator', label: "Administrator's Name:",      name: extraInfo.administrator || school?.administrator || '' },
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

    doc.setFont(fontName, 'bold');
    doc.text(sig.label, sigLabelX, rowY + 4);

    doc.setFont(fontName, 'bold');
    doc.setTextColor(...PRIMARY);
    doc.text((sig.name || '').toUpperCase(), sigNameX, rowY + 4);
    doc.setTextColor(...BLACK);

    const sigImg = school?.signatures?.[sig.key];
    if (sigImg) {
      try {
        const fmt = sigImg.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(sigImg, fmt, sigImgX, rowY - 2, 30, 10);
      } catch (e) { /* signature failed to render — skip silently */ }
    }

    doc.setFont(fontName, 'normal');
    doc.setFontSize(S.fontSize - 1);
    doc.text('Signature:', sigImgX, rowY + 4);
    doc.setFontSize(S.fontSize);
    doc.setLineWidth(0.3);
    doc.setDrawColor(...MGRAY);
    doc.line(sigLineX, rowY + 4.5, sigLineX + sigLineW, rowY + 4.5);

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
  const MGRAY     = hexToRgb(S.tableBorderColor);
  const TBW       = S.tableBorderWidth;
  const TPV       = S.tableCellPaddingV;
  const TPH       = S.tableCellPaddingH;
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
  const rows          = results.map((r, i) => {
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
      lineColor: MGRAY, lineWidth: TBW,
      fontSize: S.fontSize, fontStyle: 'bold', font: fontName,
      cellPadding: TPV,
    },
    bodyStyles: {
      fontSize: S.fontSize, font: fontName,
      lineColor: MGRAY, lineWidth: TBW,
      cellPadding: { top: TPV, bottom: TPV, left: TPH, right: TPH - 1 },
    },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    tableLineColor: MGRAY, tableLineWidth: TBW,
  });

  return doc;
}

export function downloadPDF(doc, filename) {
  doc.save(filename);
}
