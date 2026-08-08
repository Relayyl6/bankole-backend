import exifr from 'exifr';
import { env } from '../config/env.config';
import { ProofVerdict } from '../types/enums';

export interface ExifResult {
  hasExifGps: boolean;
  lat: number | null;
  lng: number | null;
  capturedAt: Date | null;
}

export interface VerificationResult {
  hasExifGps: boolean;
  distanceFromSiteMetres: number | null;
  withinSiteRadius: boolean | null;
  capturedBeforeMilestoneStart: boolean | null;
  clientMismatch: boolean;
  verdict: ProofVerdict;
}

/**
 * Haversine formula — returns distance in metres between two GPS points.
 */
export const haversineMetres = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Extracts GPS + timestamp EXIF metadata from a file buffer.
 * Safely returns null fields if metadata is absent or stripped.
 */
export const extractExif = async (buffer: Buffer): Promise<ExifResult> => {
  try {
    const parsed = await exifr.parse(buffer, {
      gps: true,
      exif: true,
      tiff: false,
    });

    if (!parsed) return { hasExifGps: false, lat: null, lng: null, capturedAt: null };

    const lat = parsed.latitude ?? null;
    const lng = parsed.longitude ?? null;
    const rawDate = parsed.DateTimeOriginal ?? parsed.CreateDate ?? null;

    return {
      hasExifGps: lat !== null && lng !== null,
      lat,
      lng,
      capturedAt: rawDate ? new Date(rawDate) : null,
    };
  } catch {
    // EXIF parsing failure is non-fatal — report as absent
    return { hasExifGps: false, lat: null, lng: null, capturedAt: null };
  }
};

/**
 * Verifies a proof against the project site coordinates and milestone start date.
 * Client-supplied values are compared but never trusted as ground truth.
 */
export const verifyProof = (params: {
  exif: ExifResult;
  siteLat: number;
  siteLng: number;
  milestoneCreatedAt: Date;
  clientLat: number | null;
  clientLng: number | null;
  clientCapturedAt: Date | null;
}): VerificationResult => {
  const { exif, siteLat, siteLng, milestoneCreatedAt, clientLat, clientLng, clientCapturedAt } = params;
  const radiusMetres = env.SITE_RADIUS_METRES;

  let effectiveLat = exif.lat;
  let effectiveLng = exif.lng;
  let effectiveCapturedAt = exif.capturedAt;

  // Fallback to browser GPS if EXIF is missing
  if (!exif.hasExifGps && clientLat !== null && clientLng !== null) {
    effectiveLat = clientLat;
    effectiveLng = clientLng;
    if (clientCapturedAt) effectiveCapturedAt = clientCapturedAt;
  }

  if (effectiveLat === null || effectiveLng === null) {
    return {
      hasExifGps: false,
      distanceFromSiteMetres: null,
      withinSiteRadius: null,
      capturedBeforeMilestoneStart: null,
      clientMismatch: false,
      verdict: ProofVerdict.NO_GPS_DATA,
    };
  }

  const distance = haversineMetres(effectiveLat, effectiveLng, siteLat, siteLng);
  const withinSiteRadius = distance <= radiusMetres;

  // Check if photo was taken before the milestone started (stale proof)
  const capturedBeforeMilestoneStart =
    effectiveCapturedAt !== null && effectiveCapturedAt < milestoneCreatedAt;

  // Detect client/EXIF mismatch (possible spoofing attempt) ONLY if EXIF is present
  let clientMismatch = false;
  if (exif.hasExifGps && exif.lat !== null && exif.lng !== null && clientLat !== null && clientLng !== null) {
    const clientToExifDistance = haversineMetres(exif.lat, exif.lng, clientLat, clientLng);
    if (clientToExifDistance > 100) clientMismatch = true; // >100m discrepancy
  }
  if (exif.hasExifGps && exif.capturedAt !== null && clientCapturedAt !== null) {
    const timeDiffMs = Math.abs(clientCapturedAt.getTime() - exif.capturedAt.getTime());
    if (timeDiffMs > 5 * 60 * 1000) clientMismatch = true; // >5 min discrepancy
  }

  // Derive verdict
  let verdict: ProofVerdict;
  if (capturedBeforeMilestoneStart) {
    verdict = ProofVerdict.STALE_TIMESTAMP;
  } else if (!withinSiteRadius) {
    verdict = ProofVerdict.LOCATION_MISMATCH;
  } else {
    verdict = ProofVerdict.VERIFIED_ON_SITE;
  }

  return {
    hasExifGps: exif.hasExifGps,
    distanceFromSiteMetres: Math.round(distance),
    withinSiteRadius,
    capturedBeforeMilestoneStart: capturedBeforeMilestoneStart ?? false,
    clientMismatch,
    verdict,
  };
};
