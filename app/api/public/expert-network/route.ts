import { checkExpertNetworkEmail, listExpertNetworkPositions, submitExpertNetworkApplication } from "@/lib/expert-network/public-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode === "email-check") return checkExpertNetworkEmail(request);
  return listExpertNetworkPositions();
}

export async function POST(request: Request) {
  return submitExpertNetworkApplication(request);
}
