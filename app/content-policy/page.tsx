import PublicPage from "@/components/public/PublicPage";
import { legalPages } from "@/lib/public/pages";
export const metadata={title:legalPages["content-policy"].title};
export default function Page(){const page=legalPages["content-policy"];return <PublicPage slug="content-policy" {...page}/>;}
