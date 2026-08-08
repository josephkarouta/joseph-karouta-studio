import PublicPage from "@/components/public/PublicPage";
import { legalPages } from "@/lib/public/pages";
export const metadata={title:legalPages["privacy"].title};
export default function Page(){const page=legalPages["privacy"];return <PublicPage slug="privacy" {...page}/>;}
