/**
 * Gemma 4 Engine — Local inference wrapper.
 *
 * Supports multiple backends:
 * 1. Kaggle Notebooks (for hackathon demo)
 * 2. Ollama (local deployment)
 * 3. Google AI Studio API (development/testing)
 *
 * For the hackathon, we use Kaggle's free GPU quota.
 * For production, this runs locally via Ollama — zero cloud dependency.
 */

const GEMMA_TOOLS = [
  {
    name: "check_vitals",
    description: "Analyze patient vital signs and detect abnormal trends",
    parameters: {
      type: "object",
      properties: {
        systolic: { type: "number", description: "Systolic blood pressure (mmHg)" },
        diastolic: { type: "number", description: "Diastolic blood pressure (mmHg)" },
        heartRate: { type: "number", description: "Heart rate (bpm)" },
        temperature: { type: "number", description: "Body temperature (Celsius)" },
        spO2: { type: "number", description: "Blood oxygen saturation (%)" },
        glucose: { type: "number", description: "Blood glucose (mg/dL)" },
      },
    },
  },
  {
    name: "check_drug_interaction",
    description: "Check for dangerous drug interactions between medications",
    parameters: {
      type: "object",
      properties: {
        drug1: { type: "string", description: "First medication name" },
        drug2: { type: "string", description: "Second medication name" },
      },
      required: ["drug1", "drug2"],
    },
  },
  {
    name: "generate_care_plan",
    description: "Generate a daily care plan for the patient",
    parameters: {
      type: "object",
      properties: {
        focus: { type: "string", enum: ["daily_monitoring", "post_discharge", "chronic_management"] },
        language: { type: "string", description: "Output language code (e.g., en, zh, es)" },
      },
    },
  },
];

export class GemmaEngine {
  constructor(options = {}) {
    this.modelSize = options.modelSize || "7b";
    this.systemPrompt = options.systemPrompt || "";
    this.backend = options.backend || "kaggle"; // kaggle | ollama | api
    this.apiKey = options.apiKey || process.env.GOOGLE_AI_API_KEY;
    this.ollamaUrl = options.ollamaUrl || "http://localhost:11434";
    this.conversationHistory = [];
  }

  getModelId() {
    const modelMap = {
      "2b": "gemma-4-2b-it",
      "7b": "gemma-4-7b-it",
      "27b": "gemma-4-27b-it",
    };
    return modelMap[this.modelSize] || "gemma-4-7b-it";
  }

  // ─── Main inference ───────────────────────────────────────

  async analyze(input) {
    const prompt = this._buildAnalysisPrompt(input);
    const response = await this._infer(prompt);
    return this._parseAnalysisResponse(response);
  }

  async analyzeImage(input) {
    const prompt = this._buildImagePrompt(input);
    const response = await this._inferMultimodal(prompt, input.image);
    return this._parseImageResponse(response);
  }

  async chat(input) {
    const prompt = this._buildChatPrompt(input);
    const response = await this._infer(prompt);

    this.conversationHistory.push(
      { role: "user", content: input.question },
      { role: "assistant", content: response }
    );

    return {
      text: response,
      confidence: this._estimateConfidence(response),
    };
  }

  // ─── Function calling (Gemma 4 native) ────────────────────

  async callWithTools(prompt, availableTools = GEMMA_TOOLS) {
    const messages = [
      { role: "system", content: this.systemPrompt },
      ...this.conversationHistory.slice(-10),
      { role: "user", content: prompt },
    ];

    const response = await this._inferWithTools(messages, availableTools);

    if (response.toolCalls && response.toolCalls.length > 0) {
      return {
        type: "tool_call",
        calls: response.toolCalls,
        reasoning: response.text,
      };
    }

    return {
      type: "text",
      text: response.text,
    };
  }

  // ─── Backend-specific inference ───────────────────────────

  async _infer(prompt) {
    switch (this.backend) {
      case "ollama":
        return this._inferOllama(prompt);
      case "api":
        return this._inferAPI(prompt);
      case "kaggle":
      default:
        return this._inferKaggle(prompt);
    }
  }

  async _inferOllama(prompt) {
    const res = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.getModelId(),
        prompt: `${this.systemPrompt}\n\n${prompt}`,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 1024,
        },
      }),
    });
    const data = await res.json();
    return data.response;
  }

  async _inferAPI(prompt) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.getModelId()}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${this.systemPrompt}\n\n${prompt}` }] }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            maxOutputTokens: 1024,
          },
        }),
      }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  async _inferKaggle(prompt) {
    // In Kaggle notebook context, use the pre-loaded model
    // This is a placeholder — actual inference happens in the notebook
    console.log(`[Gemma ${this.modelSize}] Inference request (Kaggle backend)`);
    return `[Gemma ${this.modelSize} response — run in Kaggle notebook for actual inference]`;
  }

  async _inferMultimodal(prompt, imageData) {
    if (this.backend === "api") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.getModelId()}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `${this.systemPrompt}\n\n${prompt}` },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: typeof imageData === "string" ? imageData : Buffer.from(imageData).toString("base64"),
                  },
                },
              ],
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1024,
            },
          }),
        }
      );
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // Ollama multimodal
    if (this.backend === "ollama") {
      const res = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.getModelId(),
          prompt: `${this.systemPrompt}\n\n${prompt}`,
          images: [typeof imageData === "string" ? imageData : Buffer.from(imageData).toString("base64")],
          stream: false,
        }),
      });
      const data = await res.json();
      return data.response;
    }

    return `[Multimodal analysis — run in Kaggle notebook]`;
  }

  async _inferWithTools(messages, tools) {
    // Gemma 4 native function calling format
    const toolDefs = tools.map((t) => ({
      functionDeclarations: [{
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }],
    }));

    if (this.backend === "api") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.getModelId()}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : m.role,
              parts: [{ text: m.content }],
            })),
            tools: toolDefs,
            generationConfig: { temperature: 0.2 },
          }),
        }
      );
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const toolCalls = parts
        .filter((p) => p.functionCall)
        .map((p) => ({
          name: p.functionCall.name,
          args: p.functionCall.args,
        }));
      const text = parts.find((p) => p.text)?.text || "";
      return { toolCalls, text };
    }

    return { toolCalls: [], text: "[Tool calling — run with API backend]" };
  }

  // ─── Prompt builders ──────────────────────────────────────

  _buildAnalysisPrompt(input) {
    return `TASK: ${input.task}

PATIENT DATA:
- Age: ${input.patientAge || "unknown"}
- Medications: ${JSON.stringify(input.currentMedications || input.medications || [])}
${input.currentVitals ? `- Current Vitals: ${JSON.stringify(input.currentVitals)}` : ""}
${input.alerts ? `- Active Alerts: ${JSON.stringify(input.alerts)}` : ""}
${input.interactions ? `- Drug Interactions Found: ${JSON.stringify(input.interactions)}` : ""}
${input.comorbidities ? `- Comorbidities: ${JSON.stringify(input.comorbidities)}` : ""}
${input.recentHistory ? `- Recent History (last ${input.recentHistory.length} readings): ${JSON.stringify(input.recentHistory.slice(-3))}` : ""}

Respond in JSON format with fields: assessment, severity (normal/warning/critical), recommendation, requiresDoctorReview (boolean).`;
  }

  _buildImagePrompt(input) {
    return `Analyze this image for a ${input.patientAge || "elderly"}-year-old patient.
Context: ${input.context}
Current medications: ${JSON.stringify(input.medications || [])}

Describe what you observe. Flag any concerns. Rate severity as normal/mild/moderate/severe.
Respond in JSON: description, concerns (array), severity, recommendation, requiresDoctorReview (boolean).`;
  }

  _buildChatPrompt(input) {
    const ctx = input.patientContext;
    return `Patient context: ${ctx.age} years old, conditions: ${JSON.stringify(ctx.conditions || [])}, medications: ${JSON.stringify(ctx.medications || [])}
Recent vitals: ${JSON.stringify(ctx.recentVitals?.slice(-2) || [])}
Recent alerts: ${JSON.stringify(ctx.recentAlerts || [])}

Caregiver question: ${input.question}

Answer clearly and concisely. If unsure, say so. If it requires a doctor, say that.`;
  }

  _parseAnalysisResponse(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}
    return {
      assessment: text,
      severity: "unknown",
      recommendation: text,
      requiresDoctorReview: true,
    };
  }

  _parseImageResponse(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}
    return {
      description: text,
      concerns: [],
      severity: "unknown",
      recommendation: "Please consult a healthcare provider.",
      requiresDoctorReview: true,
    };
  }

  _estimateConfidence(response) {
    const hedgeWords = ["might", "possibly", "unclear", "not sure", "uncertain", "may be"];
    const hedgeCount = hedgeWords.filter((w) => response.toLowerCase().includes(w)).length;
    if (hedgeCount >= 2) return "low";
    if (hedgeCount >= 1) return "medium";
    return "high";
  }
}
