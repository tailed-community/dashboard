/**
 * Grant/revoke the `platformAdmin` custom claim for a student-tenant user.
 *
 * This claim gates the `requirePlatformAdmin` middleware (see
 * `../lib/firebase.ts`) that protects the community/event moderation queues
 * and review endpoints.
 *
 * Usage (from functions/, after `npm run build`):
 *   node lib/scripts/set-platform-admin.js <email>            # grant
 *   node lib/scripts/set-platform-admin.js <email> --revoke    # revoke
 *
 * Uses the same tenant-scoped auth instance as the app's own token
 * verification (`studentAuth()` / FB_TENANT_ID), so the claim lands on the
 * exact user record the app authenticates against — not the default
 * (non-tenant) Firebase Auth instance.
 */
import { studentAuth } from "../lib/firebase";

async function main() {
  const [, , email, ...rest] = process.argv;
  const revoke = rest.includes("--revoke");

  if (!email || email.startsWith("--")) {
    console.error("Usage: node lib/scripts/set-platform-admin.js <email> [--revoke]");
    process.exit(1);
  }

  const tenantAuth = await studentAuth();

  let userRecord;
  try {
    userRecord = await tenantAuth.getUserByEmail(email);
  } catch (error) {
    console.error(`Could not find a student-tenant user with email "${email}".`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
    return;
  }

  const existingClaims = userRecord.customClaims || {};
  const updatedClaims = {
    ...existingClaims,
    platformAdmin: revoke ? false : true,
  };

  await tenantAuth.setCustomUserClaims(userRecord.uid, updatedClaims);

  console.log(
    `${revoke ? "Revoked" : "Granted"} platformAdmin for ${email} (uid: ${userRecord.uid}).`
  );
  console.log("Preserved existing custom claims:", existingClaims);
  console.log("New custom claims:", updatedClaims);
  console.log(
    "\nNote: custom claims only take effect on the user's NEXT ID token. " +
      "They must sign out/in again, or the client must force-refresh the ID " +
      "token (e.g. `firebaseUser.getIdToken(true)`), before platformAdmin " +
      "access (or its removal) is reflected on the backend."
  );
}

main().catch((error) => {
  console.error("Failed to update platformAdmin claim:", error);
  process.exit(1);
});
