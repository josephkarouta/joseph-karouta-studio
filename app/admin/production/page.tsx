import { redirect } from "next/navigation";

export default function AdminProductionPage() {
  redirect("/admin?tab=production");
}
