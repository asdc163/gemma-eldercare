/**
 * ElderCare Agent — Gemma 4 powered health monitoring for elderly patients.
 *
 * Runs entirely on-device using Gemma 4 2B/7B. No cloud, no data leaves the device.
 * Designed for caregivers in low-connectivity environments (rural clinics,
 * home care, nursing facilities with spotty internet).
 *
 * Core capabilities:
 * 1. Vital signs analysis with trend detection
 * 2. Drug interaction checking (offline drug database)
 * 3. Natural language care plan generation
 * 4. Multilingual patient communication (Gemma 4 supports 140+ languages)
 * 5. Image-based wound/skin assessment (Gemma 4 multimodal)
 */

import { GemmaEngine } from "./gemma-engine.js";
import { DrugDatabase } from "./drug-database.js";
import { VitalsAnalyzer } from "./vitals-analyzer.js";
import { CarePlanGenerator } from "./care-plan.js";

const SYSTEM_PROMPT = `You are ElderCare, a medical AI assistant specialized in elderly patient care.
You help caregivers monitor patient health, catch dangerous drug interactions,
and generate clear care plans in the caregiver's language.

You ALWAYS:
- Flag dangerous vital sign trends immediately
- Check drug interactions before any medication change
- Write care plans in simple, actionable language
- Note when a situation requires a doctor's attention
- Respect patient privacy — all data stays on-device

You NEVER:
- Diagnose conditions (you flag concerns for doctors)
- Recommend stopping prescribed medications
- Share patient data externally
- Minimize concerning symptoms`;

export class ElderCareAgent {
  constructor(options = {}) {
    this.modelSize = options.modelSize || "7b";
    this.language = options.language || "en";
    this.engine = new GemmaEngine({
      modelSize: this.modelSize,
      systemPrompt: SYSTEM_PROMPT,
    });
    this.drugs = new DrugDatabase();
    this.vitals = new VitalsAnalyzer();
    this.carePlan = new CarePlanGenerator(this.engine);
    this.patients = new Map();
  }

  // ─── Patient Management ───────────────────────────────────

  registerPatient(id, profile) {
    this.patients.set(id, {
      ...profile,
      vitalsHistory: [],
      medications: profile.medications || [],
      alerts: [],
      carePlans: [],
      registeredAt: new Date().toISOString(),
    });
    return { patientId: id, status: "registered" };
  }

  getPatient(id) {
    const patient = this.patients.get(id);
    if (!patient) throw new Error(`Patient ${id} not found`);
    return patient;
  }

  // ─── Vital Signs ──────────────────────────────────────────

  async recordVitals(patientId, vitals) {
    const patient = this.getPatient(patientId);
    const timestamped = {
      ...vitals,
      timestamp: new Date().toISOString(),
    };

    patient.vitalsHistory.push(timestamped);

    // Analyze with rule-based engine first (fast, no model needed)
    const ruleAnalysis = this.vitals.analyze(vitals, patient.vitalsHistory);

    // If concerning, use Gemma for deeper analysis
    let gemmaAnalysis = null;
    if (ruleAnalysis.alerts.length > 0) {
      gemmaAnalysis = await this.engine.analyze({
        task: "vitals_assessment",
        currentVitals: vitals,
        recentHistory: patient.vitalsHistory.slice(-10),
        patientAge: patient.age,
        medications: patient.medications,
        alerts: ruleAnalysis.alerts,
      });

      patient.alerts.push({
        type: "vitals",
        severity: ruleAnalysis.maxSeverity,
        details: ruleAnalysis.alerts,
        gemmaAssessment: gemmaAnalysis.assessment,
        timestamp: timestamped.timestamp,
      });
    }

    return {
      status: ruleAnalysis.status,
      alerts: ruleAnalysis.alerts,
      trends: ruleAnalysis.trends,
      gemmaAssessment: gemmaAnalysis?.assessment || null,
      recommendation: gemmaAnalysis?.recommendation || "Vitals within normal range.",
    };
  }

  // ─── Drug Interactions ────────────────────────────────────

  async checkDrugInteractions(patientId, newMedication) {
    const patient = this.getPatient(patientId);
    const currentMeds = patient.medications;

    // Check offline database first
    const interactions = this.drugs.checkInteractions(
      currentMeds,
      newMedication
    );

    // Use Gemma for clinical context if interactions found
    let clinicalContext = null;
    if (interactions.length > 0) {
      clinicalContext = await this.engine.analyze({
        task: "drug_interaction_context",
        patientAge: patient.age,
        currentMedications: currentMeds,
        newMedication,
        interactions,
        comorbidities: patient.conditions || [],
      });

      patient.alerts.push({
        type: "drug_interaction",
        severity: interactions[0].severity,
        medication: newMedication,
        interactions,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      safe: interactions.length === 0,
      interactions,
      clinicalContext: clinicalContext?.assessment || null,
      recommendation: clinicalContext?.recommendation ||
        `No known interactions between ${newMedication} and current medications.`,
    };
  }

  // ─── Care Plans ───────────────────────────────────────────

  async generateCarePlan(patientId, options = {}) {
    const patient = this.getPatient(patientId);

    const plan = await this.carePlan.generate({
      patient: {
        age: patient.age,
        conditions: patient.conditions,
        medications: patient.medications,
        recentVitals: patient.vitalsHistory.slice(-7),
        recentAlerts: patient.alerts.slice(-5),
      },
      language: options.language || this.language,
      focus: options.focus || "daily_monitoring",
    });

    patient.carePlans.push({
      plan,
      generatedAt: new Date().toISOString(),
    });

    return plan;
  }

  // ─── Image Assessment (Gemma 4 Multimodal) ────────────────

  async assessImage(patientId, imageData, context) {
    const patient = this.getPatient(patientId);

    const assessment = await this.engine.analyzeImage({
      image: imageData,
      context: context || "General skin/wound assessment",
      patientAge: patient.age,
      medications: patient.medications,
    });

    return {
      assessment: assessment.description,
      concerns: assessment.concerns,
      recommendation: assessment.recommendation,
      requiresDoctorReview: assessment.severity !== "normal",
    };
  }

  // ─── Natural Language Query ───────────────────────────────

  async query(patientId, question) {
    const patient = this.getPatient(patientId);

    const response = await this.engine.chat({
      question,
      patientContext: {
        age: patient.age,
        conditions: patient.conditions,
        medications: patient.medications,
        recentVitals: patient.vitalsHistory.slice(-5),
        recentAlerts: patient.alerts.slice(-3),
      },
    });

    return {
      answer: response.text,
      sources: response.sources || [],
      confidence: response.confidence,
    };
  }

  // ─── Export (privacy-safe) ────────────────────────────────

  exportPatientSummary(patientId) {
    const patient = this.getPatient(patientId);
    return {
      patientId,
      age: patient.age,
      conditions: patient.conditions,
      medicationCount: patient.medications.length,
      totalVitalsRecorded: patient.vitalsHistory.length,
      activeAlerts: patient.alerts.filter(
        (a) => Date.now() - new Date(a.timestamp).getTime() < 86400000
      ).length,
      carePlansGenerated: patient.carePlans.length,
      lastUpdated: patient.vitalsHistory.length > 0
        ? patient.vitalsHistory[patient.vitalsHistory.length - 1].timestamp
        : patient.registeredAt,
    };
  }
}
