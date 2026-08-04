// Shared API types for request/response shapes

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    field?: string;
    details?: Record<string, unknown>;
  };
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ActorSummary {
  id: string;
  name: string;
  role: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  initials: string;
  verified: boolean;
}

export interface ParsedPagination {
  page: number;
  perPage: number;
  offset: number;
}
