# Bankole — AI & Verification Capabilities

The Bankole backend heavily leverages **Google's Gemini 1.5 Flash** model (via `@google/genai`) to provide an automated, zero-trust verification system for construction progress. 

Because Senders in the diaspora cannot physically visit the construction site, the backend acts as a highly intelligent, incorruptible inspector. It performs multi-layered visual and metadata checks on every uploaded proof before funds can be released.

## 1. AI Visual Stage Match

**The Goal:** Ensure the Agent isn't claiming money for "Roofing" while uploading a picture of a "Foundation".
**The Mechanism:** 
When an image is uploaded, the backend passes the image buffer and the project's asset type to Gemini 1.5 Flash with this strict prompt:

> *This photograph was submitted as proof of progress on a house build in Nigeria. The agent claims it shows this milestone: "Block work to lintel". Evaluate this based strictly on Nigerian standard construction practices (e.g., sandcrete blocks, reinforced concrete pillars). Describe the construction stage actually visible, and judge whether it matches the claim. Money is released against this decision, so be strict: if the image is ambiguous, obstructed, or too close-up to judge the stage, report low confidence rather than guessing. Write the reasoning for the person who sent the money, not for an engineer.*

**The Output:**
Gemini evaluates the image and returns a strict JSON object detailing the `observedStage`, `confidence`, and whether it `matchesClaim`. If confidence is below 70%, or if the claim doesn't match, the backend automatically sets the Risk Level to `HIGH` and blocks automatic escrow release.

## 2. AI Continuity Check (Anti-Spoofing)

**The Goal:** Ensure the Agent isn't taking pictures of a *different* completed house to fake progress on this one.
**The Mechanism:**
The backend fetches the image buffer of the **previously approved** milestone for the project, and passes BOTH the old image and the new image to Gemini simultaneously with this prompt:

> *These are two photos from a construction site in Nigeria. The first image is the previously approved milestone. The second image is the new submission. Do they look like they are of the same building/site? Ignore transient environmental factors like rain, time of day, or lighting. Answer true if they are consistent in architecture, surroundings, and materials, or false if they appear to be completely different locations.*

**Edge Case (First Milestone):** If this is the very first milestone, there is no previous image to compare against. The backend gracefully skips this check, relying instead on the GPS distance verification for the baseline.

## 3. Strict JSON Enforcement (Deterministic Responses)

**The Problem:** Large Language Models usually output free-flowing text (like Markdown), which breaks backend code trying to parse `{ "isSameSite": true }`.
**The Solution:**
The Bankole backend uses the brand new `responseSchema` config in the Gemini SDK to force the model to respond *only* with valid, type-safe JSON. 

```typescript
config: {
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      isSameSite: { type: "boolean" },
      reasoning: { type: "string" }
    },
    required: ["isSameSite", "reasoning"]
  }
}
```
By using `responseSchema`, Gemini completely disables its standard conversational output mode and switches to a strict JSON-generation mode. The backend can safely run `JSON.parse(interaction.text)` with a 100% guarantee that the output will perfectly match the expected schema.

## 4. Metadata GPS Verification & Fallbacks

**The Fallacy of EXIF:**
Standard EXIF data is **not** cryptographic. It is easily editable plain text metadata. A malicious agent can forge EXIF coordinates using simple scripts, or legitimate agents might use WhatsApp which automatically strips EXIF data.

**The Solution:**
Bankole treats EXIF as a *weak signal*, not absolute proof. The backend extracts hidden EXIF metadata from the original image file (using `exif-parser`). It uses the mathematically complex **Haversine formula** to calculate the exact distance (in metres) between where the photo was taken and where the project is officially located. 

* If the EXIF is completely missing (stripped by apps), it is flagged as `NO_GPS_DATA` and escalated for manual Sender review.
* If the distance exceeds the acceptable radius (e.g., 200m), it is instantly flagged as a `SITE_MISMATCH` (`HIGH` risk).

## 5. System Reliability & Fallbacks

If the Gemini API experiences an outage, network timeout, or triggers a safety filter block (e.g., detecting PII like faces), the backend is designed to fail gracefully. 
The system catches the API error, flags the proof with `MODEL_UNAVAILABLE`, sets the risk level to `UNVERIFIABLE`, and passes the proof to the human Sender for a manual visual override. Escrow is never automatically released if the AI is offline.
