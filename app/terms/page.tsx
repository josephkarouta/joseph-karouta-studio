import PublicPage from "@/components/public/PublicPage";
import { legalPages } from "@/lib/public/pages";
export const metadata={title:legalPages["terms"].title};
export default function Page(){const page=legalPages["terms"];return <PublicPage slug="terms" {...page}/>;}
