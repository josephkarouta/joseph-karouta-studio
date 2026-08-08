export const BRAND_BOOK_TOTAL_PAGES=16;
export function filename(project:string){return `${project||"brand"}-brand-guidelines.pdf`;}
export function beforePrint(){document.body.classList.add("printing-brand-book");}
export function afterPrint(){document.body.classList.remove("printing-brand-book");}