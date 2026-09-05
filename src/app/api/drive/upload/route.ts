import { NextResponse } from "next/server";
import { uploadReceiptToDrive } from "@/lib/google/drive";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `NOTA-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const driveUrl = await uploadReceiptToDrive(buffer, fileName, file.type || "application/octet-stream");

    return NextResponse.json({ url: driveUrl });
  } catch (error: any) {
    console.error("Upload to Drive error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengunggah berkas ke Google Drive" },
      { status: 500 }
    );
  }
}
