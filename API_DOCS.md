# Bankole API Documentation (Swagger-style)

**Base URL**: `http://localhost:8000/api/v1` (Dev) / `https://<host>/api/v1` (Prod)
**Content-Type**: `application/json; charset=utf-8` (Except file uploads: `multipart/form-data`)

All API routes (except where noted) require an `Authorization: Bearer <access_token>` header. If your token expires, you must use the `POST /auth/refresh` endpoint to get a new one.

---

## Global Response Schemas

### Standardized Error Responses
Any failure returns a consistent error envelope.
```json
{
  "error": {
    "code": "validation_error",
    "message": "At least one milestone is required.",
    "field": "milestones",
    "details": []
  }
}
```
* **400 Bad Request**: Validation errors or malformed JSON.
* **401 Unauthorized**: Missing or expired Bearer token.
* **403 Forbidden**: Caller does not have the required role (e.g., Agent trying to approve a milestone).
* **404 Not Found**: Resource doesn't exist or doesn't belong to the caller.
* **409 Conflict**: Resource conflict (e.g., Email already exists, or no proofs attached to a milestone submission).
* **429 Too Many Requests**: Rate limit exceeded (Expect standard `Retry-After` header).
* **500 Internal Server Error**: Unhandled backend exception.

### Pagination Envelope (Collections)
List endpoints return a data array and a `meta` object.
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

---

## Enumerations
* **role**: `sender` | `agent`
* **assetType**: `house` | `shop` | `clinic` | `borehole` | `school` | `land` | `community`
* **projectStatus**: `on_track` | `awaiting_review` | `attention_needed` | `completed`
* **milestoneStatus**: `pending` | `in_progress` | `proof_submitted` | `approved` | `released` | `flagged`
* **proofType**: `photo` | `video`
* **proofStatus**: `pending_review` | `approved` | `flagged`
* **currency**: `NGN`

---

## 1. Authentication

### `POST /auth/register`
Creates a new user and returns a token pair.
- **Headers**: None
- **Body (JSON)**:
  - `fullName` (string, required): Full name of the user.
  - `email` (string, required): Valid, unique email address (Returns 409 if exists).
  - `password` (string, required): Minimum 8 characters.
  - `role` (enum: `"sender" | "agent"`, required).
  - `country` (string, required): ISO country code (e.g., "NG", "GB").
- **Response `201 Created`**:
  ```json
  {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600,
    "user": {
      "id": "...",
      "fullName": "...",
      "email": "...",
      "role": "sender",
      "country": "GB"
    }
  }
  ```

### `POST /auth/login`
Authenticates an existing user.
- **Headers**: None
- **Body (JSON)**:
  - `email` (string, required): The user's registered email.
  - `password` (string, required): The user's password.
- **Response `200 OK`**: Same payload structure as `/auth/register`.

### `GET /auth/me`
Fetches the currently authenticated user's profile.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Required)
- **Response `200 OK`**: The fully hydrated User profile object.

### `PATCH /auth/me`
Updates the authenticated user's profile.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Required)
- **Body (JSON)**:
  - `fullName` (string, optional): Update the user's name.
  - `country` (string, optional): Update the user's country code.
  - `bio` (string, optional): Agent's biography *(Silently ignored if caller is a Sender)*.
  - `specialties` (array of strings, optional): List of construction specialties *(Agent only)*.
  - `yearsExperience` (number, optional): Total years of experience *(Agent only)*.
  - `avatarUrl` (string, optional): URL to a hosted avatar image *(Agent only)*.
- **Response `200 OK`**: Fully hydrated profile object including `agentDetails`.

### `POST /auth/refresh`
Refreshes an expired access token.
- **Headers**: None
- **Body (JSON)**:
  - `refreshToken` (string, required): A valid, unexpired refresh token.
- **Response `200 OK`**: 
  ```json
  { 
    "accessToken": "...", 
    "refreshToken": "..." 
  }
  ```

---

## 2. Agents

### `GET /agents`
Searches the directory of agents.
- **Headers**: None (Public endpoint)
- **Query Parameters**:
  - `q` (string, optional): Free text search.
  - `specialty` (string, optional, repeatable): e.g., `?specialty=house`.
  - `location` (string, optional): Search by location string.
  - `minRating` (number, optional): Minimum rating (0.0 to 5.0).
  - `verifiedOnly` (boolean, optional): Defaults to true.
  - `sort` (enum: `"rating" | "experience" | "projects"`, optional).
- **Response `200 OK`**: Envelope `{ "data": [...], "meta": {...} }`.

### `GET /agents/:id`
Fetches a single agent's comprehensive profile.
- **Headers**: None (Public endpoint)
- **Response `200 OK`**: Agent object containing embedded `credentials`, `portfolio`, and `reviews` arrays.

### `POST /agents/:id/reviews`
Rates an agent (calculates cumulative moving average atomically).
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  - `quote` (string, required): The text review explaining the rating.
  - `rating` (number, required): Integer from 1 to 5.
- **Response `201 Created`**

### `POST /agents/:id/credentials`
Adds a credential to an agent's profile.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Agent only)
- **Body (JSON)**:
  - `label` (string, required): e.g., "Certified Structural Engineer".
  - `issuer` (string, required): e.g., "COREN".
  - `verifiedOn` (string, required): Date in YYYY-MM-DD format.
- **Response `201 Created`**

### `POST /agents/:id/portfolio`
Adds a past project to an agent's portfolio.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Agent only)
- **Body (JSON)**:
  - `title` (string, required): Name of the past project.
  - `assetType` (string, required): The category of asset (e.g., "house").
  - `location` (string, required): City/State string.
  - `summary` (string, required): Brief description of the work completed.
  - `imageUrl` (string, required): Valid URL to the portfolio image.
- **Response `201 Created`**

---

## 3. Projects

### `POST /projects`
Creates a new project and its milestone schedule.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  - `name` (string, required): Name of the project.
  - `assetType` (enum, required): Type of asset (e.g., "house", "shop").
  - `location` (object, required): Must contain `label` (string), `lat` (number), `lng` (number).
  - `agentId` (string, required): UUID of a verified agent.
  - `currency` (enum: `"NGN"`, required): Operating currency.
  - `totalBudget` (number, required): In minor units (e.g. kobo).
  - `scope` (string, required): Detailed description of the project requirements.
  - `milestones` (array of objects, required):
    - `order` (number, required): Ascending integer starting at 1.
    - `stage` (string, required): Name of the stage (e.g., "Foundation").
    - `escrowAmount` (number, required): Sum of all milestone amounts MUST exactly equal `totalBudget`.
    - `dueDate` (string, required): Date in YYYY-MM-DD format.
- **Response `201 Created`**: The fully hydrated project object.

### `GET /projects`
Fetches projects belonging to the caller.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Required)
- **Query Parameters**: 
  - `status` (string, optional)
  - `assetType` (string, optional)
- **Response `200 OK`**: Envelope `{ "data": [...], "meta": {...} }`.

### `GET /projects/:id`
Fetches a single project workspace.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Required)
- **Response `200 OK`**: Project object including an embedded `milestones` array.

### `PATCH /projects/:id`
Updates high-level project details.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  - `name` (string, optional): Update project name.
  - `scope` (string, optional): Update project scope.
  - `currentStage` (string, optional): Update the string label for the current stage.
- **Response `200 OK`**

---

## 4. Milestones & Escrow

### `GET /projects/:id/milestones`
Fetches all milestones for a project. The backend dynamically computes `isOverdue` based on server time.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Required)
- **Response `200 OK`**: Array of milestone objects (Not paginated).

### `POST /milestones/:id/submit`
Agent submits a milestone for sender review. 
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Agent only)
- **Body**: None
- **Response `200 OK`**: (Fails with 409 Conflict if `proofCount === 0`).

### `POST /milestones/:id/approve`
Sender approves a submitted milestone.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  - `note` (string, optional): A text note to append to the permanent activity log.
- **Response `200 OK`**

### `POST /milestones/:id/flag`
Sender flags a milestone for issues.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  - `reason` (string, required): Detailed reason for flagging the work.
- **Response `200 OK`**

### `POST /milestones/:id/release`
Releases escrow funds. Atomic and idempotent.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Sender only)
  - `Idempotency-Key: <unique_string>` (Required): Ensures funds are never double-released if the network drops and the client retries the exact same request.
- **Body**: None
- **Response `200 OK`**: `{ "milestone", "fundsReleased", "fundsInEscrow" }`

---

## 5. Progress Proofs

### `POST /milestones/:id/proofs`
Agent uploads photo/video evidence.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Agent only)
- **Body (Multipart/form-data)**:
  - `file` (binary, required): Max 10MB limit. Allowed MIME types: `image/jpeg`, `image/png`, `video/mp4`.
  - `caption` (string, required): Agent's description of the photo.
  - `capturedLat` (number, required): Latitude from the device sensor at the time of capture.
  - `capturedLng` (number, required): Longitude from the device sensor at the time of capture.
- **Response `201 Created`**: Returns immediately while AI Verification (Gemini 1.5 Flash) runs in the background.

### `GET /proofs/:id/verification`
Polls the background AI Verification status.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Required)
- **Response `200 OK`**: `{ "status": "completed", "verification": {...} }`

### `GET /projects/:id/proofs`
Lists all proofs for a project.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Required)
- **Query Parameters**: 
  - `milestoneId` (string, optional)
  - `status` (string, optional)
- **Response `200 OK`**: Envelope `{ "data": [...], "meta": {...} }`.

### `POST /proofs/:id/approve` | `POST /proofs/:id/flag`
Approves or flags individual proofs.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON for `/flag` only)**:
  - `reason` (string, required): Reason for flagging the specific photo.

---

## 6. Documents, Messaging, Activity & Dashboard

### `GET /projects/:id/documents` | `DELETE /documents/:id`
Manages project files. 
- **Headers**: `Authorization: Bearer <access_token>`

### `POST /projects/:id/documents`
Uploads a document.
- **Headers**: `Authorization: Bearer <access_token>`
- **Body (Multipart/form-data)**:
  - `file` (binary, required)
  - `name` (string, required): Name of the document.
  - `kind` (enum, required): `"contract"`, `"receipt"`, `"verification_record"`, `"permit"`, `"other"`.

### `GET /projects/:id/messages`
Fetches the chronological chat thread for a project. (Bankole uses REST polling).
- **Headers**: `Authorization: Bearer <access_token>`
- **Query Params**: 
  - `page` (number, optional)
  - `limit` (number, optional, defaults to 50).
- **Response `200 OK`**: Envelope with `data` array and `meta` object.

### `POST /projects/:id/messages`
Sends a new message.
- **Headers**: `Authorization: Bearer <access_token>`
- **Body (JSON)**:
  - `body` (string, required): The text of the message.
- **Response `201 Created`**

### `GET /projects/:id/activity`
Chronological audit trail of all project events (read-only side-effects).
- **Headers**: `Authorization: Bearer <access_token>`
- **Response `200 OK`**: Envelope with `data` array of Activity objects.

### `GET /dashboard/summary`
Calculates high-level stats across all caller's projects.
- **Headers**: `Authorization: Bearer <access_token>`
- **Response `200 OK`**: `{ "currency", "projectCount", "totalBudget", "totalReleased", "totalInEscrow", "awaitingYourReview", "attentionNeeded", "recentActivity": [...] }`
