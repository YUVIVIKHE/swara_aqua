import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { Bill } from '../models/billing.model';

const fmt  = (n: number | string) => `Rs.${Number(n).toFixed(2)}`;
const fmtN = (n: number | string) => Number(n).toFixed(2);

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-');
  const names = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];
  return `${names[Number(mo) - 1]} ${y}`;
};

const C = {
  brand:  '#0ea5e9',
  dark:   '#0f172a',
  mid:    '#475569',
  light:  '#94a3b8',
  border: '#e2e8f0',
  bg:     '#f8fafc',
  white:  '#ffffff',
  green:  '#16a34a',
  amber:  '#d97706',
  red:    '#dc2626',
  bgGreen:'#dcfce7',
};

export const generateBillPDF = (bill: Bill, res: Response): void => {
  const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `inline; filename=SwaraAqua-Bill-${bill.month}-${bill.id}.pdf`);
  doc.pipe(res);

  const W = 595;
  const M = 40;

  // ── Brand header ──────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 75).fill(C.brand);
  doc.fillColor(C.white).fontSize(26).font('Helvetica-Bold').text('Swara Aqua', M, 18);
  doc.fillColor('rgba(255,255,255,0.75)').fontSize(10).font('Helvetica')
     .text('Pure Water Delivery Service', M, 48);
  doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold')
     .text('TAX INVOICE', W - M - 90, 30, { width: 90, align: 'right' });

  // ── Meta strip ────────────────────────────────────────────────────────────
  doc.rect(0, 75, W, 48).fill(C.dark);
  const meta = [
    { l: 'Invoice No.',  v: `#${String(bill.id).padStart(5, '0')}` },
    { l: 'Bill Period',  v: monthLabel(bill.month) },
    { l: 'Due Date',     v: bill.due_date
        ? new Date(bill.due_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
        : '—' },
    { l: 'Generated',    v: new Date(bill.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) },
  ];
  const cw = (W - M * 2) / meta.length;
  meta.forEach(({ l, v }, i) => {
    const x = M + i * cw;
    doc.fillColor(C.light).fontSize(7.5).font('Helvetica').text(l.toUpperCase(), x, 84, { width: cw });
    doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold').text(v, x, 96, { width: cw });
  });

  // ── Bill To + Status ──────────────────────────────────────────────────────
  const secY = 140;
  doc.rect(M, secY, 240, 85).fill(C.bg);
  doc.fillColor(C.brand).fontSize(7.5).font('Helvetica-Bold').text('BILL TO', M + 12, secY + 10);
  doc.fillColor(C.dark).fontSize(13).font('Helvetica-Bold')
     .text(bill.customer_name || 'Customer', M + 12, secY + 22, { width: 216 });
  doc.fillColor(C.mid).fontSize(9.5).font('Helvetica')
     .text(`Phone: ${bill.customer_phone || '—'}`, M + 12, secY + 42)
     .text(`Customer ID: #${bill.customer_id}`, M + 12, secY + 57);

  // Status badge
  const sColor = bill.status === 'paid' ? C.green : bill.status === 'partial' ? C.amber : C.red;
  const sLabel = bill.status === 'paid' ? 'PAID' : bill.status === 'partial' ? 'PARTIAL' : 'UNPAID';
  doc.rect(W - M - 120, secY, 120, 85).fill(sColor);
  doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold')
     .text(sLabel, W - M - 120, secY + 30, { width: 120, align: 'center' });

  // ── Items table ───────────────────────────────────────────────────────────
  const tY = secY + 100;
  doc.rect(M, tY, W - M * 2, 28).fill(C.dark);
  doc.fillColor(C.white).fontSize(8.5).font('Helvetica-Bold')
     .text('DESCRIPTION',  M + 12, tY + 9)
     .text('QTY',          310,    tY + 9, { width: 55, align: 'right' })
     .text('RATE',         375,    tY + 9, { width: 65, align: 'right' })
     .text('AMOUNT',       450,    tY + 9, { width: W - M - 450, align: 'right' });

  const rY = tY + 28;
  doc.rect(M, rY, W - M * 2, 34).fill(C.bg);
  doc.fillColor(C.dark).fontSize(10.5).font('Helvetica')
     .text('Water Jar Delivery', M + 12, rY + 11)
     .text(String(bill.total_jars),  310, rY + 11, { width: 55, align: 'right' })
     .text(fmt(bill.jar_rate),       375, rY + 11, { width: 65, align: 'right' })
     .text(fmt(bill.subtotal),       450, rY + 11, { width: W - M - 450, align: 'right' });

  doc.moveTo(M, rY + 34).lineTo(W - M, rY + 34).strokeColor(C.border).lineWidth(0.5).stroke();

  // ── Summary ───────────────────────────────────────────────────────────────
  const sumX = W - M - 210;
  let sy = rY + 48;

  const summaryRows = [
    { label: 'Subtotal',          value: fmt(bill.subtotal),          color: C.dark },
    { label: 'Previous Pending',  value: `+ ${fmt(bill.previous_pending)}`, color: Number(bill.previous_pending) > 0 ? C.red : C.mid },
    { label: 'Advance Used',      value: `- ${fmt(bill.advance_used)}`,     color: C.green },
    { label: 'Amount Paid',       value: `- ${fmt(bill.paid_amount)}`,       color: C.green },
  ];

  summaryRows.forEach(({ label, value, color }) => {
    doc.fillColor(C.mid).fontSize(9.5).font('Helvetica').text(label, sumX, sy, { width: 120 });
    doc.fillColor(color).fontSize(9.5).font('Helvetica').text(value, sumX, sy, { width: 210, align: 'right' });
    sy += 18;
  });

  doc.moveTo(sumX, sy + 3).lineTo(W - M, sy + 3).strokeColor(C.border).lineWidth(0.5).stroke();
  sy += 10;

  // Total due box
  const due = Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount));
  doc.rect(sumX - 8, sy - 4, 218, 32).fill(C.brand);
  doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold')
     .text('TOTAL DUE', sumX, sy + 7, { width: 100 });
  doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold')
     .text(`Rs.${fmtN(due)}`, sumX, sy + 5, { width: 210, align: 'right' });

  // ── Paid stamp ────────────────────────────────────────────────────────────
  if (bill.status === 'paid') {
    const noteY = sy + 50;
    doc.rect(M, noteY, W - M * 2, 34).fill(C.bgGreen);
    doc.fillColor(C.green).fontSize(11).font('Helvetica-Bold')
       .text('✓  This bill has been fully paid. Thank you!', M, noteY + 11,
         { align: 'center', width: W - M * 2 });
  }

  // ── Payment history note ──────────────────────────────────────────────────
  const noteY2 = sy + (bill.status === 'paid' ? 100 : 50);
  doc.fillColor(C.light).fontSize(8).font('Helvetica')
     .text(`Jar Rate: Rs.${fmtN(bill.jar_rate)}/jar  |  Total Jars: ${bill.total_jars}  |  Bill Month: ${monthLabel(bill.month)}`,
       M, noteY2, { width: W - M * 2, align: 'center' });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.rect(0, 775, W, 67).fill(C.dark);
  doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold')
     .text('Swara Aqua', 0, 786, { align: 'center', width: W });
  doc.fillColor(C.light).fontSize(8).font('Helvetica')
     .text('Pure Water Delivery Service  |  For queries contact your delivery agent', 0, 800, { align: 'center', width: W });
  doc.fillColor(C.mid).fontSize(7.5)
     .text(`Generated: ${new Date().toLocaleString('en-IN')}  |  Invoice #${String(bill.id).padStart(5,'0')}`, 0, 816, { align: 'center', width: W });

  doc.end();
};
