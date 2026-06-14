// src/services/reportService.js
//
// Changes:
// - generateStudentReportPDF() completely rewritten to match the school report card
//   format shown in the reference image:
//     · School name, logo (if saved), "END OF [TERM] TERM REPORT", school type
//     · Header info grid: Academic Year, Current Term, Next Term Begins, MEC, Name,
//       No. on Roll, Attendance, Out Of, No. of Ones, Raw Score, Out of 1000, Aggregate
//     · QUANTITATIVE ASSESSMENT table: Subject | Class Score (50%) | Exam Score (50%)
//       | Total Score (100%) | Grade | Grade No. | Remarks
//     · GRADES legend table (pulled from school's custom grading scale)
//     · QUALITATIVE ASSESSMENT conduct checklist
//     · Class Teacher / School Counsellor / Academic Head / Administrator signature block
// - School logo is loaded from school.logoBase64 (set via Settings page).
// - Grading scale is pulled from school.gradingScale (falls back to default).
// - Grade number (grade no.) is the position of the grade in the grading scale.
// - downloadPDF and generateClassReportPDF preserved (class sheet unchanged).

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { defaultGradingScale, applyGradingScale } from './scoreService';

// ── HELPERS ───────────────────────────────────────────────────────

function termLabel(term) {
  const map = { '1': 'FIRST', '2': 'SECOND', '3': 'THIRD' };
  return map[String(term)] || `TERM ${term}`;
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

/**
 * Adds a school logo image to the PDF at the given x,y position.
 * logoBase64 must be a data-URL string (e.g. "data:image/png;base64,...").
 * Returns silently if no logo or if loading fails.
 */
function addLogo(doc, logoBase64, x, y, size) {
  if (!logoBase64) return;
  try {
    // jsPDF accepts data URLs directly
    const fmt = logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(logoBase64, fmt, x, y, size, size);
  } catch (e) {
    // If logo fails to render, skip silently — never break the report
    console.warn('Logo render failed:', e.message);
  }
}

/**
 * Resolve grade number (position in the grading scale, 1-based, sorted by min desc).
 * In the reference image grade A+ = 1, A = 2 … F = 9.
 */
function gradeNo(grade, gradingScale) {
  const sorted = [...gradingScale].sort((a, b) => b.min - a.min);
  const idx    = sorted.findIndex(g => g.grade === grade);
  return idx >= 0 ? idx + 1 : '—';
}

// ── STUDENT REPORT CARD ───────────────────────────────────────────

export async function generateStudentReportPDF(
  student, enrollment, result, classInfo, school, term, academicYear, extraInfo = {}
) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 12;
  const cW     = pageW - margin * 2;                // content width

  const gradingScale = school?.gradingScale?.length
    ? school.gradingScale
    : defaultGradingScale();

  const NAVY  = [15, 52, 96];
  const BLACK = [20, 20, 20];
  const LGRAY = [230, 230, 230];
  const MGRAY = [180, 180, 180];
  const WHITE = [255, 255, 255];

  // ── OUTER BORDER ────────────────────────────────────────────────
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, pageW - 16, pageH - 16);

  // ── SCHOOL HEADER ────────────────────────────────────────────────
  const logoSize = 22;
  const logoY    = 13;

  // Left logo
  addLogo(doc, school?.logoBase64, margin, logoY, logoSize);
  // Right logo
  addLogo(doc, school?.logoBase64, pageW - margin - logoSize, logoY, logoSize);

  // School name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  const schoolName = (school?.name || 'SCHOOL NAME').toUpperCase();
  doc.text(schoolName, pageW / 2, 18, { align: 'center' });

  // Report title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`END OF ${termLabel(term)} TERM REPORT`, pageW / 2, 24, { align: 'center' });

  // School type / level
  const schoolType = school?.schoolType || school?.level || '';
  if (schoolType) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`(${schoolType.toUpperCase()})`, pageW / 2, 29, { align: 'center' });
  }

  // Divider
  let y = 33;
  doc.setLineWidth(0.4);
  doc.setDrawColor(...NAVY);
  doc.line(margin, y, pageW - margin, y);

  // ── INFO GRID (two columns, matching reference image) ─────────────
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);

  const nextTermBegins = extraInfo.nextTermBegins || school?.nextTermBegins || '';
  const mec            = extraInfo.mec            || classInfo?.mec         || '';
  const noOnRoll       = extraInfo.noOnRoll        || result.totalStudents   || '';
  const attendance     = extraInfo.attendance      || student.attendance     || '';
  const noOfOnes       = extraInfo.noOfOnes        || result.noOfOnes        || 0;
  const rawScore       = result.totalScore || 0;
  const outOf          = result.subjectResults?.length
    ? result.subjectResults.reduce((s, sr) => s + ((school?.maxTotalPerSubject) || 100), 0)
    : 0;
  const aggregate      = result.aggregate || result.position || '';

  // Left column: Academic Year, Name, No. on Roll, No. of Ones
  // Right column: Current Term, Next Term Begins, MEC, Attendance, Raw Score, Out Of, Out of 1000, Aggregate
  const leftInfo = [
    ['ACADEMIC YEAR:', academicYear],
    ['NAME:', `${student.firstName} ${student.lastName}`],
    ['NO. ON ROLL:', noOnRoll],
    ['NO. OF ONES:', noOfOnes],
  ];
  const rightInfo = [
    ['CURRENT TERM', `${ordinal(Number(term))}`],
    ['NEXT TERM BEGINS:', nextTermBegins],
    ['MEC:', mec],
    ['ATTENDANCE:', attendance],
  ];
  const rightInfo2 = [
    ['RAW SCORE:', rawScore],
    ['OUT OF:', outOf || '—'],
    ['OUT OF 1000', ''],
    ['AGGREGATE:', aggregate],
  ];

  const col1x = margin;
  const col2x = pageW / 2 + 2;
  const lineH  = 5.5;

  // Draw left info
  leftInfo.forEach(([label, val], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, col1x, y + i * lineH);
    doc.setFont('helvetica', 'normal');
    doc.text(String(val ?? ''), col1x + 32, y + i * lineH);
  });

  // Draw right info (top half)
  rightInfo.forEach(([label, val], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, col2x, y + i * lineH);
    doc.setFont('helvetica', 'normal');
    doc.text(String(val ?? ''), col2x + 30, y + i * lineH);
  });

  y += leftInfo.length * lineH + 1;

  // Second right-column block on same vertical band as empty left rows
  rightInfo2.forEach(([label, val], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, col2x, y + i * lineH);
    doc.setFont('helvetica', 'normal');
    doc.text(String(val ?? ''), col2x + 30, y + i * lineH);
  });

  y += 4;
  doc.setLineWidth(0.3);
  doc.setDrawColor(...LGRAY);
  doc.line(margin, y, pageW - margin, y);

  // ── QUANTITATIVE ASSESSMENT ────────────────────────────────────
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('QUANTITATIVE ASSESSMENT', pageW / 2, y, { align: 'center' });
  y += 3;

  const subjectRows = (result.subjectResults || []).map((sr) => {
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
      `CLASS\nSCORE (${school?.classScorePercent || 50}%)`,
      `EXAM SCORE\n(${school?.examScorePercent || 50}%)`,
      'TOTAL SCORE\n(100%)',
      'GRADE',
      'GRADE NO.',
      'REMARKS',
    ]],
    body: subjectRows,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: WHITE,
      textColor: BLACK,
      lineColor: MGRAY,
      lineWidth: 0.2,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: BLACK,
      lineColor: LGRAY,
      lineWidth: 0.2,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 2 },
    },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: 42 },                              // Subject
      1: { halign: 'center', cellWidth: 22 },            // Class Score
      2: { halign: 'center', cellWidth: 22 },            // Exam Score
      3: { halign: 'center', cellWidth: 22, fontStyle: 'bold' }, // Total
      4: { halign: 'center', cellWidth: 16, fontStyle: 'bold' }, // Grade
      5: { halign: 'center', cellWidth: 18 },            // Grade No.
      6: { halign: 'center' },                           // Remarks
    },
    tableLineColor: MGRAY,
    tableLineWidth: 0.2,
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── GRADES LEGEND + QUALITATIVE side by side ───────────────────
  // Left: GRADES table  |  Right: QUALITATIVE ASSESSMENT

  // Sort scale best-to-worst for the legend
  const sortedScale = [...gradingScale].sort((a, b) => b.min - a.min);

  // ── GRADES TABLE (left half) ────────────────────────────────────
  const leftW  = cW * 0.42;
  const rightW = cW * 0.55;
  const leftX  = margin;
  const rightX = margin + leftW + 4;

  doc.autoTable({
    startY: y,
    head: [['GRADES', 'TOTAL MARKS', 'REMARKS']],
    body: sortedScale.map((g, i) => [
      `Grade ${g.grade}`,
      `${i === 0 ? g.min : g.min} – ${g.max}`,
      g.remarks || '',
    ]),
    margin: { left: leftX, right: pageW - leftX - leftW },
    tableWidth: leftW,
    headStyles: {
      fillColor: WHITE, textColor: BLACK,
      lineColor: MGRAY, lineWidth: 0.2,
      fontSize: 6.5, fontStyle: 'bold',
      halign: 'center', cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 6.5, textColor: BLACK,
      lineColor: LGRAY, lineWidth: 0.15,
      cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: leftW * 0.34 },
      1: { cellWidth: leftW * 0.34, halign: 'center' },
      2: { halign: 'center' },
    },
    tableLineColor: MGRAY,
    tableLineWidth: 0.2,
  });

  const gradesBottom = doc.lastAutoTable.finalY;

  // ── QUALITATIVE ASSESSMENT TABLE (right half) ────────────────────
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

  // Save y position — autotable with specific startX isn't natively supported,
  // so we use margin + tableWidth trick
  doc.autoTable({
    startY: y,
    head: [['CONDUCT', 'EXCELLENT', 'SATISFACTORY', 'POOR']],
    body: conductItems.map(c => [c, '', '', '']),
    margin: { left: rightX, right: margin },
    tableWidth: rightW,
    headStyles: {
      fillColor: WHITE, textColor: BLACK,
      lineColor: MGRAY, lineWidth: 0.2,
      fontSize: 6.5, fontStyle: 'bold',
      halign: 'center', cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 6.5, textColor: BLACK,
      lineColor: LGRAY, lineWidth: 0.15,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: rightW * 0.52 },
      1: { cellWidth: rightW * 0.16, halign: 'center' },
      2: { cellWidth: rightW * 0.16, halign: 'center' },
      3: { halign: 'center' },
    },
    tableLineColor: MGRAY,
    tableLineWidth: 0.2,
    didDrawPage: () => {},
  });

  y = Math.max(gradesBottom, doc.lastAutoTable.finalY) + 6;

  // ── SIGNATURE BLOCK ────────────────────────────────────────────
  if (y > pageH - 40) { doc.addPage(); y = 14; }

  const sigItems = [
    ['Class Teacher\'s Name:',   extraInfo.classTeacher   || school?.classTeacher   || ''],
    ['School Counsellor\'s Name:', extraInfo.counsellor   || school?.counsellor     || ''],
    ['Academic Head\'s Name:',   extraInfo.academicHead   || school?.academicHead   || ''],
    ['Administrator\'s Name:',   extraInfo.administrator  || school?.administrator  || ''],
  ];

  const sigLabelX = margin;
  const sigNameX  = margin + 42;
  const sigLineX  = pageW / 2 + 4;
  const sigLineW  = pageW - margin - sigLineX;
  const sigLineH  = 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...BLACK);

  sigItems.forEach(([label, name], i) => {
    const row = y + i * (sigLineH + 2.5);
    doc.setFont('helvetica', 'bold');
    doc.text(label, sigLabelX, row);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text((name || '').toUpperCase(), sigNameX, row);
    doc.setTextColor(...BLACK);

    // Signature label + line on right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Signature:', sigLineX, row);
    doc.setLineWidth(0.3);
    doc.setDrawColor(...MGRAY);
    doc.line(sigLineX + 18, row + 0.5, sigLineX + sigLineW, row + 0.5);
    doc.setFontSize(7.5);
  });

  y += sigItems.length * (sigLineH + 2.5) + 4;

  // ── FOOTER ────────────────────────────────────────────────────
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated: ${new Date().toLocaleString()} | ${school?.name || ''}`,
    pageW / 2,
    pageH - 10,
    { align: 'center' }
  );
  // Bottom border line
  doc.setLineWidth(0.8);
  doc.setDrawColor(...NAVY);
  doc.line(8, pageH - 8, pageW - 8, pageH - 8);

  return doc;
}

// ── CLASS RESULT SHEET ────────────────────────────────────────────
// (unchanged from original)
export async function generateClassReportPDF(classInfo, results, students, school, academicYear, term) {
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;

  doc.setFillColor(15, 52, 96);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${school?.name || ''} — Class Result Sheet`, pageW / 2, 10, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Class: ${classInfo?.name || ''} | ${academicYear} | Term ${term}`, pageW / 2, 17, { align: 'center' });

  const studentMap  = Object.fromEntries(students.map(s => [s.id, s]));
  const subjectNames = results[0]?.subjectResults?.map(sr => sr.subjectName) || [];
  const headers      = [['#', 'Student ID', 'Student Name', ...subjectNames, 'Total', 'Average', 'Position']];
  const rows         = results.map((r, i) => {
    const student = studentMap[r.studentId];
    return [
      i + 1,
      student?.studentCode || '',
      student ? `${student.firstName} ${student.lastName}` : 'Unknown',
      ...r.subjectResults.map(sr => `${sr.total}\n(${sr.grade})`),
      r.totalScore,
      r.average,
      r.position,
    ];
  });

  doc.autoTable({
    startY: 26,
    head: headers,
    body: rows,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [15, 52, 96], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: [245, 248, 255] },
  });

  return doc;
}

export function downloadPDF(doc, filename) {
  doc.save(filename);
}
