import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      user_id,
      name,
      email,
      phone,
      company,
      notes,
      project_brief,
      attachments,
    } = body;

    if (!name || !email || !phone) {
      return NextResponse.json(
        { success: false, error: "Missing contact details" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailRegex.test(email)) {
  return NextResponse.json(
    { success: false, error: "Invalid email address" },
    { status: 400 }
  );
}

    const { data, error } = await supabase
      .from("expert_requests")
      .insert({
        user_id: user_id || null,
        name,
        email,
        phone,
        company,
        notes,
        project_brief,
        attachments: attachments || [],
        status: "New",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

const attachmentLinks =
  attachments && attachments.length > 0
    ? attachments.map((file: string, index: number) => `File ${index + 1}: ${file}`).join("\n")
    : "No files uploaded.";

const ownerEmail = await resend.emails.send({
  from: "Heyy Studio <hello@heyystudio.com>",
  to: "hello@heyystudio.com",
  subject: "New Expert Request - Heyy Studio",
  replyTo: email,
  text: `
New expert request received.

Name: ${name}
Email: ${email}
Phone: ${phone}
Company: ${company || "Not provided"}

Notes:
${notes || "No notes provided"}

Attachments:
${attachmentLinks}

Project Brief:
${project_brief || "No project brief provided."}
  `,
});

console.log("Owner email result:", ownerEmail);

if (ownerEmail.error) {
  throw new Error(`Owner email failed: ${ownerEmail.error.message}`);
}
console.log("Client email value:", email);
console.log("Client email type:", typeof email);
const clientEmail = await resend.emails.send({
  from: "Heyy Studio <hello@heyystudio.com>",
  to: email,
  subject: "We've received your project",
  text: `
Hi ${name},

Thank you for contacting Heyy Studio.

We've received your project brief and our team will review it shortly.

If we need more information, we’ll contact you using the details you provided.

Thank you,
Heyy Studio
hello@heyystudio.com
  `,
});

console.log("Client email result:", clientEmail);

if (clientEmail.error) {
  throw new Error(`Client email failed: ${clientEmail.error.message}`);
}

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    console.error("Expert request error:", error);

    return NextResponse.json(
      { success: false, error: "Could not submit expert request" },
      { status: 500 }
    );
  }
}