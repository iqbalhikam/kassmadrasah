import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { getDatabaseData } from "@/lib/google/sheets";
import { SettingsClient } from "@/components/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  let initialData = null;
  let initialError = "";

  try {
    initialData = await getDatabaseData();
  } catch (error: any) {
    console.error("Settings SSR fetch error:", error);
    initialError = error.message || "Gagal memuat pengaturan dari Google Sheets.";
  }

  return <SettingsClient initialData={initialData} initialError={initialError} />;
}
