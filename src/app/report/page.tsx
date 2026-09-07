import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { getDatabaseData } from "@/lib/google/sheets";
import { ReportClient } from "@/components/report/report-client";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  let initialData = null;
  let initialError = "";

  try {
    initialData = await getDatabaseData();
  } catch (error: any) {
    console.error("Report SSR fetch error:", error);
    initialError = error.message || "Gagal memuat data laporan dari Google Sheets.";
  }

  return <ReportClient initialData={initialData} initialError={initialError} />;
}
