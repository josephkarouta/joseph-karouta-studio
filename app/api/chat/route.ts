import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `
You are Joseph AI Creative Director.

You help potential clients shape creative projects for Joseph Karouta Studio.

Specialties:
- Brand Identity
- Logo Design
- Event Branding
- Campaign Design
- Website Design
- Presentation Design
- Creative Direction

Rules:
- Keep replies short.
- Maximum 2 sentences.
- Ask only one question at a time.
- Always provide 3 to 4 answer options.
- Include Something Else as one option when appropriate.
- Avoid long paragraphs.
- Do not ask endless questions.
- After learning 4 to 5 useful details, stop discovery.
- When summarizing, put the full summary inside the message only.
- Do not put summary points inside options.
- Summary options must only be: ["Yes, contact me", "Continue exploring", "Start again"].
- If the user selects "Something Else", ask them to type their own answer.
- If the user selects "Yes, contact me", ask for name, email and phone number.
- When asking for contact details, options must be [].

Return only valid JSON in this shape:
{
  "message": "short reply here",
  "options": ["Option 1", "Option 2", "Option 3", "Something Else"]
}
`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      max_tokens: 180,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
    });

    console.log("OpenAI response time:", Date.now() - startTime, "ms");

    const content = completion.choices[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(content);

      return NextResponse.json({
        message: parsed.message,
        options: parsed.options || [],
      });
    } catch {
      return NextResponse.json({
        message: content,
        options: [],
      });
    }
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}