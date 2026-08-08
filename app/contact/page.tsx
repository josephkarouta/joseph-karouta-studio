import PublicPage from "@/components/public/PublicPage";
import ContactForm from "@/components/public/ContactForm";
export const metadata={title:"Contact"};
export default function ContactPage(){return <PublicPage eyebrow="Contact Heyy Studio" title="Tell us what needs to move forward." summary="Ask a platform question, request expert production, discuss a partnership or send a support issue with the relevant context."><ContactForm/></PublicPage>;}
