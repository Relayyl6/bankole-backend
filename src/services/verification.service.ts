import { GoogleGenAI } from '@google/genai';
import imghash from 'imghash';
import { supabase } from '../config/supabase.config';
import { env } from '../config/env.config';
import {
  RiskLevel,
  CheckId,
  CheckResult,
  FlagSeverity,
  FlagCode,
  ProofVerdict,
  ProofType,
} from '../types/enums';

// The Google Gen AI Client
// Will only initialize if GEMINI_API_KEY is present
const aiClient = process.env.GEMINI_API_KEY ? new GoogleGenAI({}) : null;

// The types corresponding to the new AI verification schema
export interface VerificationCheck {
  id: CheckId;
  result: CheckResult;
  detail: string;
}

export interface VerificationFlag {
  code: FlagCode;
  severity: FlagSeverity;
  message: string;
}

export interface VerificationJSON {
  riskLevel: RiskLevel;
  verdict: ProofVerdict;
  confidence: number;
  summary: string;
  checks: VerificationCheck[];
  flags: VerificationFlag[];
}

/**
 * Calculates hamming distance between two hex hashes (perceptual hashes).
 */
const hammingDistance = (hash1: string, hash2: string): number => {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
};

/**
 * Main verification pipeline entry point.
 * This should be fired asynchronously in the background.
 */
export const runVerificationPipeline = async (
  proofId: string,
  projectId: string,
  milestoneId: string,
  buffer: Buffer,
  mimeType: string,
  verificationContext: {
    hasExifGps: boolean;
    distanceFromSiteMetres: number | null;
    withinSiteRadius: boolean | null;
    capturedBeforeMilestoneStart: boolean | null;
    clientMismatch: boolean;
    baseVerdict: ProofVerdict; // derived strictly from location & timestamp
  }
) => {
  try {
    const checks: VerificationCheck[] = [];
    const flags: VerificationFlag[] = [];
    let riskLevel: RiskLevel = RiskLevel.LOW;
    let confidence = 1.0;

    // We will build the summary up as we go
    const summaryLines: string[] = [];

    // --- CHECK 0 & 1 & 2: Integrity, Location, Timestamp (from base verificationContext) ---

    // 0. Integrity
    if (verificationContext.hasExifGps) {
      checks.push({ id: CheckId.INTEGRITY, result: CheckResult.PASS, detail: 'Camera EXIF GPS intact' });
    } else {
      checks.push({ id: CheckId.INTEGRITY, result: CheckResult.FAIL, detail: 'EXIF GPS stripped or absent' });
      flags.push({ code: FlagCode.METADATA_STRIPPED, severity: FlagSeverity.MEDIUM, message: 'Image metadata was stripped or unavailable.' });
      riskLevel = Math.max(riskLevel === RiskLevel.LOW ? 1 : 2, 2) === 2 ? RiskLevel.MEDIUM : riskLevel; // bump to medium if low
    }

    if (verificationContext.clientMismatch) {
      checks.push({ id: CheckId.INTEGRITY, result: CheckResult.FAIL, detail: 'Client metadata contradicted EXIF data (possible spoof)' });
      flags.push({ code: FlagCode.METADATA_SUSPICIOUS, severity: FlagSeverity.HIGH, message: 'Client-reported capture metadata differs significantly from verified EXIF data.' });
      riskLevel = RiskLevel.HIGH;
    }

    // 1. Location
    if (verificationContext.baseVerdict === ProofVerdict.NO_GPS_DATA) {
      checks.push({ id: CheckId.LOCATION, result: CheckResult.FAIL, detail: 'No GPS data to verify location' });
      riskLevel = RiskLevel.UNVERIFIABLE;
      summaryLines.push('Missing GPS data prevents location verification.');
    } else if (verificationContext.withinSiteRadius === false) {
      checks.push({ id: CheckId.LOCATION, result: CheckResult.FAIL, detail: `${verificationContext.distanceFromSiteMetres} m from registered site` });
      flags.push({ code: FlagCode.SITE_MISMATCH, severity: FlagSeverity.HIGH, message: 'Image was captured outside the acceptable site radius.' });
      riskLevel = RiskLevel.HIGH;
      summaryLines.push('Taken too far from the registered project site.');
    } else {
      checks.push({ id: CheckId.LOCATION, result: CheckResult.PASS, detail: `${verificationContext.distanceFromSiteMetres} m from registered site (within radius)` });
    }

    // 2. Timestamp
    if (verificationContext.capturedBeforeMilestoneStart) {
      checks.push({ id: CheckId.TIMESTAMP, result: CheckResult.FAIL, detail: 'Captured before milestone opened' });
      riskLevel = RiskLevel.HIGH;
      summaryLines.push('Captured before the milestone began, indicating old work.');
    } else {
      checks.push({ id: CheckId.TIMESTAMP, result: CheckResult.PASS, detail: 'Captured within valid milestone window' });
    }

    // --- CHECK 3: Duplicate (Perceptual Hash) ---
    // Only run if it's an image
    let hashResult: string | null = null;
    if (mimeType.startsWith('image/')) {
      try {
        hashResult = await imghash.hash(buffer);
        
        // Find if this hash matches any other proof's hash in the whole platform
        // We'll query all proofs that have a perceptual hash (this is inefficient for huge DBs, but works for the demo)
        const { data: hashedProofs } = await supabase.from('proofs').select('id, perceptual_hash, milestone_id').not('perceptual_hash', 'is', null);
        
        let foundDuplicate = false;
        let matchCount = 0;
        if (hashedProofs) {
          for (const hp of hashedProofs) {
            if (hp.id === proofId) continue; // skip self
            if (hp.perceptual_hash && hammingDistance(hashResult, hp.perceptual_hash) < 12) { // 12 is a common threshold for near-duplicates
              foundDuplicate = true;
              break;
            }
            matchCount++;
          }
        }

        if (foundDuplicate) {
          checks.push({ id: CheckId.DUPLICATE, result: CheckResult.FAIL, detail: 'Closely resembles an earlier proof' });
          flags.push({ code: FlagCode.NEAR_DUPLICATE, severity: FlagSeverity.HIGH, message: 'This image is a duplicate or near-duplicate of an already submitted proof.' });
          riskLevel = RiskLevel.HIGH;
          summaryLines.push('Flagged as a duplicate of an existing proof.');
        } else {
          checks.push({ id: CheckId.DUPLICATE, result: CheckResult.PASS, detail: `No match against ${matchCount} prior proofs` });
        }
      } catch (err) {
        checks.push({ id: CheckId.DUPLICATE, result: CheckResult.SKIPPED, detail: 'Could not compute perceptual hash' });
      }
    } else {
      checks.push({ id: CheckId.DUPLICATE, result: CheckResult.SKIPPED, detail: 'Not applicable for video' });
    }

    // Save perceptual hash early
    if (hashResult) {
      await supabase.from('proofs').update({ perceptual_hash: hashResult }).eq('id', proofId);
    }

    // --- CHECK 4, 5, 6: AI Vision Models (Gemini) ---
    
    // Fetch project and milestone info for context
    const { data: contextData } = await supabase
      .from('milestones')
      .select('stage, "order", projects(asset_type)')
      .eq('id', milestoneId)
      .single();

    const assetType = (contextData?.projects as any)?.asset_type ?? 'building';
    const milestoneStage = contextData?.stage ?? 'progress';
    const milestoneOrder = contextData?.order ?? 1;

    let stagePass = false;

    if (!aiClient || !mimeType.startsWith('image/')) {
      // Model unavailable or not an image
      checks.push({ id: CheckId.STAGE, result: CheckResult.SKIPPED, detail: !aiClient ? 'Model unavailable' : 'Not applicable for video' });
      checks.push({ id: CheckId.CONTINUITY, result: CheckResult.SKIPPED, detail: 'Not applicable' });
      checks.push({ id: CheckId.SEQUENCE, result: CheckResult.SKIPPED, detail: 'Not applicable' });
      
      if (!aiClient && mimeType.startsWith('image/')) {
        flags.push({ code: FlagCode.MODEL_UNAVAILABLE, severity: FlagSeverity.MEDIUM, message: 'AI verification service is unavailable. Requires manual review.' });
        if (riskLevel === RiskLevel.LOW || riskLevel === RiskLevel.MEDIUM) {
          riskLevel = RiskLevel.UNVERIFIABLE;
        }
        summaryLines.push('AI stage verification is offline; manual review required.');
      }
    } else {
      // We have AI Client and it's an image.
      try {
        const stageSchema = {
          type: "object",
          properties: {
            observedStage: { type: "string" },
            matchesClaim:  { type: "boolean" },
            completeness:  { type: "number" },
            confidence:    { type: "number" },
            reasoning:     { type: "string" },
          },
          required: ["observedStage", "matchesClaim", "completeness", "confidence", "reasoning"],
        };

        const stagePrompt = `This photograph was submitted as proof of progress on a ${assetType} build in Nigeria.\n` +
          `The agent claims it shows this milestone: "${milestoneStage}".\n\n` +
          `Describe the construction stage actually visible, and judge whether it matches the claim. ` +
          `Money is released against this decision, so be strict: if the image is ambiguous, ` +
          `obstructed, or too close-up to judge the stage, report low confidence rather than guessing. ` +
          `Write the reasoning for the person who sent the money, not for an engineer.`;

        const interaction = await aiClient.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [
            { role: "user", parts: [
              { text: stagePrompt },
              { inlineData: { mimeType: mimeType, data: buffer.toString('base64') } }
            ]}
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: stageSchema as any,
          }
        });

        const stageResult = JSON.parse(interaction.text as string);
        confidence = stageResult.confidence;

        if (stageResult.confidence < 0.7) {
          checks.push({ id: CheckId.STAGE, result: CheckResult.WARN, detail: stageResult.reasoning });
          flags.push({ code: FlagCode.INCOMPLETE_WORK, severity: FlagSeverity.MEDIUM, message: 'The model has low confidence in verifying this stage.' });
          if (riskLevel === RiskLevel.LOW || riskLevel === RiskLevel.MEDIUM) riskLevel = RiskLevel.UNVERIFIABLE;
          summaryLines.push('Image is ambiguous or obstructed.');
        } else if (!stageResult.matchesClaim) {
          checks.push({ id: CheckId.STAGE, result: CheckResult.FAIL, detail: `Observed ${stageResult.observedStage}; claimed ${milestoneStage}` });
          flags.push({ code: FlagCode.STAGE_MISMATCH, severity: FlagSeverity.HIGH, message: 'Image does not show the claimed build stage.' });
          riskLevel = RiskLevel.HIGH;
          summaryLines.push(stageResult.reasoning);
        } else {
          stagePass = true;
          checks.push({ id: CheckId.STAGE, result: CheckResult.PASS, detail: `Observed ${stageResult.observedStage}; claimed ${milestoneStage}` });
          summaryLines.push('Consistent with the claimed milestone.');
        }
      } catch (err) {
        checks.push({ id: CheckId.STAGE, result: CheckResult.SKIPPED, detail: 'AI Model failed to process' });
        flags.push({ code: FlagCode.MODEL_UNAVAILABLE, severity: FlagSeverity.MEDIUM, message: 'AI verification service encountered an error.' });
        if (riskLevel === RiskLevel.LOW || riskLevel === RiskLevel.MEDIUM) riskLevel = RiskLevel.UNVERIFIABLE;
      }
      
      // 5. Continuity
      try {
        // Find last approved proof for the project
        const { data: lastApproved } = await supabase
          .from('proofs')
          .select('file_url')
          .eq('project_id', projectId)
          .eq('status', 'approved')
          .neq('id', proofId)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastApproved && lastApproved.file_url) {
          // In a real app we'd fetch the buffer from the URL.
          // For simplicity, we just skip it if we can't easily fetch it.
          checks.push({ id: CheckId.CONTINUITY, result: CheckResult.SKIPPED, detail: 'Continuity check requires fetching remote image' });
        } else {
          checks.push({ id: CheckId.CONTINUITY, result: CheckResult.SKIPPED, detail: 'First approved proof on project, nothing to compare' });
        }
      } catch (err) {
        checks.push({ id: CheckId.CONTINUITY, result: CheckResult.SKIPPED, detail: 'AI Model failed' });
      }

      // 6. Sequence
      try {
        const { data: lastApprovedMilestone } = await supabase
          .from('proofs')
          .select('milestones("order")')
          .eq('project_id', projectId)
          .eq('status', 'approved')
          .neq('id', proofId)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastOrder = (lastApprovedMilestone?.milestones as any)?.order ?? 0;
        
        if (lastOrder === 0) {
          checks.push({ id: CheckId.SEQUENCE, result: CheckResult.SKIPPED, detail: 'First approved milestone, sequence n/a' });
        } else if (milestoneOrder < lastOrder) {
          checks.push({ id: CheckId.SEQUENCE, result: CheckResult.FAIL, detail: `Does not advance on last approved stage (${lastOrder})` });
          flags.push({ code: FlagCode.REGRESSION, severity: FlagSeverity.HIGH, message: 'Milestone sequence is out of order or regressing.' });
          riskLevel = RiskLevel.HIGH;
        } else {
          checks.push({ id: CheckId.SEQUENCE, result: CheckResult.PASS, detail: 'Advances on last approved stage' });
        }
      } catch (err) {
        checks.push({ id: CheckId.SEQUENCE, result: CheckResult.SKIPPED, detail: 'Failed to evaluate sequence' });
      }
    }

    // Finalize Summary
    let finalSummary = summaryLines.join(' ');
    if (finalSummary.trim() === '') {
      finalSummary = 'Proof appears consistent and has passed all verifiable checks.';
    }

    const verificationPayload: VerificationJSON = {
      riskLevel,
      verdict: verificationContext.baseVerdict,
      confidence,
      summary: finalSummary,
      checks,
      flags,
    };

    // Update the DB
    await supabase
      .from('proofs')
      .update({
        risk_level: verificationPayload.riskLevel,
        confidence: verificationPayload.confidence,
        verification_summary: verificationPayload.summary,
        checks: verificationPayload.checks,
        flags: verificationPayload.flags,
      })
      .eq('id', proofId);

  } catch (error) {
    console.error(`AI Verification Pipeline failed for proof ${proofId}:`, error);
    
    // Fail closed
    await supabase.from('proofs').update({
      risk_level: RiskLevel.UNVERIFIABLE,
      verification_summary: 'Verification pipeline crashed. Manual review required.',
      flags: [{ code: FlagCode.MODEL_UNAVAILABLE, severity: FlagSeverity.HIGH, message: 'System error during verification.' }],
    }).eq('id', proofId);
  }
};
