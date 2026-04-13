import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { Bill } from '../models/billing.model';

export const generateBillPDF = (bill: Bill, res: Response): void => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=swara-aqua-bill-${bill.month}-${bill.customer_id}.pdf`
  );
  doc.pipe(res);

  // ── Header ────────────────────────────────────────────────────────────────
  doc.fontSize(22).font('Helvetica-Bold').text('Swara Aqua', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#64748B')
     .text('Pure Water Delivery Service', 50, 78);

  doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#E2E8F0').stroke();

  // ── Bill info ─────────────────────────────────────────────────────────────
  doc.fillColor('#0F172A').fontSize(16).font('Helvetica-Bold')
     .text('INVOICE', 50, 115);
  doc.fontSize(10).font('Helvetica').fillColor('#64748B')
     .text(`Bill Month: ${bill.month}`, 50, 138)
     .text(`Due Date: ${bill.due_date}`, 50, 153)
     .text(`Bill #: ${bill.id}`, 50, 168);

  // Status badge
  const statusColor = bill.status === 'paid' ? '#22C55E' : bill.status === 'partial' ? '#F59E0B' : '#EF4444';
  doc.roundedRect(430, 115, 115, 28, 6).fill(statusColor);
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
     .text(bill.status.toUpperCase(), 430, 123, { width: 115, align: 'center' });

  // ── Customer details ──────────────────────────────────────────────────────
  doc.moveTo(50, 200).lineTo(545, 200).strokeColor('#E2E8F0').stroke();
  doc.fillColor('#64748B').fontSize(9).font('Helvetica-Bold')
     .text('BILL TO', 50, 210);
  doc.fillColor('#0F172A').fontSize(13).font('Helvetica-Bold')
     .text(bill.customer_name || 'Customer', 50, 224);
  doc.fontSize(10).font('Helvetica').fillColor('#64748B')
     .text(`Phone: ${bill.customer_phone || '—'}`, 50, 242);

  // ── Table ─────────────────────────────────────────────────────────────────
  const tableTop = 280;
  doc.rect(50, tableTop, 495, 28).fill('#F1F5F9');
  doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
     .text('DESCRIPTION',  60, tableTop + 9)
     .text('QTY',         280, tableTop + 9)
     .text('RATE',        360, tableTop + 9)
     .text('AMOUNT',      460, tableTop + 9);

  doc.moveTo(50, tableTop + 28).lineTo(545, tableTop + 28).strokeColor('#E2E8F0').stroke();

  // Row
  const rowY = tableTop + 38;
  doc.fillColor('#0F172A').fontSize(10).font('Helvetica')
     .text('Water Jar Delivery',       60, rowY)
     .text(String(bill.total_jars),   280, rowY)
     .text(`₹${bill.jar_rate}`,       360, rowY)
     .text(`₹${bill.subtotal}`,       460, rowY);

  doc.moveTo(50, rowY + 22).lineTo(545, rowY + 22).strokeColor('#E2E8F0').stroke();

  // ── Totals ────────────────────────────────────────────────────────────────
  const totY = rowY + 35;
  const addRow = (label: string, value: string, y: number, bold = false) => {
    doc.fillColor(bold ? '#0F172A' : '#64748B')
       .fontSize(bold ? 11 : 10)
       .font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(label, 350, y)
       .text(value, 460, y);
  };

  addRow('Subtotal',          `₹${bill.subtotal}`,          totY);
  addRow('Previous Pending',  `₹${bill.previous_pending}`,  totY + 18);
  addRow('Advance Used',      `-₹${bill.advance_used}`,     totY + 36);
  addRow('Amount Paid',       `-₹${bill.paid_amount}`,      totY + 54);

  doc.moveTo(350, totY + 72).lineTo(545, totY + 72).strokeColor('#CBD5E1').stroke();
  addRow('TOTAL DUE',
    `₹${Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount)).toFixed(2)}`,
    totY + 80, true
  );

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.moveTo(50, 720).lineTo(545, 720).strokeColor('#E2E8F0').stroke();
  doc.fillColor('#94A3B8').fontSize(9).font('Helvetica')
     .text('Thank you for choosing Swara Aqua. For queries contact us.', 50, 730, {
       align: 'center', width: 495,
     });

  doc.end();
};
