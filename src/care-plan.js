/**
 * Care plan generator — uses Gemma 4 to create personalized,
 * actionable daily care plans in the caregiver's language.
 */

export class CarePlanGenerator {
  constructor(engine) {
    this.engine = engine;
  }

  async generate(input) {
    const { patient, language, focus } = input;

    const prompt = `Generate a daily care plan for this elderly patient.

PATIENT PROFILE:
- Age: ${patient.age}
- Conditions: ${JSON.stringify(patient.conditions || [])}
- Medications: ${JSON.stringify(patient.medications || [])}
- Recent vitals trend: ${this._summarizeVitals(patient.recentVitals)}
- Recent alerts: ${this._summarizeAlerts(patient.recentAlerts)}

CARE PLAN TYPE: ${focus}
OUTPUT LANGUAGE: ${language}

Create a structured care plan with:
1. Morning routine (vitals check, medications, breakfast considerations)
2. Midday activities (mobility, hydration, meal)
3. Afternoon monitoring (vitals recheck, medication doses)
4. Evening routine (dinner, medications, sleep prep)
5. Emergency signs to watch for
6. When to call a doctor immediately

Use simple language. Each step should be a clear action the caregiver can follow.
Format as JSON with sections array, each containing: time, title, actions (array of strings), priority (routine/important/urgent).`;

    const response = await this.engine.analyze({
      task: "care_plan_generation",
      patientAge: patient.age,
      medications: patient.medications,
      currentVitals: patient.recentVitals?.[patient.recentVitals.length - 1],
      recentHistory: patient.recentVitals,
      alerts: patient.recentAlerts,
    });

    // If Gemma returns valid JSON, use it; otherwise, generate a template
    if (response.assessment && typeof response.assessment === "object") {
      return response.assessment;
    }

    // Fallback: structured template
    return this._generateTemplate(patient, focus);
  }

  _summarizeVitals(vitals) {
    if (!vitals || vitals.length === 0) return "No recent vitals";
    const latest = vitals[vitals.length - 1];
    const parts = [];
    if (latest.systolic) parts.push(`BP ${latest.systolic}/${latest.diastolic}`);
    if (latest.heartRate) parts.push(`HR ${latest.heartRate}`);
    if (latest.spO2) parts.push(`SpO2 ${latest.spO2}%`);
    if (latest.glucose) parts.push(`Glucose ${latest.glucose}`);
    return parts.join(", ") || "Partial data";
  }

  _summarizeAlerts(alerts) {
    if (!alerts || alerts.length === 0) return "No recent alerts";
    return alerts
      .map((a) => `${a.severity}: ${a.type}`)
      .join("; ");
  }

  _generateTemplate(patient, focus) {
    return {
      patientAge: patient.age,
      planType: focus,
      generatedAt: new Date().toISOString(),
      sections: [
        {
          time: "07:00",
          title: "Morning Check",
          actions: [
            "Check blood pressure and heart rate",
            "Record blood glucose (if diabetic)",
            "Administer morning medications with food",
            "Ensure adequate hydration (1 glass water with meds)",
          ],
          priority: "important",
        },
        {
          time: "10:00",
          title: "Mid-Morning Activity",
          actions: [
            "Encourage light walking or stretching (10-15 min)",
            "Offer water or tea",
            "Check for dizziness or discomfort",
          ],
          priority: "routine",
        },
        {
          time: "12:00",
          title: "Lunch & Midday Meds",
          actions: [
            "Balanced meal — monitor portion and intake",
            "Administer midday medications if prescribed",
            "Note appetite changes",
          ],
          priority: "important",
        },
        {
          time: "15:00",
          title: "Afternoon Monitoring",
          actions: [
            "Recheck blood pressure if morning was elevated",
            "Encourage rest period",
            "Monitor for medication side effects",
          ],
          priority: "routine",
        },
        {
          time: "18:00",
          title: "Evening Routine",
          actions: [
            "Dinner — light meal recommended",
            "Administer evening medications",
            "Gentle activity — no caffeine after this time",
          ],
          priority: "important",
        },
        {
          time: "21:00",
          title: "Bedtime Prep",
          actions: [
            "Final vitals check (BP, HR)",
            "Administer bedtime medications",
            "Ensure safe sleeping environment (night light, bed rails if needed)",
            "Set medication reminders for next morning",
          ],
          priority: "important",
        },
      ],
      emergencySigns: [
        "Sudden severe headache or confusion",
        "Chest pain or difficulty breathing",
        "Blood pressure above 180/120 or below 80/50",
        "Heart rate above 150 or below 40",
        "SpO2 below 90%",
        "Blood glucose below 54 or above 400 mg/dL",
        "Sudden weakness on one side of body",
        "Uncontrolled bleeding",
      ],
    };
  }
}
