/**
 * Server-side generation of one-time email sign-in links.
 *
 * We generate the passwordless sign-in link with firebase-admin (tenant-aware)
 * instead of the client SDK's `sendSignInLinkToEmail`, so we fully control the
 * surrounding email (design, copy, deliverability) — the link is generated here
 * and sent via our own email-service, never by Firebase's default template.
 *
 * Requires the Students tenant to have the **Email Link (passwordless)** sign-in
 * provider enabled (deploy prerequisite — see docs/marketing/launch-checklist.md).
 */
import { studentAuth } from "./firebase";
import { TENANT_IDS } from "../routes/auth";

const FRONTEND_URL = (
  process.env.FRONTEND_URL || "https://community.tailed.ca"
).replace(/\/+$/, "");

/**
 * Generates a one-time sign-in link for `email`. The continue URL points at the
 * frontend `/auth/callback`, carrying the tenantId and the email so
 * `completeSignIn()` can finish sign-in even cross-device (a link clicked in a
 * mail app on another device has no `emailForSignIn` in localStorage). The oobCode
 * embedded in the link — not the email — is the secret, so passing the email on
 * the continue URL is the standard Firebase cross-device pattern.
 *
 * @param email       Address the link signs in (and, for new emails, creates).
 * @param redirectPath In-app path to land on after sign-in (default /dashboard).
 */
export async function buildSignInLink(
  email: string,
  redirectPath = "/dashboard"
): Promise<string> {
  const tenantId = TENANT_IDS.STUDENTS;
  const continueUrl =
    `${FRONTEND_URL}/auth/callback` +
    `?tenantId=${encodeURIComponent(tenantId)}` +
    `&email=${encodeURIComponent(email)}` +
    `&redirectUrl=${encodeURIComponent(redirectPath)}`;

  const auth = await studentAuth();
  return auth.generateSignInWithEmailLink(email, {
    url: continueUrl,
    handleCodeInApp: true,
  });
}
