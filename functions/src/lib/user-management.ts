import { auth, studentAuth, db } from "./firebase";

export interface UpsertUserResult {
  userRecord: any; // Firebase UserRecord
  wasCreated: boolean;
  error?: string;
}

export interface UpsertUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Upsert a student user account
 * - If user exists, returns existing user
 * - If user doesn't exist, creates new user and profile
 * @param input User information (email is required)
 * @returns Result object with user record and creation status
 */
export async function upsertStudentUser(
  input: UpsertUserInput
): Promise<UpsertUserResult> {
  const { email, firstName, lastName } = input;
  const emailLower = email.toLowerCase();

  try {
    // Check if user already exists
    let userRecord;
    let wasCreated = false;

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
            displayName: firstName && lastName ? `${firstName} ${lastName}` : undefined,
          });
          wasCreated = true;

          // Create profile document for new user
          await db.collection("profiles").doc(userRecord.uid).set({
            userId: userRecord.uid,
            email: emailLower,
            firstName: firstName || "",
            lastName: lastName || "",
            initials: firstName && lastName 
              ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
              : emailLower.charAt(0).toUpperCase(),
            communities: [],
            appliedJobs: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (createError: any) {
          return {
            userRecord: null,
            wasCreated: false,
            error: `Failed to create account: ${createError.message}`,
          };
        }
      } else {
        return {
          userRecord: null,
          wasCreated: false,
          error: `Failed to check user: ${error.message}`,
        };
      }
    }

    // If user exists but we have additional info, update their profile
    if (!wasCreated && (firstName || lastName)) {
      try {
        const profileRef = db.collection("profiles").doc(userRecord.uid);
        const profileDoc = await profileRef.get();
        
        if (profileDoc.exists) {
          const profileData = profileDoc.data();
          const updates: any = { updatedAt: new Date() };
          
          // Only update if we have more info than what's stored
          if (firstName && !profileData?.firstName) {
            updates.firstName = firstName;
          }
          if (lastName && !profileData?.lastName) {
            updates.lastName = lastName;
          }
          
          // Update initials if we updated names
          if (updates.firstName || updates.lastName) {
            const first = updates.firstName || profileData?.firstName;
            const last = updates.lastName || profileData?.lastName;
            if (first && last) {
              updates.initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
            }
          }
          
          if (Object.keys(updates).length > 1) { // More than just updatedAt
            await profileRef.update(updates);
          }
        }
      } catch (updateError) {
        // Non-critical error, log but don't fail
        console.warn(`Failed to update profile for ${emailLower}:`, updateError);
      }
    }

    return {
      userRecord,
      wasCreated,
    };
  } catch (error: any) {
    return {
      userRecord: null,
      wasCreated: false,
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
