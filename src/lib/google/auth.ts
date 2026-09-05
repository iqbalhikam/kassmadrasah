import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function getGoogleAuthClient() {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    throw new Error("UNAUTHORIZED: Sesi login Google tidak ditemukan atau token kedaluwarsa.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  return oauth2Client;
}
