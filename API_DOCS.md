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
List endpoints return a `data` array and a `meta` object.
```json
{
  "data": [
    { ... }
  ],
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
* **projectStatus**: `on_track` | `awaiting_review` | `attention_needed` | `completed` | `dispute` | `agent_unassigned`
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
  ```json
  {
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "password": "strongpassword123",
    "role": "sender",
    "country": "GB",
    "phoneNumber": "+44123456789"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
    "refreshToken": "v1.MjQ...",
    "expiresIn": 3600,
    "user": {
      "id": "usr_abc123",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "role": "sender",
      "country": "GB",
      "phoneNumber": "+44123456789"
    }
  }
  ```

### `POST /auth/login`
Authenticates an existing user.
- **Headers**: None
- **Body (JSON)**:
  ```json
  {
    "email": "jane@example.com",
    "password": "strongpassword123"
  }
  ```
- **Response `200 OK`**: Same payload structure as `/auth/register`.

### `GET /auth/me`
Fetches the currently authenticated user's profile.
- **Headers**: `Authorization: Bearer <access_token>`
- **Response `200 OK`**:
  ```json
  {
    "id": "usr_abc123",
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "role": "sender",
    "country": "GB"
  }
  ```

### `PATCH /auth/me`
Updates the authenticated user's profile.
- **Headers**: `Authorization: Bearer <access_token>`
- **Body (JSON)**:
  ```json
  {
    "fullName": "Jane Doe Updated",
    "country": "GB",
    "phoneNumber": "+44123456789",
    "currencyPreference": "NGN",
    "timezone": "Europe/London",
    "bio": "Expert structural engineer...",
    "specialties": ["Foundation", "Roofing"],
    "yearsExperience": 8,
    "avatarUrl": "https://example.com/avatar.jpg",
    "companyName": "Jane Builds Ltd",
    "portfolioUrl": "https://janebuilds.com",
    "availabilityStatus": "Busy"
  }
  ```
- **Response `200 OK`**: 
  ```json
  {
    "message": "Profile updated successfully.",
    "updatedFields": {
      "usersUpdated": true,
      "agentsUpdated": true
    },
    "profile": {
      "id": "usr_abc123",
      "fullName": "Jane Doe Updated",
      "email": "jane@example.com",
      "role": "agent",
      "country": "GB",
      "phoneNumber": "+44123456789",
      "currencyPreference": "NGN",
      "timezone": "Europe/London",
      "createdAt": "2026-08-04T12:00:00Z",
      "agentDetails": {
        "bio": "Expert structural engineer...",
        "specialties": ["Foundation", "Roofing"],
        "yearsExperience": 8,
        "avatarUrl": "https://example.com/avatar.jpg",
        "verified": true,
        "rating": 4.5,
        "reviewCount": 12,
        "completedProjects": 5,
        "companyName": "Jane Builds Ltd",
        "portfolioUrl": "https://janebuilds.com",
        "availabilityStatus": "Busy"
      }
    }
  }
  ```

### `POST /auth/refresh`
Refreshes an expired access token.
- **Headers**: None
- **Body (JSON)**:
  ```json
  {
    "refreshToken": "v1.MjQ..."
  }
  ```
- **Response `200 OK`**: 
  ```json
  { 
    "accessToken": "eyJhb...", 
    "refreshToken": "v1.MjQ...",
    "expiresIn": 3600,
    "user": {
      "id": "usr_abc123",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "role": "sender",
      "country": "GB"
    }
  }
  ```

---

## 2. Agents

### `GET /agents`
Searches the directory of agents.
- **Query Parameters**: `q`, `specialty`, `location`, `minRating`, `verifiedOnly`, `sort`, `page`, `perPage`.
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "id": "agt_123",
        "name": "Jane Doe",
        "initials": "JD",
        "avatarHue": "hsl(210, 70%, 50%)",
        "avatarUrl": null,
        "verified": true,
        "location": "Lagos",
        "specialties": ["Foundation", "Concrete"],
        "rating": 4.8,
        "reviewCount": 15,
        "completedProjects": 8,
        "yearsExperience": 10
      }
    ],
    "meta": {
      "page": 1,
      "perPage": 20,
      "total": 1,
      "totalPages": 1
    }
  }
  ```

### `GET /agents/:id`
Fetches a single agent's comprehensive profile.
- **Response `200 OK`**:
  ```json
  {
    "id": "agt_123",
    "name": "Jane Doe",
    "initials": "JD",
    "avatarHue": "hsl(210, 70%, 50%)",
    "avatarUrl": null,
    "verified": true,
    "location": "Lagos",
    "specialties": ["Foundation", "Concrete"],
    "rating": 4.8,
    "reviewCount": 15,
    "completedProjects": 8,
    "yearsExperience": 10,
    "bio": "I am an expert...",
    "credentials": [
      {
        "label": "COREN Certified",
        "issuer": "COREN",
        "verifiedOn": "2020-01-01"
      }
    ],
    "portfolio": [
      {
        "id": "port_123",
        "title": "Lekki Duplex",
        "assetType": "house",
        "location": "Lekki",
        "summary": "Completed a 4-bedroom duplex.",
        "imageUrl": "https://example.com/image.jpg"
      }
    ],
    "reviews": [
      {
        "id": "rev_123",
        "author": "John Smith",
        "authorLocation": "GB",
        "body": "Great work on the foundation.",
        "rating": 5,
        "date": "2023-05-10T12:00:00Z"
      }
    ]
  }
  ```

### `POST /agents/:id/reviews`
Rates an agent.
- **Headers**: `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  ```json
  {
    "quote": "Excellent communication and pacing.",
    "rating": 5
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true
  }
  ```

### `POST /agents/:id/credentials`
Adds a credential.
- **Headers**: `Authorization: Bearer <access_token>` (Agent only)
- **Body (JSON)**:
  ```json
  {
    "label": "Certified Structural Engineer",
    "issuer": "COREN",
    "verifiedOn": "2015-06-01"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "id": "cred_123",
    "agent_id": "agt_123",
    "label": "Certified Structural Engineer",
    "issuer": "COREN",
    "verified_on": "2015-06-01"
  }
  ```

### `POST /agents/:id/portfolio`
Adds a portfolio entry.
- **Headers**: `Authorization: Bearer <access_token>` (Agent only)
- **Body (JSON)**:
  ```json
  {
    "title": "Mainland Clinic",
    "assetType": "clinic",
    "location": "Yaba",
    "summary": "Built a clinic from scratch.",
    "imageUrl": "https://example.com/clinic.jpg"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "id": "port_123",
    "agent_id": "agt_123",
    "title": "Mainland Clinic",
    "asset_type": "clinic",
    "location": "Yaba",
    "summary": "Built a clinic from scratch.",
    "image_url": "https://example.com/clinic.jpg"
  }
  ```

---

## 3. Projects

### `POST /projects`
Creates a new project.
- **Headers**: `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  ```json
  {
    "name": "Family House",
    "assetType": "house",
    "location": {
      "label": "Ikeja",
      "lat": 6.6018,
      "lng": 3.3515
    },
    "agentId": "agt_123",
    "currency": "NGN",
    "totalBudget": 50000000,
    "supervisionFeePercentage": 10,
    "scope": "Build a 4-bedroom bungalow.",
    "milestones": [
      {
        "order": 1,
        "stage": "Foundation",
        "escrowAmount": 10000000,
        "dueDate": "2024-01-01"
      }
    ]
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "id": "prj_123",
    "name": "Family House",
    "assetType": "house",
    "location": {
      "label": "Ikeja",
      "lat": 6.6018,
      "lng": 3.3515
    },
    "agent": {
      "id": "agt_123",
      "name": "Jane Doe",
      "initials": "JD",
      "verified": true
    },
    "currency": "NGN",
    "totalBudget": 50000000,
    "fundsReleased": 0,
    "fundsInEscrow": 50000000,
    "supervisionFeePercentage": 10,
    "supervisionFeeTotal": 5000000,
    "supervisionFeePaid": 0,
    "currentStage": "Foundation",
    "status": "on_track",
    "milestoneCount": 1,
    "milestonesReleased": 0,
    "startedOn": "2023-10-01",
    "coverImageUrl": null,
    "scope": "Build a 4-bedroom bungalow.",
    "createdAt": "2023-10-01T12:00:00Z",
    "updatedAt": "2023-10-01T12:00:00Z",
    "milestones": [
      {
        "id": "ms_123",
        "projectId": "prj_123",
        "order": 1,
        "stage": "Foundation",
        "currency": "NGN",
        "escrowAmount": 10000000,
        "status": "in_progress",
        "dueDate": "2024-01-01",
        "isOverdue": false,
        "daysOverdue": 0,
        "proofCount": 0,
        "releasedAt": null
      }
    ]
  }
  ```

### `GET /projects`
Fetches caller's projects.
- **Query Parameters**: `status`, `assetType`, `page`, `perPage`.
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "id": "prj_123",
        "name": "Family House",
        "assetType": "house",
        "location": { "label": "Ikeja", "lat": 6.6, "lng": 3.3 },
        "agent": { "id": "agt_123", "name": "Jane", "initials": "J", "verified": true },
        "currency": "NGN",
        "totalBudget": 50000000,
        "fundsReleased": 0,
        "fundsInEscrow": 50000000,
        "supervisionFeePercentage": 10,
        "supervisionFeeTotal": 5000000,
        "supervisionFeePaid": 0,
        "currentStage": "Foundation",
        "status": "on_track",
        "milestoneCount": 1,
        "milestonesReleased": 0,
        "startedOn": "2023-10-01",
        "coverImageUrl": null
      }
    ],
    "meta": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
  }
  ```

### `GET /projects/:id`
Fetches a single project workspace.
- **Response `200 OK`**: Exactly matches the `201 Created` response payload from `POST /projects`.

### `PATCH /projects/:id`
Updates high-level project details.
- **Headers**: `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  ```json
  {
    "name": "Updated Name",
    "scope": "Updated Scope",
    "currentStage": "Roofing"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "id": "prj_123",
    "name": "Updated Name",
    "scope": "Updated Scope",
    "currentStage": "Roofing",
    "updatedAt": "2023-10-02T12:00:00Z"
  }
  ```

### `POST /projects/:id/unassign-agent`
Removes an agent from a project.
- **Headers**: `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  ```json
  {
    "reason": "Agent abandoned the site.",
    "requestDispute": true
  }
  ```
- **Response `200 OK`**: 
  ```json
  {
    "status": "dispute",
    "message": "Agent unassigned successfully."
  }
  ```

### `POST /projects/:id/assign-agent`
Brings a new agent onto a project that is unassigned or in dispute.
- **Headers**: `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  ```json
  {
    "newAgentId": "agt_456"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "on_track",
    "message": "New agent assigned successfully."
  }
  ```

---

## 4. Milestones & Escrow

### `GET /projects/:id/milestones`
Fetches all milestones for a project.
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "ms_123",
      "projectId": "prj_123",
      "order": 1,
      "stage": "Foundation",
      "currency": "NGN",
      "escrowAmount": 10000000,
      "status": "in_progress",
      "dueDate": "2024-01-01",
      "isOverdue": false,
      "daysOverdue": 0,
      "proofCount": 1,
      "releasedAt": null
    }
  ]
  ```

### `POST /milestones/:id/submit`
Agent submits a milestone for sender review. 
- **Headers**: `Authorization: Bearer <access_token>` (Agent only)
- **Body**: None
- **Response `200 OK`**: Returns the updated Milestone object (same shape as array element in `GET /projects/:id/milestones`). Status changes to `proof_submitted`.

### `POST /milestones/:id/approve`
Sender approves a submitted milestone.
- **Headers**: `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  ```json
  {
    "note": "Looks great, approved."
  }
  ```
- **Response `200 OK`**: Returns the updated Milestone object. Status changes to `approved`.

### `POST /milestones/:id/flag`
Sender flags a milestone for issues.
- **Headers**: `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON)**:
  ```json
  {
    "reason": "Missing concrete reinforcement."
  }
  ```
- **Response `200 OK`**: Returns the updated Milestone object. Status changes to `flagged`.

### `POST /milestones/:id/release`
Releases escrow funds. Atomic and idempotent.
- **Headers**: 
  - `Authorization: Bearer <access_token>` (Sender only)
  - `Idempotency-Key: <unique_string>` (Required)
- **Body**: None
- **Response `200 OK`**:
  ```json
  {
    "milestone": {
      "id": "ms_123",
      "projectId": "prj_123",
      "order": 1,
      "stage": "Foundation",
      "currency": "NGN",
      "escrowAmount": 10000000,
      "status": "released",
      "dueDate": "2024-01-01",
      "isOverdue": false,
      "daysOverdue": 0,
      "proofCount": 1,
      "releasedAt": "2024-01-02T12:00:00Z"
    },
    "fundsReleased": 10000000,
    "fundsInEscrow": 40000000
  }
  ```

---

## 5. Progress Proofs

### `POST /milestones/:id/proofs`
Agent uploads photo/video evidence.
- **Headers**: `Authorization: Bearer <access_token>` (Agent only)
- **Body (Multipart/form-data)**:
  - `file` (binary, required)
  - `caption` (string, required)
  - `capturedLat` (number, required)
  - `capturedLng` (number, required)
- **Response `201 Created`**: 
  ```json
  {
    "id": "prf_123",
    "projectId": "prj_123",
    "milestoneId": "ms_123",
    "type": "photo",
    "caption": "Foundation poured.",
    "fileUrl": "https://bucket/proof.jpg",
    "thumbnailUrl": null,
    "capturedAt": "2024-01-01T10:00:00Z",
    "uploadedAt": "2024-01-01T10:05:00Z",
    "geo": {
      "lat": 6.6018,
      "lng": 3.3515
    },
    "verification": null,
    "status": "pending_review"
  }
  ```

### `GET /proofs/:id/verification`
Polls the background AI Verification status.
- **Response `200 OK`**:
  ```json
  {
    "status": "completed",
    "verification": {
      "hasExifGps": true,
      "distanceFromSiteMetres": 14,
      "withinSiteRadius": true,
      "capturedBeforeMilestoneStart": false,
      "clientMismatch": false,
      "verdict": "verified_on_site"
    }
  }
  ```
*(Status can be `pending` or `completed`)*

### `GET /projects/:id/proofs`
Lists all proofs for a project.
- **Query Parameters**: `milestoneId`, `status`, `page`, `perPage`.
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "id": "prf_123",
        "projectId": "prj_123",
        "milestoneId": "ms_123",
        "type": "photo",
        "caption": "Foundation poured.",
        "fileUrl": "https://bucket/proof.jpg",
        "thumbnailUrl": null,
        "capturedAt": "2024-01-01T10:00:00Z",
        "uploadedAt": "2024-01-01T10:05:00Z",
        "geo": { "lat": 6.6, "lng": 3.3 },
        "verification": {
          "verdict": "verified_on_site"
        },
        "status": "approved"
      }
    ],
    "meta": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
  }
  ```

### `POST /proofs/:id/approve` | `POST /proofs/:id/flag`
Approves or flags individual proofs.
- **Headers**: `Authorization: Bearer <access_token>` (Sender only)
- **Body (JSON for `/flag` only)**:
  ```json
  {
    "reason": "Too blurry."
  }
  ```
- **Response `200 OK`**: Returns the updated Proof object.

---

## 6. Documents, Messaging, Activity & Dashboard

### `GET /projects/:id/documents`
Lists documents for a project.
- **Query Parameters**: `page`, `perPage`.
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "id": "doc_123",
        "projectId": "prj_123",
        "name": "Contract.pdf",
        "kind": "contract",
        "fileUrl": "https://bucket/contract.pdf",
        "sizeBytes": 102400,
        "uploadedBy": {
          "id": "usr_123",
          "name": "Jane Doe"
        },
        "uploadedOn": "2023-10-01T12:00:00Z"
      }
    ],
    "meta": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
  }
  ```

### `POST /projects/:id/documents`
Uploads a document.
- **Headers**: `Authorization: Bearer <access_token>`
- **Body (Multipart/form-data)**:
  - `file` (binary, required)
  - `name` (string, required)
  - `kind` (enum: `"contract"`, `"receipt"`, `"verification_record"`, `"permit"`, `"other"`)
- **Response `201 Created`**: Returns the Document object shown in `GET /projects/:id/documents`.

### `DELETE /documents/:id`
Deletes a document.
- **Response `204 No Content`**

### `GET /projects/:id/messages`
Fetches the chronological chat thread for a project.
- **Query Parameters**: `page`, `perPage`.
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "id": "msg_123",
        "projectId": "prj_123",
        "author": {
          "id": "usr_123",
          "name": "Jane Doe",
          "role": "sender"
        },
        "body": "Hi, how is the foundation going?",
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ],
    "meta": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
  }
  ```

### `POST /projects/:id/messages`
Sends a new message.
- **Body (JSON)**:
  ```json
  {
    "body": "The foundation is going great!"
  }
  ```
- **Response `201 Created`**: Returns the Message object shown above.

### `GET /projects/:id/activity`
Chronological audit trail of all project events.
- **Query Parameters**: `page`, `perPage`.
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "id": "act_123",
        "projectId": "prj_123",
        "type": "milestone_approved",
        "message": "Milestone Foundation has been approved.",
        "actor": {
          "id": "usr_123",
          "name": "Jane Doe",
          "role": "sender"
        },
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ],
    "meta": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
  }
  ```

### `GET /dashboard/summary`
Calculates high-level stats across all caller's projects.
- **Response `200 OK`**: 
  ```json
  {
    "currency": "NGN",
    "projectCount": 5,
    "totalBudget": 250000000,
    "totalReleased": 100000000,
    "totalInEscrow": 150000000,
    "awaitingYourReview": 2,
    "attentionNeeded": 0,
    "recentActivity": [
      {
        "id": "act_123",
        "projectId": "prj_123",
        "type": "milestone_approved",
        "message": "Milestone Foundation has been approved.",
        "actor": {
          "id": "usr_123",
          "name": "Jane Doe",
          "role": "sender"
        },
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ]
  }
  ```
