/**
 * Server-side generation of one-time email sign-in links.
 *
 * We generate the passwordless sign-in link with firebase-admin instead of the
 * client SDK's `sendSignInLinkToEmail`, so we fully control the surrounding
 * email (design, copy, deliverability) — the link is generated here and sent
 * via our own email-service, never by Firebase's default template.
 *
 * Requires the project to have the **Email Link (passwordless)** sign-in
 * provider enabled (deploy prerequisite — see docs/marketing/launch-checklist.md).
 */
import { auth } from "./firebase";
import { authContinueUrl } from "./env";

/**
 * Generates a one-time sign-in link for `email`. The continue URL points at the
 * frontend `/auth/callback`, carrying the email so `completeSignIn()` can finish
 * sign-in even cross-device (a link clicked in a mail app on another device has
 * no `emailForSignIn` in localStorage). The oobCode embedded in the link — not
 * the email — is the secret, so passing the email on the continue URL is the
 * standard Firebase cross-device pattern.
 *
 * No `tenantId` is emitted: this project uses the default auth pool. The old
 * code serialized `encodeURIComponent(undefined)` here, putting the literal
 * string "undefined" on the URL, which made the frontend set
 * `auth.tenantId = "undefined"` and fail with `auth/tenant-id-mismatch`.
 *
 * @param email        Address the link signs in (and, for new emails, creates).
 * @param redirectPath In-app path to land on after sign-in (default /dashboard).
 */
export async function buildSignInLink(
  email: string,
  redirectPath = "/dashboard"
): Promise<string> {
  const continueUrl =
    `${authContinueUrl()}/auth/callback` +
    `?email=${encodeURIComponent(email)}` +
    `&redirectUrl=${encodeURIComponent(redirectPath)}`;

  return auth.generateSignInWithEmailLink(email, {
    url: continueUrl,
    handleCodeInApp: true,
  });
}
