import { auth, studentAuth, db } from "./firebase";

export interface UpsertUserResult {
  userRecord: any; // Firebase UserRecord
  /**
   * @deprecated Alias for `authUserCreated`, kept so existing call sites
   * (which expect "a new Firebase Auth account was created") keep working.
   * Prefer `authUserCreated` / `profileCreated` explicitly in new code.
   */
  wasCreated: boolean;
  authUserCreated: boolean; // true if a new Firebase Auth account was created
  profileCreated: boolean; // true if a new `profiles/{uid}` doc was created
  profileComplete: boolean; // has firstName && school && program
  error?: string;
}

export interface UpsertUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  /**
   * When the Firebase Auth user is already known to exist (e.g. the uid came
   * from a verified ID token), pass it here to skip the Auth lookup/creation
   * step entirely and go straight to ensuring the Firestore profile doc.
   */
  uid?: string;
  profileSource?: "google" | "email" | "import" | "alert_capture";
  /**
   * Communication-language preference (spec 08 §5). Optional so existing
   * callers are unaffected; seeded to "en" when a new profile doc is created.
   */
  preferredLanguage?: "en" | "fr";
}

const deriveInitials = (
  firstName?: string,
  lastName?: string,
  email?: string
): string => {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (firstName) {
    return firstName.charAt(0).toUpperCase();
  }
  return (email || "").charAt(0).toUpperCase() || "U";
};

const isProfileComplete = (data: Record<string, any> | undefined): boolean => {
  return !!(data?.firstName && data?.school && data?.program);
};

/**
 * Upsert a student user account
 * - Ensures a Firebase Auth user exists (by email lookup, or trusts the
 *   provided `uid` when the caller already verified the token).
 * - Ensures a `profiles/{uid}` Firestore doc exists (lenient shape: only
 *   email is required). Never overwrites fields that are already set.
 * @param input User information (email is required)
 * @returns Result object with user record, creation status, and profile completeness
 */
export async function upsertStudentUser(
  input: UpsertUserInput
): Promise<UpsertUserResult> {
  const { email, firstName, lastName, photoURL, uid, profileSource, preferredLanguage } =
    input;
  const emailLower = email.toLowerCase();

  try {
    let userRecord: any;
    let authUserCreated = false;

    if (uid) {
      // Auth user already verified to exist (e.g. via decoded ID token) — skip lookup.
      userRecord = { uid, email: emailLower };
    } else {
      try {
        userRecord = await auth.getUserByEmail(emailLower);
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          // Create new user account
          try {
            const tenantAuth = await studentAuth();
            userRecord = await tenantAuth.createUser({
              email: emailLower,
              emailVerified: false,
              displayName:
                firstName && lastName ? `${firstName} ${lastName}` : undefined,
            });
            authUserCreated = true;
          } catch (createError: any) {
            return {
              userRecord: null,
              wasCreated: false,
              authUserCreated: false,
              profileCreated: false,
              profileComplete: false,
              error: `Failed to create account: ${createError.message}`,
            };
          }
        } else {
          return {
            userRecord: null,
            wasCreated: false,
            authUserCreated: false,
            profileCreated: false,
            profileComplete: false,
            error: `Failed to check user: ${error.message}`,
          };
        }
      }
    }

    const profileRef = db.collection("profiles").doc(userRecord.uid);
    const profileDoc = await profileRef.get();
    let profileCreated = false;
    let profileData: Record<string, any>;

    if (!profileDoc.exists) {
      profileCreated = true;
      profileData = {
        userId: userRecord.uid,
        email: emailLower,
        firstName: firstName || "",
        lastName: lastName || "",
        photoURL: photoURL || null,
        initials: deriveInitials(firstName, lastName, emailLower),
        communities: [],
        appliedJobs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        profileSource: profileSource || "email",
        // Communication language always exists on the doc (spec 08 §5); defaults
        // to English, overridden later by the browser-language client bootstrap.
        preferredLanguage: preferredLanguage || "en",
      };
      await profileRef.set(profileData);
    } else {
      profileData = profileDoc.data() || {};

      // Only fill in fields that are missing — never overwrite existing data.
      const updates: Record<string, any> = {};
      if (firstName && !profileData.firstName) updates.firstName = firstName;
      if (lastName && !profileData.lastName) updates.lastName = lastName;
      if (photoURL && !profileData.photoURL) updates.photoURL = photoURL;

      if (Object.keys(updates).length > 0) {
        const first = updates.firstName || profileData.firstName;
        const last = updates.lastName || profileData.lastName;
        if (first && last) {
          updates.initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
        }
        updates.updatedAt = new Date();

        try {
          await profileRef.update(updates);
          profileData = { ...profileData, ...updates };
        } catch (updateError) {
          // Non-critical error, log but don't fail
          console.warn(`Failed to update profile for ${emailLower}:`, updateError);
        }
      }
    }

    return {
      userRecord,
      wasCreated: authUserCreated,
      authUserCreated,
      profileCreated,
      profileComplete: isProfileComplete(profileData),
    };
  } catch (error: any) {
    return {
      userRecord: null,
      wasCreated: false,
      authUserCreated: false,
      profileCreated: false,
      profileComplete: false,
      error: `Unexpected error: ${error.message}`,
    };
  }
}

/**
 * Bulk upsert multiple student users
 * @param users Array of user information
 * @returns Results for each user
 */
export async function bulkUpsertStudentUsers(
  users: UpsertUserInput[]
): Promise<UpsertUserResult[]> {
  const results: UpsertUserResult[] = [];
  
  for (const user of users) {
    const result = await upsertStudentUser(user);
    results.push(result);
  }
  
  return results;
}
