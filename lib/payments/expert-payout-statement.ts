import "server-only";

import { jsPDF } from "jspdf";
import { getHeyyEmailLogoPng } from "@/lib/communications/brand-assets";
import { invoiceBusinessDetails } from "@/lib/payments/invoice-pdf";

export type ExpertPayoutStatementAddition = {
  label: string;
  amountCents: number;
};

export type ExpertPayoutStatementData = {
  assignmentId: string;
  expertName: string;
  expertEmail?: string | null;
  projectName: string;
  service: string;
  studio?: string | null;
  currency: string;
  totalExpertFeeCents: number;
  additions?: ExpertPayoutStatementAddition[];
  paidAt: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
};

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
    }).format(Number(cents || 0) / 100);
  } catch {
    return `${String(currency || "USD").toUpperCase()} ${(Number(cents || 0) / 100).toFixed(2)}`;
  }
}

function cleanMethod(value?: string | null) {
  const text = String(value || "").trim().replaceAll("_", " ");
  if (!text) return "Manual payment";
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function expertPayoutStatementNumber(assignmentId: string, paidAt?: string | null) {
  const year = paidAt ? new Date(paidAt).getFullYear() : new Date().getFullYear();
  const suffix = String(assignmentId || "PAYOUT").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase() || "PAYOUT";
  return `HPS-${Number.isFinite(year) ? year : new Date().getFullYear()}-${suffix}`;
}

export async function buildExpertPayoutStatementPdf(data: ExpertPayoutStatementData) {
  const business = invoiceBusinessDetails();
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth();
  const margin = 48;
  const accent = [139, 92, 246] as const;
  const dark = [23, 19, 31] as const;
  const muted = [103, 96, 114] as const;
  const border = [230, 226, 235] as const;
  const statementNumber = expertPayoutStatementNumber(data.assignmentId, data.paidAt);
  const additions = (data.additions || []).filter((item) => Number(item.amountCents || 0) > 0);
  const additionsTotal = additions.reduce((sum, item) => sum + Number(item.amountCents || 0), 0);
  const baseFee = Math.max(0, Number(data.totalExpertFeeCents || 0) - additionsTotal);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, width, 126, "F");
  doc.setFillColor(...accent);
  doc.rect(0, 0, width, 6, "F");

  const logo = await getHeyyEmailLogoPng();
  if (logo) {
    const maxLogoWidth = 112;
    const maxLogoHeight = 34;
    const scale = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
    doc.addImage(
      `data:image/png;base64,${logo.buffer.toString("base64")}`,
      "PNG",
      margin,
      28,
      logo.width * scale,
      logo.height * scale,
    );
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...dark);
    doc.text("Heyy Studio", margin, 50);
  }

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Create with Heyy. Build with Experts.", margin, 87);

  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Expert Payout Statement", width - margin, 48, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(statementNumber, width - margin, 68, { align: "right" });
  doc.text("Payment record · not a tax invoice", width - margin, 85, { align: "right" });

  doc.setDrawColor(...border);
  doc.line(margin, 112, width - margin, 112);

  let y = 150;
  const half = width / 2 + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text("Paid by", margin, y);
  doc.text("Paid to", half, y);
  y += 17;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  const supplier = [business.name, business.abn ? `ABN ${business.abn}` : null, business.email, business.website.replace(/^https?:\/\//, "")].filter(Boolean) as string[];
  supplier.forEach((line, index) => doc.text(doc.splitTextToSize(line, 210), margin, y + index * 14));
  const expert = [data.expertName, data.expertEmail || null].filter(Boolean) as string[];
  expert.forEach((line, index) => doc.text(doc.splitTextToSize(line, 210), half, y + index * 14));

  y = 245;
  doc.setFillColor(247, 245, 252);
  doc.setDrawColor(...border);
  doc.roundedRect(margin, y, width - margin * 2, 82, 12, 12, "FD");
  const detailRows: Array<[string, string]> = [
    ["Project", data.projectName],
    ["Service", data.service],
    ["Paid date", new Date(data.paidAt).toLocaleString("en-AU", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })],
    ["Payment method", cleanMethod(data.paymentMethod)],
    ["Payment reference", data.paymentReference || "Not recorded"],
  ];
  const colWidth = (width - margin * 2 - 28) / 2;
  detailRows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + 14 + col * (colWidth + 14);
    const yy = y + 18 + row * 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accent);
    doc.text(label.toUpperCase(), x, yy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    doc.setTextColor(...dark);
    doc.text(doc.splitTextToSize(value, colWidth - 5), x, yy + 10);
  });

  y = 356;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text("Payout breakdown", margin, y);
  y += 20;
  doc.setFillColor(247, 245, 252);
  doc.roundedRect(margin, y, width - margin * 2, 34, 8, 8, "F");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("Description", margin + 12, y + 21);
  doc.text("Amount", width - margin - 12, y + 21, { align: "right" });
  y += 50;

  const rows: Array<[string, number]> = [["Original agreed Expert fee", baseFee], ...additions.map((item) => [item.label, item.amountCents] as [string, number])];
  rows.forEach(([label, amount]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...dark);
    doc.text(doc.splitTextToSize(label, 330), margin + 12, y);
    doc.setFont("helvetica", "bold");
    doc.text(money(amount, data.currency), width - margin - 12, y, { align: "right" });
    y += 26;
    doc.setDrawColor(...border);
    doc.line(margin + 12, y - 11, width - margin - 12, y - 11);
  });

  y += 8;
  doc.setFillColor(242, 235, 255);
  doc.roundedRect(width - margin - 245, y, 245, 54, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("TOTAL EXPERT PAYOUT", width - margin - 230, y + 20);
  doc.setFontSize(16);
  doc.setTextColor(...accent);
  doc.text(money(data.totalExpertFeeCents, data.currency), width - margin - 14, y + 36, { align: "right" });

  const noteY = 690;
  doc.setFillColor(251, 250, 252);
  doc.setDrawColor(...border);
  doc.roundedRect(margin, noteY, width - margin * 2, 72, 10, 10, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...dark);
  doc.text("Record purpose", margin + 14, noteY + 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...muted);
  const legal = "This statement records a manual Expert payout made by Heyy Studio for the project shown above. It is a payment record, not a tax invoice, and does not replace any invoice, receipt or tax document the Expert may be required to issue under their local laws.";
  doc.text(doc.splitTextToSize(legal, width - margin * 2 - 28), margin + 14, noteY + 36);

  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text(`Heyy Studio · ${statementNumber}`, margin, 806);
  doc.text("Expert Payout Statement", width - margin, 806, { align: "right" });

  return { buffer: Buffer.from(doc.output("arraybuffer")), statementNumber };
}
