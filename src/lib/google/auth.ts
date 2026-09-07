import { google, Auth } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Define a new interface that extends OAuth2Client with userEmail
interface GoogleAuthClientWithUserEmail extends Auth.OAuth2Client {
  userEmail: string;
}

export async function getGoogleAuthClient(): Promise<GoogleAuthClientWithUserEmail> {
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
    ...(session.refreshToken && { refresh_token: session.refreshToken }),
  });

  const authClientWithEmail = oauth2Client as GoogleAuthClientWithUserEmail;
  if (!session.user?.email) {
    throw new Error("UNAUTHORIZED: User email not found in session.");
  }
  authClientWithEmail.userEmail = session.user.email;

  return authClientWithEmail;
}
