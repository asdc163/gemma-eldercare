# ElderCare — Gemma 4 Health Agent

Privacy-first AI health monitoring for elderly patients. Runs entirely on-device using Gemma 4 — no cloud, no data leaks, works offline.

## The Problem

1.4 billion people will be over 60 by 2030. Most live in areas with limited healthcare access, spotty internet, and caregivers who aren't medical professionals. They need an AI health assistant that:

- Works without internet (rural clinics, home care)
- Keeps all patient data on-device (HIPAA/privacy by architecture)
- Speaks the caregiver's language (Gemma 4 supports 140+ languages)
- Catches dangerous drug interactions before they happen
- Doesn't require medical training to use

## What It Does

An AI agent powered by Gemma 4 that monitors elderly patients' health:

**Vital Signs Monitoring** — Tracks blood pressure, heart rate, SpO2, glucose, temperature. Rule-based first pass (instant, no inference needed) + Gemma analysis for concerning readings.

**Drug Interaction Checking** — Offline database of 30+ common elderly medication interactions with severity classification (CRITICAL/SEVERE/MODERATE). Gemma provides clinical context and patient-specific risk assessment.

**Care Plan Generation** — Daily care plans in any language, personalized to the patient's conditions, medications, and recent health trends. Clear, actionable steps for non-medical caregivers.

**Image Assessment** — Gemma 4 multimodal: photograph a wound, rash, or skin change and get an initial assessment with severity rating.

**Natural Language Queries** — Caregivers ask questions in their language. "Is this blood pressure normal for a 78-year-old on lisinopril?" gets a contextual answer.

## Why Gemma 4

This project specifically leverages Gemma 4's strengths:

| Gemma 4 Feature | How We Use It |
|------------------|---------------|
| **On-device inference** | Entire agent runs locally — 2B model fits on a phone, 7B on a laptop |
| **Multimodal** | Wound/skin image assessment without uploading to cloud |
| **Native function calling** | Agent autonomously decides when to check vitals, drugs, or generate plans |
| **140+ languages** | Care plans in caregiver's native language, no translation layer needed |
| **Low-resource friendly** | Works on consumer hardware in low-bandwidth environments |

## Architecture

```
Caregiver Input (vitals/question/image)
         |
         v
  ┌─────────────────────────┐
  │   ElderCare Agent        │
  │  ┌───────────────────┐   │
  │  │ Rule-Based Layer   │   │  ← Fast check (no model needed)
  │  │ - Vital ranges     │   │
  │  │ - Drug database    │   │
  │  └───────┬───────────┘   │
  │          │ If concerning  │
  │          v               │
  │  ┌───────────────────┐   │
  │  │ Gemma 4 Engine     │   │  ← Deep analysis + natural language
  │  │ - Text analysis    │   │
  │  │ - Image assessment │   │
  │  │ - Function calling │   │
  │  │ - Care plans       │   │
  │  └───────────────────┘   │
  └─────────────────────────┘
         |
         v
  On-Device Storage Only
  (nothing leaves the device)
```

Two-tier design: rule-based analysis runs instantly for routine checks. Gemma 4 is only invoked when something needs deeper analysis or natural language generation. This saves battery and compute on resource-constrained devices.

## Quick Start

```bash
npm install
node src/demo.js
```

The demo runs without a live Gemma model — it uses the rule-based analyzers and template care plans to show the full workflow.

### With Gemma 4 (via Ollama)

```bash
# Install Ollama and pull Gemma 4
ollama pull gemma4:7b

# Run with live inference
ELDERCARE_BACKEND=ollama node src/demo.js
```

### With Google AI Studio API

```bash
ELDERCARE_BACKEND=api GOOGLE_AI_API_KEY=your-key node src/demo.js
```

## Drug Interaction Database

30+ validated interaction pairs covering common elderly medications:
- Anticoagulants (Warfarin, Clopidogrel)
- Cardiac drugs (Digoxin, Amiodarone, Metoprolol)
- Diabetes medications (Metformin, Insulin)
- Blood pressure drugs (Lisinopril, Amlodipine, Verapamil)
- Pain/anti-inflammatory (Ibuprofen, Aspirin, Acetaminophen)
- Psychiatric medications (SSRIs, Lithium)
- Antibiotics (Ciprofloxacin, Erythromycin, Clarithromycin)

Includes brand name → generic name mapping (Coumadin → warfarin, etc.)

## Vital Signs Ranges

Elderly-adjusted reference ranges for:
- Blood pressure (accommodates higher baseline in elderly)
- Heart rate (lower resting HR common in elderly)
- SpO2 (slightly lower baseline acceptable)
- Blood glucose, temperature, respiratory rate

## Project Structure

```
src/
  agent.js           # Main ElderCare agent orchestrator
  gemma-engine.js    # Gemma 4 inference (Kaggle/Ollama/API backends)
  drug-database.js   # Offline drug interaction database
  vitals-analyzer.js # Rule-based vital signs analysis
  care-plan.js       # Care plan generator
  demo.js            # Interactive demo
```

## Privacy Architecture

- All patient data stored in-memory only (never written to disk by default)
- Gemma model runs on-device — no API calls in production mode
- No telemetry, no analytics, no external connections
- Export function only outputs aggregate statistics, never raw patient data
- Designed for HIPAA compliance by architecture, not by policy

## License

Apache-2.0
