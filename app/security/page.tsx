import PublicPage from "@/components/public/PublicPage";
import { legalPages } from "@/lib/public/pages";
export const metadata={title:legalPages["security"].title};
export default function Page(){const page=legalPages["security"];return <PublicPage slug="security" {...page}/>;}
