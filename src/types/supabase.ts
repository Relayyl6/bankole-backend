// Database row types mirroring Supabase schema

export interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  country: string;
  created_at: string;
}

export interface AgentRow {
  id: string;
  user_id: string | null;
  name: string;
  initials: string;
  bio: string | null;
  location: string;
  specialties: string[];
  rating: number;
  review_count: number;
  completed_projects: number;
  years_experience: number;
  verified: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface AgentCredentialRow {
  id: string;
  agent_id: string;
  label: string;
  verified_on: string;
}

export interface AgentPortfolioRow {
  id: string;
  agent_id: string;
  title: string;
  asset_type: string;
  location: string;
  summary: string;
  image_url: string | null;
}

export interface AgentReviewRow {
  id: string;
  agent_id: string;
  author: string;
  author_location: string;
  quote: string;
  rating: number;
  created_at: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  asset_type: string;
  location_label: string;
  location_lat: number;
  location_lng: number;
  agent_id: string;
  sender_id: string;
  currency: string;
  total_budget: number;
  funds_released: number;
  funds_in_escrow: number;
  current_stage: string;
  status: string;
  scope: string;
  milestone_count: number;
  milestones_released: number;
  started_on: string;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneRow {
  id: string;
  project_id: string;
  order: number;
  stage: string;
  currency: string;
  escrow_amount: number;
  status: string;
  due_date: string;
  released_at: string | null;
  proof_count: number;
}

export interface ProofRow {
  id: string;
  project_id: string;
  milestone_id: string;
  uploaded_by: string;
  type: string;
  caption: string;
  file_url: string;
  thumbnail_url: string | null;
  captured_at: string | null;
  uploaded_at: string;
  geo_lat: number | null;
  geo_lng: number | null;
  has_exif_gps: boolean;
  distance_from_site_metres: number | null;
  within_site_radius: boolean | null;
  captured_before_milestone_start: boolean | null;
  client_mismatch: boolean;
  verdict: string;
  status: string;
}

export interface ActivityRow {
  id: string;
  project_id: string;
  type: string;
  message: string;
  actor_id: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  project_id: string;
  name: string;
  kind: string;
  file_url: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_on: string;
}

export interface MessageRow {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface IdempotencyKeyRow {
  key: string;
  response: string;
  created_at: string;
}
