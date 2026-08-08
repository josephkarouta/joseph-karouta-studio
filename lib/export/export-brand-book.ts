export async function exportBrandBookPdf() {
  const root = document.getElementById("brand-book-export-renderer");

  if (!root) {
    alert("Export failed: Brand Book renderer was not found.");
    return;
  }

  window.print();
}