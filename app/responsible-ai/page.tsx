import PublicPage from "@/components/public/PublicPage";
import { legalPages } from "@/lib/public/pages";
export const metadata={title:legalPages["responsible-ai"].title};
export default function Page(){const page=legalPages["responsible-ai"];return <PublicPage slug="responsible-ai" {...page}/>;}
