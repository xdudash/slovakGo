import { registerPlugin } from "@capacitor/core";
import { apiClient } from "./apiClient";

interface AppleAuthorization {
  cancelled?: boolean;
  identityToken?: string;
  authorizationCode?: string;
  givenName?: string;
  familyName?: string;
}
/** Native sheet: ios/App/App/AppleSignInPlugin.swift. */
const AppleSignIn = registerPlugin<{ authorize(): Promise<AppleAuthorization> }>("SlovakGoAppleSignIn");

/** Opens Apple's sheet and starts a server session. Returns null when the learner cancels. */
export async function signInWithApple(): Promise<{ isNew: boolean } | null> {
  const auth = await AppleSignIn.authorize();
  if (auth.cancelled || !auth.identityToken) return null;
  const { isNew } = await apiClient.appleSignIn({
    identityToken: auth.identityToken,
    authorizationCode: auth.authorizationCode,
    givenName: auth.givenName,
    familyName: auth.familyName,
  });
  return { isNew };
}
