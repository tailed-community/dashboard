import {
  GithubAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";

/**
 * Shared GitHub-connect popup flow (account page + job application form).
 *
 * SAFETY INVARIANT: this never changes which user is signed in. Both branches
 * operate on the user passed in — `linkWithPopup` attaches the identity to that
 * user, `reauthenticateWithPopup` re-verifies that same user. Neither can swap
 * `auth.currentUser`.
 *
 * The previous inline implementation (duplicated in three files) recovered from
 * `auth/credential-already-in-use` by calling `signInWithCredential()`, which
 * silently signed the visitor into whichever account already owned the GitHub
 * identity. The page kept rendering — and then SAVING — the previous account's
 * state, so one account's fields (including its email) were written onto the
 * other account's uid. That recovery path is gone: a GitHub identity owned by a
 * different account is now a surfaced error, not a silent account switch.
 */

/** Shown when the GitHub identity belongs to a different Tail'ed account. */
export const GITHUB_ALREADY_LINKED_MESSAGE =
  "This GitHub account is already connected to another Tail'ed account. Sign in with that account and disconnect it there first.";

/** Shown when re-verifying, but the popup authenticated a different GitHub user. */
export const GITHUB_USER_MISMATCH_MESSAGE =
  "That GitHub account doesn't match the one connected to your profile. Use the GitHub account you originally connected.";

/** True when the signed-in user already has github.com among its providers. */
export function hasGithubProvider(user: User | null | undefined): boolean {
  return !!user?.providerData?.some((p) => p.providerId === "github.com");
}

/** The provider we request everywhere, with the scopes our GitHub API calls need. */
function buildGithubProvider(): GithubAuthProvider {
  const provider = new GithubAuthProvider();
  provider.addScope("read:user");
  provider.addScope("read:org");
  return provider;
}

/**
 * Run the GitHub popup for `user` and return a fresh OAuth access token.
 *
 * @throws Error with a user-facing message when the identity is owned by another
 * account or doesn't match the linked one; other Firebase errors bubble up
 * unchanged so callers keep their existing handling (popup closed, blocked, …).
 */
export async function connectGithubForUser(user: User): Promise<string | null> {
  const provider = buildGithubProvider();
  const alreadyLinked = hasGithubProvider(user);

  try {
    const result = alreadyLinked
      ? // Already linked: linkWithPopup would throw auth/provider-already-linked,
        // so re-verify instead. This also returns a fresh access token.
        await reauthenticateWithPopup(user, provider)
      : await linkWithPopup(user, provider);

    return GithubAuthProvider.credentialFromResult(result)?.accessToken ?? null;
  } catch (error) {
    if (error instanceof FirebaseError) {
      if (
        error.code === "auth/credential-already-in-use" ||
        error.code === "auth/email-already-in-use" ||
        error.code === "auth/account-exists-with-different-credential"
      ) {
        throw new Error(GITHUB_ALREADY_LINKED_MESSAGE);
      }
      if (error.code === "auth/user-mismatch") {
        throw new Error(GITHUB_USER_MISMATCH_MESSAGE);
      }
    }
    throw error;
  }
}
