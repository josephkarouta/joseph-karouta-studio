import { listExpertNetworkPositions, submitExpertNetworkApplication } from "@/lib/expert-network/public-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return listExpertNetworkPositions();
}

export async function POST(request: Request) {
  return submitExpertNetworkApplication(request);
}
