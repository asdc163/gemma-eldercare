/**
 * Rule-based vital signs analyzer.
 * Fast first-pass analysis — no model inference needed.
 * Gemma is only invoked when this finds something concerning.
 */

const RANGES = {
  systolic: {
    normal: [90, 140],
    warning: [80, 160],
    // Outside warning = critical
    unit: "mmHg",
    label: "Systolic BP",
  },
  diastolic: {
    normal: [60, 90],
    warning: [50, 100],
    unit: "mmHg",
    label: "Diastolic BP",
  },
  heartRate: {
    normal: [60, 100],
    warning: [50, 120],
    unit: "bpm",
    label: "Heart Rate",
  },
  temperature: {
    normal: [36.1, 37.5],
    warning: [35.5, 38.5],
    unit: "°C",
    label: "Temperature",
  },
  spO2: {
    normal: [95, 100],
    warning: [90, 100],
    unit: "%",
    label: "SpO2",
  },
  glucose: {
    normal: [70, 140],
    warning: [54, 250],
    unit: "mg/dL",
    label: "Blood Glucose",
  },
  respiratoryRate: {
    normal: [12, 20],
    warning: [8, 30],
    unit: "breaths/min",
    label: "Respiratory Rate",
  },
};

// Elderly-specific adjustments
const ELDERLY_ADJUSTMENTS = {
  systolic: { normal: [100, 150] },  // slightly higher acceptable range
  heartRate: { normal: [55, 100] },  // lower resting HR common
  spO2: { normal: [93, 100] },       // slightly lower baseline acceptable
};

export class VitalsAnalyzer {
  constructor(options = {}) {
    this.elderlyMode = options.elderlyMode !== false;
    this.ranges = this._buildRanges();
  }

  _buildRanges() {
    const ranges = { ...RANGES };
    if (this.elderlyMode) {
      for (const [key, adj] of Object.entries(ELDERLY_ADJUSTMENTS)) {
        ranges[key] = { ...ranges[key], normal: adj.normal };
      }
    }
    return ranges;
  }

  analyze(vitals, history = []) {
    const alerts = [];
    const trends = {};
    let maxSeverity = "normal";

    for (const [key, value] of Object.entries(vitals)) {
      if (key === "timestamp" || !this.ranges[key]) continue;

      const range = this.ranges[key];
      const status = this._checkRange(value, range);

      if (status !== "normal") {
        alerts.push({
          vital: key,
          label: range.label,
          value,
          unit: range.unit,
          status,
          message: this._alertMessage(range.label, value, range.unit, status),
        });
        if (this._severityRank(status) > this._severityRank(maxSeverity)) {
          maxSeverity = status;
        }
      }

      // Trend analysis
      if (history.length >= 3) {
        const trend = this._analyzeTrend(key, history);
        if (trend) {
          trends[key] = trend;
          if (trend.concerning) {
            alerts.push({
              vital: key,
              label: range.label,
              value,
              unit: range.unit,
              status: "warning",
              message: `${range.label} ${trend.direction} trend: ${trend.changePercent.toFixed(1)}% over last ${trend.readings} readings`,
            });
          }
        }
      }
    }

    return {
      status: maxSeverity,
      maxSeverity,
      alerts,
      trends,
      timestamp: new Date().toISOString(),
    };
  }

  _checkRange(value, range) {
    if (value >= range.normal[0] && value <= range.normal[1]) return "normal";
    if (value >= range.warning[0] && value <= range.warning[1]) return "warning";
    return "critical";
  }

  _severityRank(status) {
    return { normal: 0, warning: 1, critical: 2 }[status] || 0;
  }

  _alertMessage(label, value, unit, status) {
    const prefix = status === "critical" ? "CRITICAL" : "WARNING";
    return `${prefix}: ${label} at ${value} ${unit}`;
  }

  _analyzeTrend(key, history) {
    const values = history
      .filter((h) => h[key] !== undefined)
      .map((h) => h[key]);

    if (values.length < 3) return null;

    const recent = values.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const change = last - first;
    const changePercent = (change / first) * 100;

    const direction = change > 0 ? "rising" : "falling";
    const concerning = Math.abs(changePercent) > 10; // >10% change is concerning

    return {
      direction,
      change,
      changePercent,
      readings: recent.length,
      concerning,
      values: recent,
    };
  }
}
