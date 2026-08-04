// Enumerations — exact string values from api-contract.md §12

export const Role = {
  SENDER: 'sender',
  AGENT: 'agent',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const AssetType = {
  HOUSE: 'house',
  SHOP: 'shop',
  CLINIC: 'clinic',
  BOREHOLE: 'borehole',
  SCHOOL: 'school',
  LAND: 'land',
  COMMUNITY: 'community',
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

export const ProjectStatus = {
  ON_TRACK: 'on_track',
  AWAITING_REVIEW: 'awaiting_review',
  ATTENTION_NEEDED: 'attention_needed',
  COMPLETED: 'completed',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const MilestoneStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PROOF_SUBMITTED: 'proof_submitted',
  APPROVED: 'approved',
  RELEASED: 'released',
  FLAGGED: 'flagged',
} as const;
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

export const ProofType = {
  PHOTO: 'photo',
  VIDEO: 'video',
} as const;
export type ProofType = (typeof ProofType)[keyof typeof ProofType];

export const ProofStatus = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  FLAGGED: 'flagged',
} as const;
export type ProofStatus = (typeof ProofStatus)[keyof typeof ProofStatus];

export const ProofVerdict = {
  VERIFIED_ON_SITE: 'verified_on_site',
  LOCATION_MISMATCH: 'location_mismatch',
  NO_GPS_DATA: 'no_gps_data',
  STALE_TIMESTAMP: 'stale_timestamp',
} as const;
export type ProofVerdict = (typeof ProofVerdict)[keyof typeof ProofVerdict];

export const DocumentKind = {
  CONTRACT: 'contract',
  RECEIPT: 'receipt',
  VERIFICATION_RECORD: 'verification_record',
  PERMIT: 'permit',
  OTHER: 'other',
} as const;
export type DocumentKind = (typeof DocumentKind)[keyof typeof DocumentKind];

export const Currency = {
  NGN: 'NGN',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const ActivityType = {
  PROJECT_CREATED: 'project_created',
  PROOF_SUBMITTED: 'proof_submitted',
  MILESTONE_APPROVED: 'milestone_approved',
  MILESTONE_FLAGGED: 'milestone_flagged',
  MILESTONE_RELEASED: 'milestone_released',
  DOCUMENT_UPLOADED: 'document_uploaded',
  MESSAGE_SENT: 'message_sent',
  STAGE_UPDATED: 'stage_updated',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];
