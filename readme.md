# Bankole — API Specification

The interface contract between the Bankole frontend and its backend service.

The frontend is already built against this specification. Its domain types live in
`web/lib/mock-data.ts` and mirror the response shapes below, so an implementation
that satisfies this document integrates without frontend changes.

Endpoints are marked **[P0]** (required for a complete demonstration), **[P1]**
(significant improvement), or **[P2]** (post-launch).

---

## 1. Conventions

### Base URL

```
Development:  http://localhost:8000/api/v1
Production:   https://<host>/api/v1
```

The frontend reads this from `NEXT_PUBLIC_API_BASE_URL`. The `/api/v1` prefix is
required so the interface can be versioned without breaking deployed clients.

### Content types

`application/json; charset=utf-8` throughout, except file upload endpoints, which
use `multipart/form-data`.

### Authentication

Bearer token:

```
Authorization: Bearer <access_token>
```

Two roles exist. `sender` is the diaspora funder; `agent` is the verified
on-the-ground builder or project manager. Role restrictions are stated per
endpoint. Requests for a resource the caller does not own return `403`, never
`404` — ownership must not be probeable.

### Error format

A single shape for every error. The `message` field is rendered directly to end
users and should read as a complete sentence.

```json
{
  "error": {
    "code": "milestone_not_ready",
    "message": "This milestone cannot be released until its proof is approved.",
    "field": "milestoneId",
    "details": {}
  }
}
```

`code` is a stable snake_case slug for programmatic handling. `field` appears only
on validation errors.

| Status | Meaning |
|---|---|
| `400` | Validation failure |
| `401` | Missing, invalid, or expired token |
| `403` | Authenticated but not permitted |
| `404` | Resource does not exist |
| `409` | Valid request, invalid current state |
| `422` | Semantically invalid |
| `429` | Rate limited |
| `500` | Server error |

### Collections

Every list endpoint returns an identical envelope:

```json
{
  "data": [],
  "meta": { "page": 1, "perPage": 20, "total": 47, "totalPages": 3 }
}
```

Query parameters `?page=1&perPage=20`. Default `perPage` is 20, maximum 100.
Single-resource endpoints return the object unwrapped, with no `data` key.

### Identifiers

Opaque strings; UUIDs preferred. The frontend treats them as opaque and never
parses them.

### Monetary amounts

**Integer minor units.** For NGN this is kobo: `4200000000` represents
₦42,000,000. Amounts are never floats and never preformatted strings. Every
amount is accompanied by a `currency` field (ISO 4217) so additional corridors can
be added later.

### Timestamps

ISO 8601 with explicit UTC offset: `"2026-07-29T10:14:00Z"`. Date-only fields such
as due dates use `"2026-06-20"`. Local times without an offset are not accepted.

### Coordinates

Decimal degrees as numbers: `{ "lat": 6.4698, "lng": 3.5852 }`. Positive values
are north and east. Display formatting is handled by the frontend.

---

## 2. Authentication **[P0]**

### `POST /auth/register`

```json
{
  "fullName": "Ada Okafor",
  "email": "ada@example.com",
  "password": "…",
  "role": "sender",
  "country": "GB"
}
```

Returns `201`:

```json
{
  "accessToken": "…",
  "refreshToken": "…",
  "expiresIn": 3600,
  "user": {
    "id": "usr_1",
    "fullName": "Ada Okafor",
    "email": "ada@example.com",
    "role": "sender",
    "country": "GB"
  }
}
```

### `POST /auth/login`

Accepts `{ "email", "password" }`. Returns the same body as register.

### `GET /auth/me`

Returns the `user` object. Called on application load to determine whether the
sender or agent interface is presented.

### `POST /auth/refresh`

Accepts `{ "refreshToken" }`. Returns a new token pair.

---

## 3. Agents

### `GET /agents` **[P0]**

The searchable directory. All query parameters optional:

| Parameter | Type | Notes |
|---|---|---|
| `q` | string | Free text across name, bio, location |
| `specialty` | enum, repeatable | `?specialty=house&specialty=shop` |
| `location` | string | City or country substring |
| `minRating` | number | For example `4.5` |
| `verifiedOnly` | boolean | Defaults to `true` |
| `sort` | enum | `rating` (default), `experience`, `projects` |

Returns a list envelope of agent summaries:

```json
{
  "id": "agt_1",
  "name": "Adaeze Nwosu",
  "initials": "AN",
  "avatarUrl": null,
  "verified": true,
  "location": "Lekki, Lagos, Nigeria",
  "specialties": ["house", "shop"],
  "rating": 4.9,
  "reviewCount": 38,
  "completedProjects": 22,
  "yearsExperience": 9
}
```

`avatarUrl` may be `null`; the frontend falls back to generated initials avatars,
so image hosting is not a blocker.

### `GET /agents/:id` **[P0]**

Returns the summary above, extended with:

```json
{
  "bio": "Licensed builder and project manager…",
  "credentials": [
    { "label": "COREN-certified site engineer", "verifiedOn": "2026-01-14" },
    { "label": "Government ID verified", "verifiedOn": "2026-01-10" }
  ],
  "portfolio": [
    {
      "id": "pf_1",
      "title": "4-bedroom family home",
      "assetType": "house",
      "location": "Ajah, Lagos",
      "summary": "Completed in 11 months, 6 milestones, zero flagged concerns.",
      "imageUrl": null
    }
  ],
  "reviews": [
    {
      "id": "rev_1",
      "author": "E. Nwankwo",
      "authorLocation": "London, UK",
      "quote": "…",
      "rating": 5,
      "createdAt": "2026-03-02T09:00:00Z"
    }
  ]
}
```

Credentials carry a `verifiedOn` date because the interface displays when
verification occurred — the date is part of the trust claim.

---

## 4. Projects

### `GET /projects` **[P0]**

Projects belonging to the caller. Senders receive projects they fund; agents
receive projects they manage. Optional filters `?status=on_track&assetType=house`.

Returns a list envelope of project summaries:

```json
{
  "id": "prj_1",
  "name": "Adeyemi Family Home",
  "assetType": "house",
  "location": { "label": "Ajah, Lagos, Nigeria", "lat": 6.4698, "lng": 3.5852 },
  "agent": { "id": "agt_1", "name": "Adaeze Nwosu", "initials": "AN", "verified": true },
  "currency": "NGN",
  "totalBudget": 4200000000,
  "fundsReleased": 1800000000,
  "fundsInEscrow": 2400000000,
  "currentStage": "Roofing & structural finishing",
  "status": "awaiting_review",
  "milestoneCount": 6,
  "milestonesReleased": 2,
  "startedOn": "2026-02-10",
  "coverImageUrl": null
}
```

Project location is an object rather than a string because its coordinates are the
reference point for proof verification.

### `GET /projects/:id` **[P0]**

Returns the summary extended with `scope`, `createdAt`, `updatedAt`, and an
embedded `milestones` array (§5), allowing the workspace to load in one request.

### `POST /projects` **[P0]**

Submitted once at the end of the guided creation flow.

```json
{
  "name": "Adeyemi Family Home",
  "assetType": "house",
  "location": { "label": "Ajah, Lagos, Nigeria", "lat": 6.4698, "lng": 3.5852 },
  "agentId": "agt_1",
  "currency": "NGN",
  "totalBudget": 4200000000,
  "scope": "4-bedroom detached duplex on a 600sqm plot…",
  "milestones": [
    { "order": 1, "stage": "Site survey & foundation", "escrowAmount": 800000000, "dueDate": "2026-03-01" },
    { "order": 2, "stage": "Block work to lintel level", "escrowAmount": 1000000000, "dueDate": "2026-04-15" }
  ]
}
```

Returns `201` with the full project detail object.

**Server-side validation is mandatory.** The frontend validates the same rules,
but client validation is a convenience, not a control:

- Milestone `escrowAmount` values must sum exactly to `totalBudget`
- `order` values must be contiguous starting at 1
- `dueDate` values must ascend with `order`
- `agentId` must reference an existing, verified agent

Violations return `400` with `field` identifying the offending element.

### `PATCH /projects/:id` **[P1]**

Partial update of `name`, `scope`, and `currentStage` only. Budget and milestone
structure are immutable through this endpoint — once escrow is funded, altering the
agreed plan requires a separate change-order flow with both parties' consent.

---

## 5. Milestones

### `GET /projects/:id/milestones` **[P0]**

```json
{
  "id": "ms_3",
  "projectId": "prj_1",
  "order": 3,
  "stage": "Roofing & structural finishing",
  "currency": "NGN",
  "escrowAmount": 900000000,
  "status": "proof_submitted",
  "dueDate": "2026-06-20",
  "isOverdue": false,
  "daysOverdue": 0,
  "proofCount": 2,
  "releasedAt": null
}
```

`isOverdue` and `daysOverdue` are computed server-side against server time. The
client is not the authority on lateness, since its clock is user-controlled.

### `POST /milestones/:id/submit` **[P1]** — agent only

Marks a milestone ready for review. Requires at least one attached proof; returns
`409 no_proof_attached` otherwise. Transitions `in_progress` → `proof_submitted`.

### `POST /milestones/:id/approve` **[P0]** — sender only

Transitions `proof_submitted` → `approved` and makes the milestone eligible for
release. Returns the updated milestone.

### `POST /milestones/:id/flag` **[P0]** — sender only

```json
{ "reason": "The roof sheeting shown does not match the agreed specification." }
```

Transitions to `flagged`, funds remain held, an activity entry is written, and the
agent is notified. Returns the updated milestone.

### `POST /milestones/:id/release` **[P0]**

Releases escrow for an approved milestone. Rejects with `409` unless the milestone
is `approved`.

**This endpoint must be idempotent.** It accepts an `Idempotency-Key` header and
returns the original result on replay. Without this, a duplicate submission or
network retry can double-release funds.

Returns the updated milestone together with the project's recalculated
`fundsReleased` and `fundsInEscrow`.

**Ledger invariant:** for every project, at all times,
`fundsReleased + fundsInEscrow` must equal the sum of its milestone amounts. This
should be enforced in a transaction and ideally asserted in tests.

---

## 6. Progress proofs

The verification mechanism the product depends on.

### `POST /milestones/:id/proofs` **[P0]** — agent only

`multipart/form-data`:

| Field | Type | Notes |
|---|---|---|
| `file` | binary | Image or video |
| `caption` | string | Progress note |
| `capturedLat` | number | Client-extracted, advisory only |
| `capturedLng` | number | Client-extracted, advisory only |
| `capturedAt` | string | Client-extracted ISO 8601, advisory only |

**Client-supplied location and timestamp values are advisory and must not be
trusted.** The server independently re-extracts EXIF metadata from the uploaded
file and verifies against its own extracted values. A client-supplied coordinate is
precisely what a dishonest submission would forge; accepting it would defeat the
product entirely. Where client and server values disagree, retain both and set
`clientMismatch: true`.

Returns `201`:

```json
{
  "id": "prf_1",
  "projectId": "prj_1",
  "milestoneId": "ms_3",
  "type": "photo",
  "caption": "Roof trusses installed, sheeting 60% complete",
  "fileUrl": "https://…/prf_1.jpg",
  "thumbnailUrl": "https://…/prf_1_thumb.jpg",
  "capturedAt": "2026-07-29T10:14:00Z",
  "uploadedAt": "2026-07-29T10:20:11Z",
  "geo": { "lat": 6.4698, "lng": 3.5852 },
  "verification": {
    "hasExifGps": true,
    "distanceFromSiteMetres": 34,
    "withinSiteRadius": true,
    "capturedBeforeMilestoneStart": false,
    "clientMismatch": false,
    "verdict": "verified_on_site"
  },
  "status": "pending_review"
}
```

The interface renders a distinct state per verdict:

| Verdict | Condition |
|---|---|
| `verified_on_site` | GPS present, within site radius, timestamp consistent |
| `location_mismatch` | GPS present, outside site radius |
| `no_gps_data` | EXIF absent or stripped — unverifiable, not presumed fraudulent |
| `stale_timestamp` | Captured before the milestone began |

Site radius defaults to **250 metres** from the project coordinates and must be
configurable rather than hardcoded, since dense urban plots require tighter bounds.

`no_gps_data` is deliberately distinct from a failure. Many devices and messaging
applications strip EXIF. Reporting unverifiable proof as unverified — rather than
as either verified or fraudulent — is a correctness requirement, not a nicety.

### `GET /projects/:id/proofs` **[P0]**

All proofs for a project, newest first. Optional
`?milestoneId=ms_3&status=pending_review`.

### `POST /proofs/:id/approve` · `POST /proofs/:id/flag` **[P1]**

Review of an individual proof rather than an entire stage. Same semantics as the
milestone equivalents.

---

## 7. Activity log **[P0]**

### `GET /projects/:id/activity`

The chronological project record, newest first.

```json
{
  "id": "act_1",
  "projectId": "prj_1",
  "type": "proof_submitted",
  "message": "New progress proof submitted for Roofing & structural finishing",
  "actor": { "id": "agt_1", "name": "Adaeze Nwosu", "role": "agent" },
  "createdAt": "2026-07-29T10:20:00Z"
}
```

Activity entries are written by the backend as a side effect of the endpoints
above. The frontend never creates them. Entries are append-only — the log's value
is that it cannot be quietly revised.

---

## 8. Dashboard **[P0]**

### `GET /dashboard/summary`

Aggregates for the dashboard header, computed server-side.

```json
{
  "currency": "NGN",
  "projectCount": 4,
  "totalBudget": 12550000000,
  "totalReleased": 4450000000,
  "totalInEscrow": 8100000000,
  "awaitingYourReview": 2,
  "attentionNeeded": 1,
  "recentActivity": []
}
```

`recentActivity` contains the five most recent activity items across all of the
caller's projects.

---

## 9. Documents **[P1]**

| Method | Path |
|---|---|
| `GET` | `/projects/:id/documents` |
| `POST` | `/projects/:id/documents` — multipart `file`, `name`, `kind` |
| `DELETE` | `/documents/:id` |

```json
{
  "id": "doc_1",
  "projectId": "prj_1",
  "name": "Building contract",
  "kind": "contract",
  "fileUrl": "https://…",
  "sizeBytes": 284119,
  "uploadedBy": { "id": "agt_1", "name": "Adaeze Nwosu" },
  "uploadedOn": "2026-02-08"
}
```

---

## 10. Messaging **[P1]**

A single thread per project, replacing dispersed external channels.

| Method | Path |
|---|---|
| `GET` | `/projects/:id/messages` — paginated, oldest first |
| `POST` | `/projects/:id/messages` — `{ "body": "…" }` |

```json
{
  "id": "msg_1",
  "projectId": "prj_1",
  "author": { "id": "agt_1", "name": "Adaeze Nwosu", "role": "agent" },
  "body": "…",
  "createdAt": "2026-07-30T08:00:00Z"
}
```

Polling is sufficient; real-time transport is not required.

---

## 11. Notifications **[P2]**

| Method | Path |
|---|---|
| `GET` | `/notifications` — unread first |
| `POST` | `/notifications/:id/read` |
| `POST` | `/notifications/read-all` |

Triggering events: proof submitted, funds released, milestone overdue, concern
flagged.

---

## 12. Enumerations

Exact string values the interface depends on. Adding values is backward
compatible; renaming is not.

```
role             sender | agent
assetType        house | shop | clinic | borehole | school | land | community
projectStatus    on_track | awaiting_review | attention_needed | completed
milestoneStatus  pending | in_progress | proof_submitted | approved | released | flagged
proofType        photo | video
proofStatus      pending_review | approved | flagged
proofVerdict     verified_on_site | location_mismatch | no_gps_data | stale_timestamp
documentKind     contract | receipt | verification_record | permit | other
currency         NGN
```

---

## 13. Implementation order

Implementing in this sequence unblocks the largest amount of frontend work at each
step:

1. `GET /agents`, `GET /agents/:id`
2. `GET /projects`, `GET /projects/:id`, `GET /dashboard/summary`
3. `POST /projects`
4. `POST /milestones/:id/proofs` with EXIF verification
5. `POST /milestones/:id/approve`, `/flag`, `/release`

Seeding the database with the agents and projects defined in
`web/lib/mock-data.ts` is recommended, so that a deployed instance does not present
empty views.

---

## 14. Operational requirements

**CORS.** Allow `http://localhost:3000` in development, plus the deployed frontend
origin.

**File storage.** Any provider is acceptable. The response must contain a publicly
readable URL; the hostname must be registered in `web/next.config.ts` under
`images.remotePatterns` for `next/image` to serve it.

**Video EXIF.** If GPS extraction from video containers is unavailable, video
proofs should return verdict `no_gps_data` rather than failing the upload.

**Escrow settlement.** A simulated ledger satisfying the invariant in §5 is
sufficient for demonstration. Introducing a live payment provider adds an external
runtime dependency without changing the interface, and can be added later behind
the same endpoints.

**Rate limiting.** If applied, return `429` with the standard error body and a
`Retry-After` header.