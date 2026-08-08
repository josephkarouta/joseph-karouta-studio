import PublicPage from "@/components/public/PublicPage";
import { legalPages } from "@/lib/public/pages";
export const metadata={title:legalPages["refunds"].title};
export default function Page(){const page=legalPages["refunds"];return <PublicPage slug="refunds" {...page}/>;}
