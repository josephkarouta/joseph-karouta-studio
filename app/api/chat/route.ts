import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `
You are Heyy Studio AI.

Heyy Studio is an AI-powered creative and spatial platform.
You help users discover, define and structure creative, architecture, interior design, website and event projects.

Rules:
- Keep replies short.
- Ask only one question at a time.
- Always provide 3 to 4 options.
- Do not ask about budget.
- Do not mention Joseph.
- Speak as Heyy Studio AI.
- Return JSON only.

Discovery flow:
Question 1: Identify project category.
Question 2: Understand project type or space type.
Question 3: Understand goal or objective.
Question 4: Understand style, mood or direction.
Question 5: Understand deliverables or support needed.

Return JSON only with:
{
  "message": "short reply here",
  "options": ["Option 1", "Option 2", "Option 3", "Something Else"]
}
`;

export async function POST(req: Request) {
  try {
    const { messages, forceSummary } = await req.json();

    if (forceSummary) {
      const userAnswers = messages
        .filter((msg: any) => msg.role === "user")
        .map((msg: any) => msg.content);

      const cleanMessage = `
📋 PROJECT BRIEF

PROJECT OVERVIEW

The client is looking to develop a ${userAnswers[0] || "creative"} project with a focus on ${
        userAnswers[2] || "clear project direction"
      }.

OBJECTIVES

• Define a clear creative direction
• Support the project goal: ${userAnswers[2] || "Not specified"}
• Create a strong foundation for the next stage

STYLE / DIRECTION

${userAnswers[3] || "Not specified"}

KEY DELIVERABLES

${userAnswers.slice(4).join(", ") || "Not specified"}

RECOMMENDED STRATEGY

Develop a structured direction that aligns the project category, objective, visual style and required deliverables.

NEXT STEPS

What would you like to do next?
`;

      return NextResponse.json({
        message: cleanMessage,
        options: ["Continue with AI", "Get Expert Review", "Start again"],
      });
    }

    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      max_tokens: 250,
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
        message: parsed.message || "Tell me more about your project.",
        options: parsed.options || [],
      });
    } catch {
      return NextResponse.json({
        message: content || "Tell me more about your project.",
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