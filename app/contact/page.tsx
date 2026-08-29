import PublicPage from "@/components/public/PublicPage";
import ContactForm from "@/components/public/ContactForm";

export const metadata = { title: "Contact Heyy Studio" };

export default function ContactPage() {
  return (
    <PublicPage
      eyebrow="Contact"
      title="What can we help with?"
      summary="Ask about your account, credits, a project, expert production, a partnership or anything that is getting in the way."
    >
      <ContactForm />
    </PublicPage>
  );
}
