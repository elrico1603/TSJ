import { jsPDF } from 'jspdf';
import { PurchaseOrder } from '../types';
import { companyService } from './companyService';

/**
 * TS HUB — Programmatic Purchase Order PDF Engine
 * Canonical service for generating authentic, multi-page, A4 Purchase Order PDF documents.
 */

// Helper to sanitize conversational greetings from delivery instructions
const sanitizeDeliveryInstructions = (instructions?: string): string => {
  if (!instructions) return '';
  return instructions
    .replace(/hi\s+[a-z]+/gi, '')
    .replace(/here\s+is\s+our\s+order,?\s*thank\s+you\.?/gi, '')
    .replace(/here\s+is\s+our\s+order/gi, '')
    .replace(/thank\s+you\.?/gi, '')
    .trim();
};

export interface GeneratePdfOptions {
  compress?: boolean;
}

/**
 * Generates an authentic A4 vector PDF document for a Purchase Order.
 * Returns a standard Blob of type 'application/pdf'.
 */
export async function generatePurchaseOrderPdf(
  po: PurchaseOrder,
  options?: GeneratePdfOptions
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: options?.compress ?? false
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const marginTop = 14;
  const marginBottom = 18;
  const contentWidth = pageWidth - (marginX * 2); // 182mm

  // Authoritative company and branch information
  const companyInfo = companyService.getLocalCompanyInfo();
  const branches = companyService.getLocalBranches();
  const branch = branches.find(b => b.id === po.branchId || b.branchCode === po.branchId);

  let currentY = marginTop;

  // Draw Header (Logo, Company Details, PO Meta Box)
  const drawPageHeader = (isContinuation: boolean = false) => {
    if (isContinuation) {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(marginX, marginTop, contentWidth, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(`PURCHASE ORDER: ${po.poNumber} (Continued)`, marginX + 4, marginTop + 6.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Supplier: ${po.supplierName}`, marginX + contentWidth - 4, marginTop + 6.5, { align: 'right' });
      return marginTop + 14;
    }

    // --- First Page Header ---
    // 1. Amber TS Logo Monogram
    doc.setFillColor(245, 158, 11); // amber-500
    doc.roundedRect(marginX, currentY, 14, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('TS', marginX + 7, currentY + 9.5, { align: 'center' });

    // 2. Company Details
    const compX = marginX + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    const companyTitle = (companyInfo.companyName || 'TS JOINERY & TIMBER WORKS').toUpperCase();
    doc.text(companyTitle, compX, currentY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600
    const companyNotes = companyInfo.notes || 'Precision Joinery, Custom Cabinetry & Architectural Woodwork';
    doc.text(companyNotes, compX, currentY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500
    const addressLine = companyInfo.physicalAddress || '14 Joiners Street, Industrial Area, Bloemfontein';
    doc.text(addressLine, compX, currentY + 11.5);

    const contactLineParts = [];
    if (companyInfo.telephone) contactLineParts.push(`Tel: ${companyInfo.telephone}`);
    if (companyInfo.email) contactLineParts.push(`Email: ${companyInfo.email}`);
    if (contactLineParts.length > 0) {
      doc.text(contactLineParts.join('  |  '), compX, currentY + 15);
    }

    const regLineParts = [];
    if (companyInfo.vatNumber) regLineParts.push(`VAT Reg: ${companyInfo.vatNumber}`);
    if (companyInfo.registrationNumber) regLineParts.push(`Co Reg: ${companyInfo.registrationNumber}`);
    if (regLineParts.length > 0) {
      doc.text(regLineParts.join('  |  '), compX, currentY + 18.5);
    }

    // 3. Purchase Order Title & Meta Box (Right Aligned)
    const metaBoxWidth = 64;
    const metaBoxX = marginX + contentWidth - metaBoxWidth;
    const metaBoxY = currentY;
    const metaBoxHeight = 22;

    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, metaBoxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(217, 119, 6); // amber-600
    doc.text('PURCHASE ORDER', metaBoxX + (metaBoxWidth / 2), metaBoxY + 5, { align: 'center' });

    doc.setFontSize(7.5);
    let metaLineY = metaBoxY + 9.5;
    
    // PO Number
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('PO NUMBER:', metaBoxX + 4, metaLineY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(po.poNumber, metaBoxX + metaBoxWidth - 4, metaLineY, { align: 'right' });

    // Date
    metaLineY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('DATE:', metaBoxX + 4, metaLineY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const poDateStr = new Date(po.createdAt).toLocaleDateString('en-ZA');
    doc.text(poDateStr, metaBoxX + metaBoxWidth - 4, metaLineY, { align: 'right' });

    // Linked Request
    if (po.linkedRequestNumber) {
      metaLineY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('LINKED REQ:', metaBoxX + 4, metaLineY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(217, 119, 6);
      doc.text(po.linkedRequestNumber, metaBoxX + metaBoxWidth - 4, metaLineY, { align: 'right' });
    }

    // Status Badge
    metaLineY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('STATUS:', metaBoxX + 4, metaLineY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(po.status === 'Approved' ? 5 : 15, po.status === 'Approved' ? 150 : 23, po.status === 'Approved' ? 105 : 42);
    doc.text(po.status.toUpperCase(), metaBoxX + metaBoxWidth - 4, metaLineY, { align: 'right' });

    // Divider Line under Header
    const dividerY = currentY + 26;
    doc.setDrawColor(15, 23, 42); // slate-900
    doc.setLineWidth(0.6);
    doc.line(marginX, dividerY, marginX + contentWidth, dividerY);

    return dividerY + 5;
  };

  currentY = drawPageHeader(false);

  // Vendor / Supplier and Delivery Destination Section
  const cardGap = 5;
  const cardWidth = (contentWidth - cardGap) / 2;
  const cardHeight = 35;

  // Card 1: Vendor / Supplier Details
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('VENDOR / SUPPLIER DETAILS', marginX + 4, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(po.supplierCode || 'SUP', marginX + cardWidth - 4, currentY + 5, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(marginX + 4, currentY + 6.5, marginX + cardWidth - 4, currentY + 6.5);

  let vendorY = currentY + 10.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text((po.supplierName || 'Unknown Supplier').toUpperCase(), marginX + 4, vendorY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85); // slate-700
  if (po.supplierContactPerson) {
    vendorY += 4;
    doc.text(`Attn: ${po.supplierContactPerson}`, marginX + 4, vendorY);
  }
  if (po.supplierTelephone) {
    vendorY += 4;
    doc.text(`Tel: ${po.supplierTelephone}`, marginX + 4, vendorY);
  }
  if (po.supplierEmail) {
    vendorY += 4;
    doc.text(`Email: ${po.supplierEmail}`, marginX + 4, vendorY);
  }
  if (po.supplierAddress) {
    vendorY += 4;
    const splitAddr = doc.splitTextToSize(`Address: ${po.supplierAddress}`, cardWidth - 8);
    doc.text(splitAddr.slice(0, 2), marginX + 4, vendorY);
  }

  // Card 2: Delivery Destination
  const destX = marginX + cardWidth + cardGap;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(destX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('DELIVERY DESTINATION', destX + 4, currentY + 5);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(destX + 4, currentY + 6.5, destX + cardWidth - 4, currentY + 6.5);

  let destY = currentY + 10.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const destBranchName = (branch?.branchName || po.branchName || 'TS Joinery Workshop').toUpperCase();
  doc.text(destBranchName, destX + 4, destY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  const delivAddr = po.deliveryAddress || branch?.physicalAddress || companyInfo.physicalAddress || '';
  if (delivAddr) {
    destY += 4;
    const splitDeliv = doc.splitTextToSize(delivAddr, cardWidth - 8);
    doc.text(splitDeliv.slice(0, 2), destX + 4, destY);
    if (splitDeliv.length > 1) destY += 3.5;
  }

  const cleanedNotes = sanitizeDeliveryInstructions(po.deliveryInstructions);
  if (cleanedNotes) {
    destY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text('Delivery Notes: ', destX + 4, destY);
    doc.setFont('helvetica', 'normal');
    const noteWidth = doc.getTextWidth('Delivery Notes: ');
    const splitNotes = doc.splitTextToSize(cleanedNotes, cardWidth - 8 - noteWidth);
    doc.text(splitNotes[0] || '', destX + 4 + noteWidth, destY);
  }

  if (po.expectedDeliveryDate) {
    destY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Expected Delivery: ', destX + 4, destY);
    const expWidth = doc.getTextWidth('Expected Delivery: ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 83, 9);
    doc.text(po.expectedDeliveryDate, destX + 4 + expWidth, destY);
  }

  currentY += cardHeight + 6;

  // --- Order Items Table ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('ORDER ITEMS & SPECIFICATIONS', marginX, currentY);
  currentY += 3;

  // Table Column Definitions (Sum = 182mm)
  const cols = [
    { title: '#', width: 9, align: 'center' as const },
    { title: 'PRODUCT DESCRIPTION', width: 66, align: 'left' as const },
    { title: 'CODE / PART #', width: 37, align: 'left' as const },
    { title: 'UNIT', width: 14, align: 'center' as const },
    { title: 'QTY', width: 16, align: 'right' as const },
    { title: 'EST. PRICE', width: 20, align: 'right' as const },
    { title: 'TOTAL (ZAR)', width: 20, align: 'right' as const }
  ];

  const drawTableHeader = (y: number) => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(marginX, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);

    let colX = marginX;
    cols.forEach(c => {
      let textX = colX + 2;
      if (c.align === 'center') textX = colX + (c.width / 2);
      if (c.align === 'right') textX = colX + c.width - 2;
      doc.text(c.title, textX, y + 4.8, { align: c.align });
      colX += c.width;
    });

    return y + 7;
  };

  currentY = drawTableHeader(currentY);

  // Table Rows Render with Multi-Page Break Detection
  po.items.forEach((item, idx) => {
    const price = item.unitPrice || 0;
    const total = item.totalPrice || (price * item.orderQuantity);
    const prodDesc = item.productName || item.productDescription || 'Product';

    // Calculate row height based on text lines
    const descLines = doc.splitTextToSize(prodDesc, cols[1].width - 4);
    const codeLines = doc.splitTextToSize(item.internalProductCode || item.productId || '', cols[2].width - 4);
    
    let extraDescLines = 0;
    if (item.productDescription && item.productDescription !== item.productName) {
      extraDescLines += 1;
    }
    if (item.location) {
      extraDescLines += 1;
    }

    let extraCodeLines = 0;
    if (item.kanbanId) extraCodeLines += 1;
    if (item.supplierPartNumber && item.supplierPartNumber !== 'N/A') extraCodeLines += 1;

    const rowContentLines = Math.max(descLines.length + extraDescLines, codeLines.length + extraCodeLines, 1);
    const rowHeight = Math.max(7.5, 4.5 + (rowContentLines * 3.2));

    // Check if row exceeds page height (leave 35mm for footer/signatures or page switch)
    if (currentY + rowHeight > pageHeight - marginBottom) {
      doc.addPage();
      currentY = drawPageHeader(true);
      currentY = drawTableHeader(currentY);
    }

    // Zebra striping
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');
    }

    // Bottom row border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

    // Column 0: Index
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(String(idx + 1), marginX + (cols[0].width / 2), currentY + 4.5, { align: 'center' });

    // Column 1: Description
    let colX = marginX + cols[0].width;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(descLines[0] || '', colX + 2, currentY + 4.2);

    let descSubY = currentY + 4.2;
    if (descLines.length > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      for (let i = 1; i < descLines.length; i++) {
        descSubY += 3;
        doc.text(descLines[i], colX + 2, descSubY);
      }
    }
    if (item.productDescription && item.productDescription !== item.productName) {
      descSubY += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      const splitSub = doc.splitTextToSize(item.productDescription, cols[1].width - 4);
      doc.text(splitSub[0] || '', colX + 2, descSubY);
    }
    if (item.location) {
      descSubY += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(`Bin: ${item.location}`, colX + 2, descSubY);
    }

    // Column 2: Code / Part #
    colX += cols[1].width;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 33, 168); // purple-800
    doc.text(codeLines[0] || '', colX + 2, currentY + 4.2);

    let codeSubY = currentY + 4.2;
    if (item.kanbanId) {
      codeSubY += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text(`Kanban: ${item.kanbanId}`, colX + 2, codeSubY);
    }
    if (item.supplierPartNumber && item.supplierPartNumber !== 'N/A') {
      codeSubY += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(`Part: ${item.supplierPartNumber}`, colX + 2, codeSubY);
    }

    // Column 3: Unit
    colX += cols[2].width;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text((item.unit || 'ea').toUpperCase(), colX + (cols[3].width / 2), currentY + 4.5, { align: 'center' });

    // Column 4: Quantity
    colX += cols[3].width;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(String(item.orderQuantity), colX + cols[4].width - 2, currentY + 4.5, { align: 'right' });

    // Column 5: Est. Unit Price
    colX += cols[4].width;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(price > 0 ? `R ${price.toFixed(2)}` : '—', colX + cols[5].width - 2, currentY + 4.5, { align: 'right' });

    // Column 6: Total Price
    colX += cols[5].width;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(total > 0 ? `R ${total.toFixed(2)}` : '—', colX + cols[6].width - 2, currentY + 4.5, { align: 'right' });

    currentY += rowHeight;
  });

  // Check if Totals & Signatures fit on current page (requires ~55mm)
  if (currentY + 55 > pageHeight - marginBottom) {
    doc.addPage();
    currentY = drawPageHeader(true);
  } else {
    currentY += 6;
  }

  // --- Terms & Totals Section ---
  const termsWidth = 110;
  const totalsWidth = contentWidth - termsWidth - 6;

  // Standard Purchase Terms
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Standard Purchase Terms & Conditions:', marginX, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('• PO number must appear on all invoices, delivery notes, and packaging.', marginX, currentY + 4);
  doc.text('• Delivery times must comply with stated lead times unless authorized in writing.', marginX, currentY + 7.5);
  doc.text('• All materials subject to quality inspection upon arrival at receiving bay.', marginX, currentY + 11);

  // Totals Summary Box
  const totalsX = marginX + termsWidth + 6;
  const totalsY = currentY - 2;
  const totalsHeight = 18;

  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsX, totalsY, totalsWidth, totalsHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL ITEMS:', totalsX + 3, totalsY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${po.totalProducts} Line Items`, totalsX + totalsWidth - 3, totalsY + 4.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL QTY:', totalsX + 3, totalsY + 8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${po.totalQuantity} Units`, totalsX + totalsWidth - 3, totalsY + 8.5, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(totalsX + 3, totalsY + 10.5, totalsX + totalsWidth - 3, totalsY + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('ESTIMATED TOTAL:', totalsX + 3, totalsY + 15);
  doc.setTextColor(180, 83, 9); // amber-700
  const totalValueStr = (po.estimatedTotalValue && po.estimatedTotalValue > 0) ? `R ${po.estimatedTotalValue.toFixed(2)}` : '—';
  doc.text(totalValueStr, totalsX + totalsWidth - 3, totalsY + 15, { align: 'right' });

  currentY += 20;

  // --- Signatures & Authorisations Block ---
  const sigDividerY = currentY;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginX, sigDividerY, marginX + contentWidth, sigDividerY);

  const sigY = sigDividerY + 5;
  const sigColWidth = (contentWidth - 10) / 2;

  // Left Signature: Requisitioner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PREPARED BY:', marginX, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(po.createdUser || 'Procurement User', marginX, sigY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const createdDateStr = new Date(po.createdAt).toLocaleDateString('en-ZA');
  doc.text(createdDateStr, marginX, sigY + 7.5);

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(marginX, sigY + 14, marginX + 50, sigY + 14);

  doc.setFontSize(6);
  doc.text('Authorized Requisitioner Signature', marginX, sigY + 17);

  // Right Signature: Procurement Approver
  const rightSigX = marginX + sigColWidth + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('APPROVED & AUTHORIZED BY:', rightSigX, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const isApproved = po.status === 'Approved';
  doc.setTextColor(isApproved ? 5 : 100, isApproved ? 150 : 116, isApproved ? 105 : 139);
  doc.text(isApproved ? (po.approvedBy || 'Authorized Approver') : 'Pending Approval', rightSigX, sigY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const approvedDateStr = po.approvedAt ? new Date(po.approvedAt).toLocaleDateString('en-ZA') : '(Not yet approved)';
  doc.text(approvedDateStr, rightSigX, sigY + 7.5);

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(rightSigX, sigY + 14, rightSigX + 50, sigY + 14);

  doc.setFontSize(6);
  doc.text('Procurement Approval Signature', rightSigX, sigY + 17);

  // --- Document Footers across ALL Pages ---
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    const footerY = pageHeight - 10;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, footerY - 3, marginX + contentWidth, footerY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`PO #${po.poNumber}`, marginX, footerY);
    doc.text('TS Joinery ERP • Official Procurement Document', marginX + (contentWidth / 2), footerY, { align: 'center' });
    doc.text(`Page ${pageNum} of ${totalPages}`, marginX + contentWidth, footerY, { align: 'right' });
  }

  // Return standard application/pdf Blob
  return doc.output('blob');
}

/**
 * Generates Base64 encoded string of the Purchase Order PDF.
 * Ideal for RFC 2822 email attachments in Gmail integration.
 */
export async function generatePurchaseOrderPdfBase64(
  po: PurchaseOrder,
  options?: GeneratePdfOptions
): Promise<string> {
  const blob = await generatePurchaseOrderPdf(po, options);
  const arrayBuffer = await blob.arrayBuffer();

  // Universal Base64 encoder for browser and server/Node runtimes
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(arrayBuffer).toString('base64');
  }

  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Generates ArrayBuffer of the Purchase Order PDF.
 */
export async function generatePurchaseOrderPdfArrayBuffer(po: PurchaseOrder): Promise<ArrayBuffer> {
  const blob = await generatePurchaseOrderPdf(po);
  return await blob.arrayBuffer();
}

/**
 * Downloads the Purchase Order PDF directly in the browser without print dialog.
 */
export async function downloadPurchaseOrderPdf(po: PurchaseOrder, filename?: string): Promise<void> {
  const blob = await generatePurchaseOrderPdf(po);
  const targetFilename = filename || `Purchase_Order_${po.poNumber}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = targetFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
