import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { getDatabaseData } from "@/lib/google/sheets";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  let initialData = null;
  let initialError = "";

  try {
    initialData = await getDatabaseData();
  } catch (error: any) {
    console.error("Dashboard SSR fetch error:", error);
    initialError = error.message || "Gagal memuat data dari Google Sheets.";
  }

  return <DashboardClient initialData={initialData} initialError={initialError} />;
}
