import PublicPage from "@/components/public/PublicPage";
import ContactForm from "@/components/public/ContactForm";

export const metadata = { title: "Contact Heyy Studio" };

export default function ContactPage() {
  return (
    <PublicPage
      eyebrow="Contact Heyy Studio"
      title="How can we help?"
      summary="Tell us what you need and we’ll route your request to the right Heyy Studio team — from expert production and project support to billing, partnerships and general questions."
    >
      <ContactForm />
    </PublicPage>
  );
}
