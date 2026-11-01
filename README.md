# ElderCare experiments

A Node.js prototype exploring rule-based health-data checks alongside configurable model helpers.

The source separates vital-sign rules, a small medication-interaction table, care-plan templates and model-backend adapters. It is an engineering experiment, with no clinical validation or compliance assessment.

## Implementation

- `src/agent.js` coordinates the example flow.
- `src/vitals-analyzer.js` and `src/drug-database.js` contain hand-maintained rules and data.
- `src/care-plan.js` contains care-plan generation logic.
- `src/gemma-engine.js` contains Ollama and Google API request paths. Its Kaggle path is a placeholder response.

The default demo includes rule and template output. That output does not establish that a model ran successfully. Model identifiers, local hardware compatibility and live provider behavior have not been verified in this portfolio review.

## Run the demo

```bash
npm install
node src/demo.js
```

Inspect `src/gemma-engine.js` before selecting a backend. The API backend sends input to an external service; local execution alone does not make every configuration offline or private.

## Scope

Use synthetic examples when exploring the project. The reference rules and generated text have not been established as safe clinical advice. This repository makes no compliance, diagnosis, drug-safety or data-leak guarantee.
