# GitHub Copilot Instructions

## Project Architecture Overview

This is a full-stack TypeScript application with:
- **Frontend**: React + Vite + TypeScript in `src/` folder
- **Backend**: Express + Firebase Functions in `functions/` folder
- **Database**: Firestore (accessed via API endpoints only)
- **Authentication**: Firebase Auth

## Critical Architecture Principles

### NO Direct Firestore Access from Frontend
- Frontend MUST NOT import or use Firestore SDK directly
- All database operations MUST go through API endpoints
- Use `apiFetch()` from `src/lib/fetch.ts` for all API calls
- Public data uses `/public/*` endpoints (no auth required)
- Protected data uses authenticated endpoints (`/communities`, `/events`, etc.)

### Authentication Flow
- Frontend: Firebase Auth client SDK for user authentication
- Backend: Verify Firebase ID tokens via `decodedToken()` middleware
- User ID extracted from `req.user.uid` (set by middleware from decoded token)

## Folder Structure

### Frontend (`src/`)
\`\`\`
src/
├── pages/           # Navigation routes and visual pages
│   ├── (auth)/     # Authentication pages
│   ├── (dashboard)/ # Protected dashboard pages
│   ├── communities/ # Community listing and details
│   ├── events/     # Event listing and details
│   ├── landing/    # Public landing page
│   └── explore/    # Explore/discover page
├── components/     # Reusable UI components
│   ├── ui/         # shadcn/ui components
│   ├── community/  # Community-specific components
│   └── layout/     # Layout components (sidebar, header, etc.)
├── lib/            # Utilities and libraries
│   ├── fetch.ts    # API fetching utilities (USE THIS!)
│   ├── auth.ts     # Auth helpers
│   └── utils.ts    # General utilities
├── types/          # TypeScript type definitions
│   └── jobs.ts     # Types for API responses
└── hooks/          # React hooks
    └── use-auth.ts # Authentication hook
\`\`\`

### Backend (`functions/src/`)
\`\`\`
functions/src/
├── routes/         # API route handlers
│   ├── auth.ts     # Authentication endpoints
│   ├── community.ts # Community CRUD + join/leave
│   ├── event.ts    # Event CRUD + attendees
│   ├── public.ts   # Unauthenticated public endpoints
│   ├── profile.ts  # User profile endpoints
│   └── ...
├── lib/            # Backend utilities
│   ├── firebase.ts # Firebase Admin SDK setup
│   └── email-service.ts # Email utilities
└── index.ts        # Main Express app + route registration
\`\`\`

## Development Workflow

### Before Making Changes

1. **Understand the scope**: Identify if changes affect UI, backend, or both
2. **Check existing patterns**: Look for similar implementations
3. **Plan incrementally**: Break work into logical steps
4. **No auto-compilation**: Do NOT run \`npm run build\` - we review code first

### When Adding New Features

#### Step-by-Step Approach:

**Step 1: Define the Scope**
- [ ] Identify affected areas (UI only, backend only, or both)
- [ ] List specific files that need changes
- [ ] Document expected behavior

**Step 2: Backend Changes (if needed)**
- [ ] Create/update API endpoints in \`functions/src/routes/\`
- [ ] Add validation schemas using \`zod\`
- [ ] Implement proper authentication/authorization
- [ ] Handle file uploads with \`Busboy\` if needed
- [ ] Return consistent response format: \`{ success: boolean, data/error: any }\`

**Step 3: Type Definitions (if backend changed)**
- [ ] Update/create types in \`src/types/\`
- [ ] Ensure types match backend response structure
- [ ] Export types for use in components

**Step 4: Frontend Changes**
- [ ] Update/create pages in \`src/pages/\`
- [ ] Extract reusable logic into components in \`src/components/\`
- [ ] Use \`apiFetch()\` for all API calls
- [ ] Handle loading, error, and success states
- [ ] Update UI with proper feedback (toast notifications)

**Step 5: Review**
- [ ] Check for TypeScript errors
- [ ] Verify no direct Firestore imports in frontend
- [ ] Ensure consistent error handling
- [ ] Confirm authentication is properly implemented

## API Endpoint Patterns

### Creating New Backend Endpoints

\`\`\`typescript
// functions/src/routes/example.ts
import { Router, Request, Response } from "express";
import { db, storage } from "../lib/firebase";
import { z } from "zod";

const router = Router();

// Validation schema
const createSchema = z.object({
  name: z.string().min(3).max(100),
  // ... more fields
});

/**
 * GET /example
 * Description of what this endpoint does
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    // Implementation
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Failed to perform operation",
      details: error.message,
    });
  }
});

/**
 * POST /example
 * Description - requires authentication
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request
    const validationResult = createSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;
    // Perform operation
    
    return res.status(201).json({
      success: true,
      message: "Created successfully",
    });
  } catch (error: any) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Failed to create",
      details: error.message,
    });
  }
});

export default router;
\`\`\`

### Register Route in \`functions/src/index.ts\`

\`\`\`typescript
import exampleRouter from "./routes/example";

// Public routes (no auth)
app.use("/public", publicRouter);

// Protected routes (requires auth)
app.use("/example", decodedToken(), exampleRouter);
\`\`\`

### Frontend API Calls

\`\`\`typescript
// In a React component
import { apiFetch } from "@/lib/fetch";

// GET request
const response = await apiFetch("/endpoint");
const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || "Request failed");
}

// POST request with body
const response = await apiFetch("/endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "value" }),
});

// For public endpoints (3rd parameter = true)
const response = await apiFetch("/public/endpoint", {}, true);
\`\`\`

## File Upload Pattern

### Backend (multipart/form-data)

\`\`\`typescript
import Busboy from "busboy";

router.post("/upload", async (req: Request, res: Response) => {
  const contentType = req.headers["content-type"] || "";
  
  if (!contentType.includes("multipart/form-data")) {
    return res.status(400).json({ error: "Invalid content type" });
  }

  const busboy = Busboy({ headers: req.headers as any });
  const fields: any = {};
  const fileUploads: Promise<string>[] = [];

  busboy.on("field", (fieldname, val) => {
    fields[fieldname] = val;
  });

  busboy.on("file", (fieldname, file, info) => {
    const { filename, mimeType } = info;
    
    if (!mimeType.startsWith("image/")) {
      file.resume();
      return;
    }

    const filepath = \`uploads/\${Date.now()}-\${filename}\`;
    const blob = storage.bucket().file(filepath);
    
    const uploadPromise = new Promise<string>((resolve, reject) => {
      file.pipe(blob.createWriteStream({
        metadata: { contentType: mimeType },
      }))
      .on("error", reject)
      .on("finish", async () => {
        await blob.makePublic();
        const publicUrl = \`https://storage.googleapis.com/\${storage.bucket().name}/\${filepath}\`;
        fields[fieldname] = publicUrl;
        resolve(publicUrl);
      });
    });

    fileUploads.push(uploadPromise);
  });

  busboy.on("finish", async () => {
    await Promise.all(fileUploads);
    // Process fields...
  });

  req.pipe(busboy);
});
\`\`\`

### Frontend (FormData)

\`\`\`typescript
const formData = new FormData();
formData.append("name", "value");
formData.append("file", fileInput.files[0]);

const response = await apiFetch("/upload", {
  method: "POST",
  body: formData,
  // Don't set Content-Type - browser sets it with boundary
});
\`\`\`

## Common Patterns

### Loading States

\`\`\`typescript
const [loading, setLoading] = useState(true);
const [data, setData] = useState<DataType[]>([]);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiFetch("/endpoint");
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error);
      }
      
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);
\`\`\`

### User Feedback

\`\`\`typescript
import { toast } from "sonner";

// Success
toast.success("Operation completed", {
  description: "Details about success",
});

// Error
toast.error("Operation failed", {
  description: error.message,
});

// Loading with promise
toast.promise(asyncOperation(), {
  loading: "Processing...",
  success: "Completed!",
  error: "Failed to complete",
});
\`\`\`

## Best Practices

### ✅ DO

- Use \`apiFetch()\` for all API calls
- Validate input with \`zod\` on backend
- Return consistent response formats
- Handle errors gracefully
- Use TypeScript types everywhere
- Extract reusable components
- Keep components focused and small
- Use proper HTTP status codes
- Log errors with context
- Provide user feedback (toast notifications)

### ❌ DON'T

- Import Firestore SDK in frontend code
- Skip validation on backend
- Expose sensitive data in API responses
- Use \`any\` type without good reason
- Mix business logic with UI components
- Forget error handling
- Run \`npm run build\` before code review
- Make large monolithic changes
- Skip authentication checks

## Security Checklist

- [ ] Authentication required? Use \`decodedToken()\` middleware
- [ ] Authorization checked? Verify user owns resource
- [ ] Input validated? Use \`zod\` schemas
- [ ] Sensitive data filtered? Remove private fields from responses
- [ ] File uploads validated? Check file type and size
- [ ] Rate limiting considered? For expensive operations
- [ ] SQL injection protected? Use parameterized queries (Firestore handles this)
- [ ] XSS prevented? React handles this by default

## Testing Considerations

When implementing new features:
1. Test unauthenticated access (should fail appropriately)
2. Test with different user roles (creator vs member)
3. Test edge cases (empty data, missing fields)
4. Test error scenarios (network failures, invalid data)
5. Verify Firestore rules block direct access

## Environment Variables

Backend uses these from \`.env\`:
- \`FB_API_KEY\` - Firebase API key
- \`FB_AUTH_DOMAIN\` - Firebase auth domain
- \`FB_PROJECT_ID\` - Firebase project ID
- \`FB_STORAGE_BUCKET\` - Firebase storage bucket
- \`WEB_APP_URL\` - Frontend URL for emails/redirects

## Common Commands

\`\`\`bash
# Frontend development
npm run dev

# Backend development (emulators)
cd functions && npm run serve

# Deploy backend only
cd functions && firebase deploy --only functions

# Deploy everything
firebase deploy
\`\`\`

## When Stuck

1. Check similar existing implementations
2. Review API endpoint documentation in route files
3. Check \`src/lib/fetch.ts\` for API call patterns
4. Look at existing page components for UI patterns
5. Review backend middleware in \`functions/src/index.ts\`
6. Check Firestore rules in \`firestore.rules\`

## Questions to Ask Before Coding

1. Does this require a new API endpoint or modify existing?
2. What authentication/authorization is needed?
3. What data needs to be validated?
4. What types need to be defined/updated?
5. What user feedback is needed?
6. Are there existing similar features to reference?
7. Is this a breaking change that affects multiple areas?

---

**Remember**: Always think step-by-step, understand the full scope, and make incremental changes!
