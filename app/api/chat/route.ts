import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getModelForPlan(plan?: string) {
  if (plan === "pro") {
    return process.env.PRO_MODEL || "gpt-5.5";
  }

  if (plan === "starter") {
    return process.env.STARTER_MODEL || "gpt-4.1";
  }

  return process.env.FREE_MODEL || "gpt-4.1-nano";
}

const systemPrompt = `
You are Heyy Studio AI.

Heyy Studio is an AI + Experts creative platform.
You help users shape project ideas into expert-ready briefs.

Services:
- Branding & Identity
- Website & Digital
- Events & Experiences
- Architecture
- Interior Design
- Creative Strategy
- AI Consulting

Rules:
- Speak as Heyy Studio AI.
- Do not mention Joseph.
- Keep replies short, premium and helpful.
- Ask one question at a time.
- Always return 3 to 5 quick reply options.
- Make options dynamic based on the user's previous answers.
- If the user chooses "Something Else", support custom answers.
- Do not sound like a generic chatbot.
- Return JSON only.

Conversation goal:
Guide the user through project discovery, then help create a strong expert-ready project brief.

Discovery stages:
1. Identify project category.
2. Understand project type or context.
3. Understand goal or objective.
4. Understand style, mood or direction.
5. Understand deliverables or support needed.

For each reply, return JSON only:
{
  "message": "short helpful question or response",
  "options": ["Option 1", "Option 2", "Option 3", "Something Else"]
}
`;

function buildProjectBrief(userAnswers: string[]) {
  const category = userAnswers[0] || "Creative Project";
  const projectType = userAnswers[1] || "Not specified";
  const objective = userAnswers[2] || "Not specified";
  const style = userAnswers[3] || "Not specified";
  const deliverables =
    userAnswers.slice(4).join(", ") || "Not specified";

  let expertRecommendation = "Creative Expert";

  const categoryLower = category.toLowerCase();

  if (categoryLower.includes("architect")) {
    expertRecommendation = "Architecture Expert";
  }

  if (categoryLower.includes("interior")) {
    expertRecommendation = "Interior Design Expert";
  }

  if (
    categoryLower.includes("website") ||
    categoryLower.includes("branding")
  ) {
    expertRecommendation = "Creative Expert";
  }

  if (categoryLower.includes("event")) {
    expertRecommendation = "Event Branding Expert";
  }

  return `
📋 PROJECT BRIEF

PROJECT OVERVIEW

The client is looking to develop a ${category} project focused on ${projectType}. The primary objective is to ${objective}.

PROJECT OBJECTIVES

• Establish a clear project direction
• Create alignment between goals and deliverables
• Develop a professional execution roadmap
• Prepare the project for expert review or implementation

TARGET AUDIENCE / USERS

To be refined during the next phase of discovery.

CREATIVE DIRECTION

${style}

RECOMMENDED SCOPE

${deliverables}

KEY CONSIDERATIONS

• Confirm audience and stakeholder requirements
• Validate timeline expectations
• Review technical or production constraints
• Prioritize deliverables based on business impact

RECOMMENDED NEXT STEPS

1. Refine project requirements
2. Validate scope and priorities
3. Explore creative directions
4. Prepare implementation strategy
5. Review with an expert if required

EXPERT RECOMMENDATION

Based on the information provided, we recommend starting with a ${expertRecommendation} review.

HEYY STUDIO NOTES

This brief is an AI-generated project foundation designed to accelerate discovery, planning and expert collaboration.
`;
}

export async function POST(req: Request) {
  try {
    const { messages, forceSummary, userId } = await req.json();

let plan = "free";

if (userId) {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (data?.plan) {
    plan = data.plan;
  }
}

const selectedModel = getModelForPlan(plan);

console.log("Heyy Studio AI plan:", plan);
console.log("Heyy Studio AI model:", selectedModel);

    if (forceSummary) {
      const userAnswers = messages
        .filter((msg: any) => msg.role === "user")
        .map((msg: any) => msg.content);

      return NextResponse.json({
        message: buildProjectBrief(userAnswers),
        options: ["Continue with AI", "Get Expert Review", "Start again"],
      });
    }

    console.error("OPENAI CALLED WITH:", selectedModel);
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      max_completion_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
    });

    const content = completion.choices[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(content);

      return NextResponse.json({
        message: parsed.message || "Tell me more about your project.",
        options:
          Array.isArray(parsed.options) && parsed.options.length > 0
            ? parsed.options
            : ["Branding", "Website", "Interior Design", "Something Else"],
      });
    } catch {
      return NextResponse.json({
        message: "Tell me more about your project.",
        options: ["Branding", "Website", "Interior Design", "Something Else"],
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