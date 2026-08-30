import "server-only";

import { jsPDF } from "jspdf";
import { getSiteUrl } from "@/lib/site-url";
import { getHeyyEmailLogoPng } from "@/lib/communications/brand-assets";

export type HeyyInvoiceData = {
  invoiceNumber: string;
  paidAt: string;
  description: string;
  amountTotal: number;
  taxAmount: number;
  currency: string;
  billingName?: string | null;
  billingEmail?: string | null;
};

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function invoiceBusinessDetails() {
  return {
    name: process.env.HEYY_INVOICE_BUSINESS_NAME || "Heyy Studio",
    abn: String(process.env.HEYY_INVOICE_ABN || "").trim(),
    address: String(process.env.HEYY_INVOICE_ADDRESS || "").trim(),
    email: process.env.HEYY_INVOICE_EMAIL || "hello@heyystudio.com",
    gstRegistered: process.env.HEYY_INVOICE_GST_REGISTERED === "true",
  };
}

export async function buildHeyyInvoicePdf(data: HeyyInvoiceData) {
  const business = invoiceBusinessDetails();
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth();
  const margin = 48;
  const accent = [111, 45, 255] as const;
  const dark = [24, 20, 32] as const;
  const muted = [103, 96, 114] as const;
  const subtotal = Math.max(0, data.amountTotal - data.taxAmount);

  doc.setFillColor(...dark);
  doc.rect(0, 0, width, 120, "F");
  doc.setTextColor(255, 255, 255);

  const logo = await getHeyyEmailLogoPng();
  if (logo) {
    const logoWidth = 142;
    const logoHeight = logoWidth * (logo.height / logo.width);
    doc.addImage(
      `data:image/png;base64,${logo.buffer.toString("base64")}`,
      "PNG",
      margin,
      34,
      logoWidth,
      logoHeight,
    );
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(25);
    doc.text("Heyy Studio", margin, 62);
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Create with AI. Build with Experts.", margin, 87);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(business.gstRegistered ? "Tax Invoice" : "Invoice", width - margin, 58, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.invoiceNumber, width - margin, 80, { align: "right" });

  let y = 158;
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Supplier", margin, y);
  doc.text("Bill to", width / 2 + 14, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  const supplierLines = [
    business.name,
    business.abn ? `ABN ${business.abn}` : null,
    business.address || null,
    business.email,
    getSiteUrl().replace(/^https?:\/\//, ""),
  ].filter(Boolean) as string[];
  supplierLines.forEach((line, index) => doc.text(line, margin, y + index * 15));

  const customerLines = [data.billingName || "Customer", data.billingEmail || null].filter(Boolean) as string[];
  customerLines.forEach((line, index) => doc.text(line, width / 2 + 14, y + index * 15));

  y = 252;
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Invoice date", margin, y);
  doc.text("Payment status", margin + 175, y);
  doc.text("Currency", margin + 350, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text(new Date(data.paidAt).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" }), margin, y + 18);
  doc.text("Paid", margin + 175, y + 18);
  doc.text(data.currency.toUpperCase(), margin + 350, y + 18);

  y = 318;
  doc.setFillColor(247, 245, 252);
  doc.roundedRect(margin, y, width - margin * 2, 42, 8, 8, "F");
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 14, y + 26);
  doc.text("Amount", width - margin - 14, y + 26, { align: "right" });

  y += 62;
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  const wrapped = doc.splitTextToSize(data.description, width - margin * 2 - 150);
  doc.text(wrapped, margin + 14, y);
  doc.setFont("helvetica", "bold");
  doc.text(money(data.amountTotal, data.currency), width - margin - 14, y, { align: "right" });

  y += Math.max(44, wrapped.length * 15 + 20);
  doc.setDrawColor(230, 226, 235);
  doc.line(margin, y, width - margin, y);
  y += 26;

  const totalX = width - margin;
  const labelX = width - margin - 170;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text("Subtotal", labelX, y);
  doc.text(money(subtotal, data.currency), totalX, y, { align: "right" });
  y += 20;
  doc.text(business.gstRegistered ? "GST / tax" : "Tax", labelX, y);
  doc.text(money(data.taxAmount, data.currency), totalX, y, { align: "right" });
  y += 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...dark);
  doc.text("Total paid", labelX, y);
  doc.setTextColor(...accent);
  doc.text(money(data.amountTotal, data.currency), totalX, y, { align: "right" });

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const footer = business.gstRegistered
    ? "This document records a completed Heyy Studio payment. GST/tax shown reflects the amount charged for this transaction."
    : "This document records a completed Heyy Studio payment.";
  doc.text(doc.splitTextToSize(footer, width - margin * 2), margin, 735);
  if (!business.abn && process.env.NEXT_PUBLIC_HEYY_PUBLIC_BETA === "true") {
    doc.setTextColor(183, 91, 0);
    doc.text("Sandbox note: configure Heyy Studio legal invoice details before go-live.", margin, 766);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
