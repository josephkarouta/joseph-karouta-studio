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
  billingCustomerType?: "personal" | "business" | null;
  billingName?: string | null;
  billingEmail?: string | null;
  billingCompanyName?: string | null;
  billingCompanyNumber?: string | null;
  billingTaxId?: string | null;
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingCity?: string | null;
  billingStateRegion?: string | null;
  billingPostalCode?: string | null;
  billingCountryCode?: string | null;
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

function customerLines(data: HeyyInvoiceData) {
  const locality = [data.billingCity, data.billingStateRegion, data.billingPostalCode].filter(Boolean).join(" ");
  return [
    data.billingCustomerType === "business" ? data.billingCompanyName : data.billingName,
    data.billingCustomerType === "business" && data.billingName && data.billingName !== data.billingCompanyName ? data.billingName : null,
    data.billingCompanyNumber ? `Company no. ${data.billingCompanyNumber}` : null,
    data.billingTaxId ? `${String(data.billingCountryCode || "").toUpperCase() === "AU" ? "ABN / Tax ID" : "Tax ID"} ${data.billingTaxId}` : null,
    data.billingEmail || null,
    data.billingAddressLine1 || null,
    data.billingAddressLine2 || null,
    locality || null,
    data.billingCountryCode ? String(data.billingCountryCode).toUpperCase() : null,
  ].filter(Boolean) as string[];
}

export async function buildHeyyInvoicePdf(data: HeyyInvoiceData) {
  const business = invoiceBusinessDetails();
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth();
  const margin = 48;
  const accent = [108, 0, 255] as const;
  const dark = [23, 19, 31] as const;
  const muted = [103, 96, 114] as const;
  const subtotal = Math.max(0, data.amountTotal - data.taxAmount);

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
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Heyy Studio", margin, 50);
  }

  doc.setTextColor(...muted);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Create with AI. Build with Experts.", margin, 87);

  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(business.gstRegistered ? "Tax Invoice" : "Invoice", width - margin, 48, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text(data.invoiceNumber, width - margin, 70, { align: "right" });

  doc.setDrawColor(230, 226, 235);
  doc.line(margin, 112, width - margin, 112);

  let y = 154;
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
  supplierLines.forEach((line, index) => doc.text(doc.splitTextToSize(line, 220), margin, y + index * 15));

  const billToLines = customerLines(data);
  billToLines.slice(0, 8).forEach((line, index) => doc.text(doc.splitTextToSize(line, 220), width / 2 + 14, y + index * 15));

  y = Math.max(252, y + Math.max(supplierLines.length, Math.min(8, billToLines.length)) * 15 + 28);
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

  y += 66;
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
  const isAustralianBillTo = String(data.billingCountryCode || "").toUpperCase() === "AU";
  doc.text(business.gstRegistered && isAustralianBillTo ? "GST" : "Tax", labelX, y);
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
    ? "This document records a completed Heyy Studio payment. Tax shown reflects the amount charged for this transaction."
    : "This document records a completed Heyy Studio payment.";
  doc.text(doc.splitTextToSize(footer, width - margin * 2), margin, 735);
  if (!business.abn && process.env.NEXT_PUBLIC_HEYY_PUBLIC_BETA === "true") {
    doc.setTextColor(183, 91, 0);
    doc.text("Sandbox note: configure Heyy Studio legal invoice details before go-live.", margin, 766);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
