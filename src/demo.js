/**
 * ElderCare Demo — shows the full agent workflow without needing
 * a live Gemma model. Uses the rule-based analyzers + template care plans.
 *
 * Run: node src/demo.js
 */

import { ElderCareAgent } from "./agent.js";

async function runDemo() {
  console.log("=== ElderCare Agent Demo ===\n");

  const agent = new ElderCareAgent({
    modelSize: "7b",
    language: "en",
  });

  // 1. Register a patient
  console.log("1. Registering patient...");
  const reg = agent.registerPatient("patient-wang", {
    age: 78,
    conditions: ["hypertension", "type2_diabetes", "atrial_fibrillation"],
    medications: ["metformin", "lisinopril", "warfarin", "amlodipine"],
  });
  console.log(`   Patient registered: ${reg.patientId}\n`);

  // 2. Record normal vitals
  console.log("2. Recording normal vitals...");
  const vitals1 = await agent.recordVitals("patient-wang", {
    systolic: 135,
    diastolic: 82,
    heartRate: 72,
    spO2: 96,
    glucose: 128,
    temperature: 36.8,
  });
  console.log(`   Status: ${vitals1.status}`);
  console.log(`   Alerts: ${vitals1.alerts.length}\n`);

  // 3. Record concerning vitals
  console.log("3. Recording elevated vitals...");
  const vitals2 = await agent.recordVitals("patient-wang", {
    systolic: 165,
    diastolic: 98,
    heartRate: 92,
    spO2: 93,
    glucose: 210,
    temperature: 37.2,
  });
  console.log(`   Status: ${vitals2.status}`);
  for (const alert of vitals2.alerts) {
    console.log(`   ALERT: ${alert.message}`);
  }
  console.log();

  // 4. Check drug interaction
  console.log("4. Checking drug interaction: adding Aspirin to Warfarin patient...");
  const interaction = await agent.checkDrugInteractions("patient-wang", "aspirin");
  console.log(`   Safe: ${interaction.safe}`);
  for (const i of interaction.interactions) {
    console.log(`   ${i.severity}: ${i.drug1} + ${i.drug2}`);
    console.log(`   Effect: ${i.effect}`);
  }
  console.log();

  // 5. Check safe medication
  console.log("5. Checking safe medication: adding Omeprazole...");
  const safe = await agent.checkDrugInteractions("patient-wang", "omeprazole");
  console.log(`   Safe: ${safe.safe}`);
  console.log(`   ${safe.recommendation}\n`);

  // 6. Generate care plan
  console.log("6. Generating daily care plan...");
  const plan = await agent.generateCarePlan("patient-wang", {
    focus: "daily_monitoring",
  });
  console.log(`   Plan type: ${plan.planType}`);
  console.log(`   Sections: ${plan.sections.length}`);
  for (const section of plan.sections) {
    console.log(`   [${section.time}] ${section.title} (${section.priority})`);
  }
  console.log(`   Emergency signs: ${plan.emergencySigns.length} defined\n`);

  // 7. Patient summary
  console.log("7. Patient summary:");
  const summary = agent.exportPatientSummary("patient-wang");
  console.log(`   Age: ${summary.age}`);
  console.log(`   Vitals recorded: ${summary.totalVitalsRecorded}`);
  console.log(`   Active alerts: ${summary.activeAlerts}`);
  console.log(`   Care plans: ${summary.carePlansGenerated}`);

  console.log("\n=== Demo Complete ===");
}

runDemo().catch(console.error);
