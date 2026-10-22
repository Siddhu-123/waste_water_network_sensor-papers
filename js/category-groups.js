// Library taxonomy: a few major groups, each with sub-groups built from the
// contributors' own categories. Contributor files stay unchanged; a record
// joins a sub-group through its category, or through a per-record override
// when its category is broader than the sub-group (for example "Water Quality").
// A record whose category is not listed falls into "Other" so it never disappears.
window.CATEGORY_GROUPS = {
  academic: {
    field: "filterCategory",
    pillars: [
      { key: "sensing", label: "Sensing", topic: "Sensors" },
      { key: "placement", label: "Placement", topic: "OSP" },
    ],
    groups: [
      {
        key: "level-flow",
        label: "Level & Flow",
        pillar: "sensing",
        color: "#38bdf8",
        subs: [
          { key: "level-flow-sensors", label: "Level & flow sensors", categories: ["Level & Flow", "Blockage Detection"] },
          { key: "soft-sensors", label: "Soft sensors", categories: ["Soft Sensors & Flow Estimation"] },
          { key: "rdii", label: "Rainfall-derived I&I", categories: ["Inflow & Infiltration"] },
        ],
      },
      {
        key: "pipe-condition",
        label: "Pipe Condition",
        pillar: "sensing",
        color: "#f59e0b",
        subs: [
          { key: "acoustic", label: "Acoustic & ultrasonic", categories: ["Pipe & Acoustic"] },
          { key: "fibre-cctv", label: "Fibre optics & CCTV", ids: [9, 10] },
          { key: "deterioration", label: "Condition & deterioration", categories: ["Pipe Condition Assessment"] },
        ],
      },
      {
        key: "quality-gas",
        label: "Water Quality & Gas",
        pillar: "sensing",
        color: "#34d399",
        subs: [
          { key: "electrochemical", label: "Physical & electrochemical", categories: ["Water Quality"] },
          { key: "optical-bio", label: "Optical & biological", ids: [15, 16, 18] },
          { key: "h2s", label: "Hydrogen sulfide", categories: ["H2S & Corrosion"] },
          { key: "iot", label: "Wireless & low-cost IoT", categories: ["IoT & Telemetry"] },
        ],
      },
      {
        key: "placement-methods",
        label: "Placement Methods",
        pillar: "placement",
        color: "#a78bfa",
        subs: [
          { key: "topology-graph", label: "Topology & graph", categories: ["Topology-Based Placement", "Graph-based Clustering Placement", "Demand-driven Sensor Placement", "Sewer Level Monitoring"] },
          { key: "information", label: "Information theory", categories: ["Information-Theoretic Placement", "Network Design"], ids: [24] },
          { key: "optimisation-risk", label: "Optimisation & risk", categories: ["Sensor Placement Optimisation", "Risk-based Sensor Placement", "Sensor Placement & Model Calibration", "Sensor Placement", "Pandemic Monitoring"] },
          { key: "reviews", label: "Reviews & overviews", categories: ["Sensor Placement Review", "Smart Wastewater Management"] },
        ],
      },
      {
        key: "detection-estimation",
        label: "Detection & Estimation",
        pillar: "placement",
        color: "#f472b6",
        subs: [
          { key: "source-tracking", label: "Pollution source tracking", categories: ["Source Identification"] },
          { key: "state-estimation", label: "Flow & state estimation", categories: ["Flow Reconstruction", "GNN-based State Estimation", "Stormwater Level Forecasting"] },
          { key: "overflow-detection", label: "Overflow, blockage & I&I", categories: ["South Australia Case Study", "Utility Deployment Case Study", "Inflow & Infiltration Detection"] },
        ],
      },
    ],
  },
  grey: {
    field: "category",
    groups: [
      {
        key: "overflows-capacity",
        label: "Overflows & Capacity",
        color: "#fb7185",
        subs: [
          { key: "overflows", label: "Overflows & surcharging", categories: ["Network Overflows & Surcharging"] },
          { key: "growth", label: "Urban growth & capacity", categories: ["Urban Growth & Sewer Capacity"] },
        ],
      },
      {
        key: "ii-condition",
        label: "I&I & Asset Condition",
        color: "#fbbf24",
        subs: [
          { key: "ii", label: "Inflow & infiltration", categories: ["Inflow & Infiltration (I&I)"] },
          { key: "condition", label: "Asset condition", categories: ["Asset Condition & Deterioration"] },
        ],
      },
      {
        key: "monitoring-modelling",
        label: "Monitoring & Modelling",
        color: "#22d3ee",
        subs: [
          { key: "hardware", label: "Sensors & hardware", categories: ["Sensors & Monitoring Hardware"] },
          { key: "models", label: "Hydraulic models", categories: ["Hydraulic Simulators & Modeling"] },
          { key: "datasets", label: "Open datasets", categories: ["Open Datasets & Benchmarks"] },
        ],
      },
      {
        key: "standards-policy",
        label: "Standards & Policy",
        color: "#94a3b8",
        subs: [
          { key: "codes", label: "Codes & design standards", categories: ["Utility Codes & Design Standards"] },
          { key: "regulation", label: "Regulation & funding", categories: ["Regulation & Funding"] },
        ],
      },
    ],
  },
};

// Returns { group, sub } for a record in "academic" or "grey". Per-record ids win over categories.
window.categoryGroupOf = function categoryGroupOf(section, record) {
  const tax = window.CATEGORY_GROUPS[section];
  const id = String(record.id);
  for (const group of tax.groups) {
    for (const sub of group.subs) {
      if ((sub.ids || []).some((x) => String(x) === id)) return { group, sub };
    }
  }
  const value = record[tax.field];
  for (const group of tax.groups) {
    for (const sub of group.subs) {
      if ((sub.categories || []).includes(value)) return { group, sub };
    }
  }
  return { group: { key: "other", label: "Other", color: "#64748b", subs: [] }, sub: { key: "other", label: value || "Uncategorised" } };
};
