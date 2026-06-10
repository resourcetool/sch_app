// src/services/reportService.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export async function generateStudentReportPDF(student, enrollment, result, classInfo, school, term, academicYear) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // ── HEADER ──────────────────────────────────────────────────────
  doc.setFillColor(15, 52, 96);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(school?.name || 'School Name', pageW / 2, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(school?.address || '', pageW / 2, 18, { align: 'center' });
  doc.text(`Tel: ${school?.phone || ''} | Email: ${school?.email || ''}`, pageW / 2, 23, { align: 'center' });

  y = 35;
  doc.setTextColor(15, 52, 96);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT ACADEMIC REPORT', pageW / 2, y, { align: 'center' });

  y += 4;
  doc.setLineWidth(0.5);
  doc.setDrawColor(15, 52, 96);
  doc.line(margin, y, pageW - margin, y);

  // ── STUDENT INFO ─────────────────────────────────────────────────
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);

  const infoLeft = [
    ['Student Name:', `${student.firstName} ${student.lastName}`],
    ['Student ID:', student.studentCode],
    ['Date of Birth:', student.dateOfBirth],
    ['Gender:', student.gender]
  ];
  const infoRight = [
    ['Class:', classInfo?.name || ''],
    ['Academic Year:', academicYear],
    ['Term:', term],
    ['Position:', `${result.position} of ${result.totalStudents || '-'}`]
  ];

  infoLeft.forEach(([label, val], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y + i * 6);
    doc.setFont('helvetica', 'normal');
    doc.text(val, margin + 30, y + i * 6);
  });
  infoRight.forEach(([label, val], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, pageW / 2 + 5, y + i * 6);
    doc.setFont('helvetica', 'normal');
    doc.text(String(val), pageW / 2 + 35, y + i * 6);
  });

  y += infoLeft.length * 6 + 5;
  doc.line(margin, y, pageW - margin, y);

  // ── SUBJECT TABLE ─────────────────────────────────────────────────
  y += 5;
  const tableHeaders = [['#', 'Subject', 'Class Score', 'Exam Score', 'Total', 'Grade', 'Remarks']];
  const tableRows = result.subjectResults.map((sr, i) => [
    i + 1,
    sr.subjectName,
    sr.classScore,
    sr.examScore,
    sr.total,
    sr.grade,
    sr.remarks
  ]);

  doc.autoTable({
    startY: y,
    head: tableHeaders,
    body: tableRows,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [15, 52, 96], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' }
    }
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── SUMMARY ───────────────────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(margin, y, pageW - margin * 2, 18, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 52, 96);

  const summaryItems = [
    ['Total Score:', result.totalScore],
    ['Average:', `${result.average}%`],
    ['Position:', `${result.position}`]
  ];
  const colW = (pageW - margin * 2) / summaryItems.length;
  summaryItems.forEach(([label, val], i) => {
    const x = margin + i * colW + colW / 2;
    doc.text(label, x, y + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.text(String(val), x, y + 13, { align: 'center' });
    doc.setFontSize(9);
  });

  y += 25;

  // ── TEACHER REMARK ────────────────────────────────────────────────
  if (y + 30 > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = margin;
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageW - margin * 2, 22);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text("Class Teacher's Remarks:", margin + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(result.teacherRemark || '_______________________________________________', margin + 3, y + 14);

  y += 28;

  // ── SIGNATURES ────────────────────────────────────────────────────
  const sigY = y + 5;
  doc.setFontSize(8);
  doc.text('Class Teacher', margin + 15, sigY + 12, { align: 'center' });
  doc.line(margin, sigY + 10, margin + 50, sigY + 10);

  doc.text("Headmaster's Signature", pageW / 2, sigY + 12, { align: 'center' });
  doc.line(pageW / 2 - 25, sigY + 10, pageW / 2 + 25, sigY + 10);

  doc.text("Parent's Signature", pageW - margin - 20, sigY + 12, { align: 'center' });
  doc.line(pageW - margin - 50, sigY + 10, pageW - margin, sigY + 10);

  // ── FOOTER ────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated: ${new Date().toLocaleString()} | ${school?.name || ''}`,
    pageW / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: 'center' }
  );

  return doc;
}

export function downloadPDF(doc, filename) {
  doc.save(filename);
}

export async function generateClassReportPDF(classInfo, results, students, school, academicYear, term) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;

  // Header
  doc.setFillColor(15, 52, 96);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${school?.name || ''} — Class Result Sheet`, pageW / 2, 10, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Class: ${classInfo?.name || ''} | ${academicYear} | Term ${term}`, pageW / 2, 17, { align: 'center' });

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

  const subjectNames = results[0]?.subjectResults?.map(sr => sr.subjectName) || [];
  const headers = [['#', 'Student ID', 'Student Name', ...subjectNames, 'Total', 'Average', 'Position']];
  
  const rows = results.map((r, i) => {
    const student = studentMap[r.studentId];
    return [
      i + 1,
      student?.studentCode || '',
      student ? `${student.firstName} ${student.lastName}` : 'Unknown',
      ...r.subjectResults.map(sr => `${sr.total}\n(${sr.grade})`),
      r.totalScore,
      r.average,
      r.position
    ];
  });

  doc.autoTable({
    startY: 26,
    head: headers,
    body: rows,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [15, 52, 96], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: [245, 248, 255] }
  });

  return doc;
}
