export default function EmailTemplates({
  name,
  email,
  projectId,
}: {
  name: string;
  email: string;
  projectId: string;
}) {
  const templates = [
    {
      label: "Send Quote",
      subject: `Quote for ${projectId}`,
      body: `Hi ${name},

Thank you for sharing your project brief.

I’ve reviewed the details and prepared a quote for your project.

Please let me know if you have any questions.

Best,
Heyy Studio`,
    },
    {
      label: "Follow Up",
      subject: `Following up on ${projectId}`,
      body: `Hi ${name},

Just following up on your project enquiry.

Let me know if you’d like to move forward or if you have any questions.

Best,
Heyy Studio`,
    },
    {
      label: "Project Won",
      subject: `Next steps for ${projectId}`,
      body: `Hi ${name},

Great, thank you for confirming.

We’re excited to move forward with your project.

I’ll send through the next steps shortly.

Best,
Heyy Studio`,
    },
    {
      label: "Project Lost",
      subject: `Thank you for your enquiry`,
      body: `Hi ${name},

Thank you again for considering Heyy Studio.

No problem at all, and we’d be happy to help if anything changes in the future.

Best,
Heyy Studio`,
    },
  ];

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm uppercase tracking-[0.3em] text-white/40">
  Email Templates
</p>

      <div className="mt-4 flex flex-wrap gap-3">
        {templates.map((template) => (
          <a
            key={template.label}
            href={`mailto:${email}?subject=${encodeURIComponent(
              template.subject
            )}&body=${encodeURIComponent(template.body)}`}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-black"
          >
            {template.label}
          </a>
        ))}
      </div>
    </div>
  );
}