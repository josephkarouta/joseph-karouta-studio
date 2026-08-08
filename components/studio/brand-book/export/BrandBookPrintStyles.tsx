"use client";

export default function BrandBookPrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        html,
        body {
          background: #000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body * {
          visibility: hidden !important;
        }

        #brand-book-export-renderer,
        #brand-book-export-renderer * {
          visibility: visible !important;
        }

        #brand-book-export-renderer {
          display: block !important;
          position: absolute !important;
          inset: 0 auto auto 0 !important;
          width: 100% !important;
          background: #000 !important;
        }

        #brand-book-export-renderer .print-page {
          break-after: page !important;
          page-break-after: always !important;
          min-height: 270mm !important;
          width: 100% !important;
          margin: 0 !important;
          box-shadow: none !important;
        }

        #brand-book-export-renderer .no-print-break {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        @page {
          size: A4;
          margin: 10mm;
        }
      }

      @media screen {
        #brand-book-export-renderer {
          display: none;
        }
      }
    `}</style>
  );
}
