import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth";

const FOLDER_NAME = "[Nota Kas Madrasah]";

export async function uploadReceiptToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const auth = await getGoogleAuthClient();
  const drive = google.drive({ version: "v3", auth });

  // 1. Get or create target folder
  let folderId = "";
  const folderSearch = await drive.files.list({
    q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (folderSearch.data.files && folderSearch.data.files.length > 0) {
    folderId = folderSearch.data.files[0].id!;
  } else {
    const folderCreate = await drive.files.create({
      requestBody: {
        name: FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    folderId = folderCreate.data.id!;
  }

  // 2. Upload file into folder
  const fileRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: fileBuffer, // Pass buffer directly instead of creating a stream
    },
    fields: "id, webViewLink, webContentLink",
  });

  const fileId = fileRes.data.id;
  
  if (!fileId) {
    throw new Error("Gagal mengunggah berkas: File ID tidak diterima dari Google Drive");
  }

  // 3. Make file readable by anyone with link
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
  } catch (err: any) {
    console.warn("Gagal mengubah izin file ke publik:", err.message || err);
  }

  return fileRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

}
