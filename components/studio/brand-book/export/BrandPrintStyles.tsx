"use client";

export default function BrandPrintStyles() {
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

        #brand-book-print-root,
        #brand-book-print-root * {
          visibility: visible !important;
        }

        #brand-book-print-root {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
        }

        .brand-print-page {
          break-after: page !important;
          page-break-after: always !important;
          width: 190mm !important;
          min-height: 277mm !important;
          margin: 0 auto !important;
          overflow: hidden !important;
          background: #0d0d0d !important;
        }

        .brand-print-avoid-break {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        @page {
          size: A4;
          margin: 10mm;
        }
      }

      @media screen {
        #brand-book-print-root {
          display: none;
        }
      }
    `}</style>
  );
}
