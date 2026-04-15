import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { Bill } from '../models/billing.model';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number | string) => `Rs. ${Number(n).toFixed(2)}`;
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[Number(mo) - 1]} ${y}`;
};

// Colors
const C = {
  brand:    '#0ea5e9',
  dark:     '#0f172a',
  mid:      '#475569',
  light:    '#94a3b8',
  border:   '#e2e8f0',
  bg:       '#f8fafc',
  white:    '#ffffff',
  green:    '#16a34a',
  amber:    '#d97706',
  red:      '#dc2626',
};

export const generateBillPDF = (bill: Bill, res: Response): void => {
  const doc = new PDFDocument({ margin: 0, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename=SwaraAqua-Bill-${bill.month}-${bill.id}.pdf`
  );
  doc.pipe(res);

  const W = 595; // A4 width in points
  const M = 40;  // margin

  // ── Top brand bar ─────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 80).fill(C.brand);

  // Company name
  doc.fillColor(C.white).fontSize(24).font('Helvetica-Bold')
     .text('Swara Aqua', M, 22);
  doc.fillColor('rgba(255,255,255,0.8)').fontSize(10).font('Helvetica')
     .text('Pure Water Delivery Service', M, 50);

  // Invoice label on right
  doc.fillColor(C.white).fontSize(28).font('Helvetica-Bold')
     .text('INVOICE', 0, 25, { align: 'right', width: W - M });

  // ── Invoice meta strip ────────────────────────────────────────────────────
  doc.rect(0, 80, W, 50).fill(C.dark);

  const metaItems = [
    { label: 'Invoice No.',  value: `#${String(bill.id).padStart(4, '0')}` },
    { label: 'Bill Month',   value: monthLabel(bill.month) },
    { label: 'Due Date',     value: bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
    { label: 'Generated',    value: new Date(bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
  ];

  const colW = (W - M * 2) / metaItems.length;
  metaItems.forEach((item, i) => {
    const x = M + i * colW;
    doc.fillColor(C.light).fontSize(8).font('Helvetica')
       .text(item.label.toUpperCase(), x, 90, { width: colW });
    doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold')
       .text(item.value, x, 103, { width: colW });
  });

  // ── Bill To + Status ──────────────────────────────────────────────────────
  const secY = 150;
  doc.rect(M, secY, 240, 90).roundedRect(M, secY, 240, 90, 6).fill(C.bg);

  doc.fillColor(C.brand).fontSize(8).font('Helvetica-Bold')
     .text('BILL TO', M + 14, secY + 12);
  doc.fillColor(C.dark).fontSize(14).font('Helvetica-Bold')
     .text(bill.customer_name || 'Customer', M + 14, secY + 26);
  doc.fillColor(C.mid).fontSize(10).font('Helvetica')
     .text(`Phone: ${bill.customer_phone || '—'}`, M + 14, secY + 46)
     .text(`Customer ID: #${bill.customer_id}`, M + 14, secY + 62);

  // Status badge
  const statusColor = bill.status === 'paid' ? C.green : bill.status === 'partial' ? C.amber : C.red;
  const statusLabel = bill.status === 'paid' ? '✓  PAID' : bill.status === 'partial' ? '◑  PARTIAL' : '✗  UNPAID';
  doc.roundedRect(W - M - 130, secY, 130, 90, 6).fill(statusColor);
  doc.fillColor(C.white).fontSize(16).font('Helvetica-Bold')
     .text(statusLabel, W - M - 130, secY + 32, { width: 130, align: 'center' });

  // ── Items table ───────────────────────────────────────────────────────────
  const tY = secY + 110;

  // Table header
  doc.rect(M, tY, W - M * 2, 30).fill(C.dark);
  doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold');
  doc.text('DESCRIPTION',        M + 14,  tY + 10);
  doc.text('QTY',                310,     tY + 10, { width: 60, align: 'right' });
  doc.text('RATE',               380,     tY + 10, { width: 70, align: 'right' });
  doc.text('AMOUNT',             460,     tY + 10, { width: W - M - 460, align: 'right' });

  // Table row
  const rY = tY + 30;
  doc.rect(M, rY, W - M * 2, 36).fill(C.bg);
  doc.fillColor(C.dark).fontSize(11).font('Helvetica')
     .text('Water Jar Delivery', M + 14, rY + 12);
  doc.text(String(bill.total_jars),    310, rY + 12, { width: 60, align: 'right' });
  doc.text(fmt(bill.jar_rate),         380, rY + 12, { width: 70, align: 'right' });
  doc.text(fmt(bill.subtotal),         460, rY + 12, { width: W - M - 460, align: 'right' });

  // Table bottom border
  doc.moveTo(M, rY + 36).lineTo(W - M, rY + 36).strokeColor(C.border).lineWidth(1).stroke();

  // ── Summary box ───────────────────────────────────────────────────────────
  const sumX = W - M - 220;
  const sumY = rY + 50;
  const sumW = 220;

  const rows: { label: string; value: string; bold?: boolean; color?: string }[] = [
    { label: 'Subtotal',         value: fmt(bill.subtotal) },
    { label: 'Previous Pending', value: fmt(bill.previous_pending) },
    { label: 'Advance Used',     value: `- ${fmt(bill.advance_used)}`, color: C.green },
    { label: 'Amount Paid',      value: `- ${fmt(bill.paid_amount)}`,  color: C.green },
  ];

  let rowCursor = sumY;
  rows.forEach(row => {
    doc.fillColor(C.mid).fontSize(10).font('Helvetica')
       .text(row.label, sumX, rowCursor, { width: sumW * 0.55 });
    doc.fillColor(row.color || C.dark).fontSize(10).font('Helvetica')
       .text(row.value, sumX, rowCursor, { width: sumW, align: 'right' });
    rowCursor += 20;
  });

  // Divider
  doc.moveTo(sumX, rowCursor + 4).lineTo(W - M, rowCursor + 4)
     .strokeColor(C.border).lineWidth(1).stroke();
  rowCursor += 12;

  // Total due — highlighted
  const due = Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount));
  doc.rect(sumX - 10, rowCursor - 4, sumW + 10, 34).roundedRect(sumX - 10, rowCursor - 4, sumW + 10, 34, 4).fill(C.brand);
  doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold')
     .text('TOTAL DUE', sumX, rowCursor + 8, { width: sumW * 0.55 });
  doc.fillColor(C.white).fontSize(14).font('Helvetica-Bold')
     .text(fmt(due), sumX, rowCursor + 6, { width: sumW, align: 'right' });

  // ── Payment note (if paid) ────────────────────────────────────────────────
  if (bill.status === 'paid') {
    const noteY = rowCursor + 55;
    doc.rect(M, noteY, W - M * 2, 36).roundedRect(M, noteY, W - M * 2, 36, 6).fill('#dcfce7');
    doc.fillColor(C.green).fontSize(12).font('Helvetica-Bold')
       .text('✓  This bill has been fully paid. Thank you!', M, noteY + 12, {
         align: 'center', width: W - M * 2,
       });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.rect(0, 780, W, 62).fill(C.dark);
  doc.fillColor(C.light).fontSize(9).font('Helvetica')
     .text('Swara Aqua  |  Pure Water Delivery Service', 0, 793, { align: 'center', width: W });
  doc.fillColor(C.mid).fontSize(8)
     .text('Thank you for your business. For queries, please contact us.', 0, 810, { align: 'center', width: W });
  doc.fillColor(C.light).fontSize(8)
     .text(`Generated on ${new Date().toLocaleString('en-IN')}`, 0, 825, { align: 'center', width: W });

  doc.end();
};
