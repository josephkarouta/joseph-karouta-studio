import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing from the server environment.");

  client = new OpenAI({ apiKey });
  return client;
}
