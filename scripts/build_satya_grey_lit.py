import json
import os

items = [
  # -------------------------------------------------------------
  # 1. EPA SWMM Hydraulics Manual
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-01",
    "title": "US EPA Storm Water Management Model (SWMM) 5.2 Reference Manual Volume II: Hydraulics",
    "organization": "US Environmental Protection Agency (US EPA)",
    "region": "United States",
    "country": "United States",
    "year": 2017,
    "docType": "Hydraulic Simulator Reference Manual",
    "topic": "Hydraulic Simulators & Dynamic Wave Routing",
    "pdfUrl": "#",
    "externalUrl": "https://www.epa.gov/water-research/storm-water-management-model-swmm",
    "mediaType": "guide",
    "size": "5.8 MB",
    "pages": 192,
    "summary": "The definitive engineering reference for the dynamic-wave Saint-Venant hydraulic solver in EPA SWMM 5.2. Governs open-channel conduit flow, pressurized surcharging, backwater effects, and conduit slot approximations.",
    "keyTakeaways": [
      "Derives full 1D Saint-Venant dynamic momentum and continuity equations used in wastewater sewer network routing.",
      "Models junction surcharging and slot approximations (Preissmann slot) when hydraulic grade lines exceed conduit crowns.",
      "Defines conduit boundary head losses, entrance/exit contractions, and weir/orifice diversions."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Rossman, L. A. (2017). Storm Water Management Model Reference Manual Volume II – Hydraulics. Publication No. EPA/600/R-17/111, National Risk Management Research Laboratory, U.S. EPA, Cincinnati, OH.",
      "intro": "Every sewer modeling team uses SWMM or its commercial engine derivatives (InfoWorks, SewerGEMS, EPA SWMM 5.2), but you cannot design an optimal sensor network without understanding how the engine actually solves unsteady, pressurized pipe flow.",
      "methods": "Solves the complete 1D Saint-Venant momentum and continuity equations via successive approximations with Picard under-relaxation. Conduits transition from open-channel Manning flow to pressurized conduit flow using the Preissmann slot technique rather than crashing the numerical solver.",
      "scope": "Applies to gravity conduits, force mains, storage junctions, drop manholes, flow dividers, and combined/sanitary outfalls.",
      "usefulness": "This is the core physics engine underpinning our Walkerville and Canberra benchmark simulations. Understanding where SWMM computes high hydraulic gradient lines (HGL) tells us exactly where sensors must be placed to catch surcharging before manhole overflow.",
      "limitations": "Assumes hydrostatic pressure distributions and 1D cross-sectionally averaged velocity. It doesn't simulate 3D turbulent vortex formation at drops or localized FOG/grease dam formations.",
      "conclusions": "Sensor placement heuristics must be tied directly to dynamic-wave backwater propagation reaches, not just static full-pipe capacity calculations.",
      "reflection": "Directly links to Paper 5 (UWO dataset) and provides the ground truth mathematical formulation for our placement algorithm's hydraulic vulnerability scoring."
    }
  },

  # -------------------------------------------------------------
  # 2. EPA SWMM Hydrology Manual
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-02",
    "title": "US EPA Storm Water Management Model (SWMM) 5.2 Reference Manual Volume I: Hydrology (Revised)",
    "organization": "US Environmental Protection Agency (US EPA)",
    "region": "United States",
    "country": "United States",
    "year": 2016,
    "docType": "Hydraulic Simulator Reference Manual",
    "topic": "Hydrology & RDII Infiltration",
    "pdfUrl": "#",
    "externalUrl": "https://www.epa.gov/water-research/storm-water-management-model-swmm",
    "mediaType": "guide",
    "size": "4.6 MB",
    "pages": 234,
    "summary": "Technical foundation for rainfall-derived inflow and infiltration (RDII) in sewer networks. Explains RTK unit hydrograph parameterisation, catchment depression storage, and infiltration modeling.",
    "keyTakeaways": [
      "Details RTK unit hydrograph parameters (R = ratio of rainfall entering sewer, T = time to peak, K = recession ratio) for rapid, medium, and slow infiltration.",
      "Provides parameter catalogue ranges for depression storage (1.0–2.5 mm for impervious surfaces) and Horton/Green-Ampt infiltration.",
      "Defines mathematical coupling between surface rainfall hyetographs and dry-weather sanitary flow patterns."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Rossman, L. A. & Huber, W. C. (2016). Storm Water Management Model Reference Manual Volume I – Hydrology (Revised). Publication No. EPA/600/R-15/162A, U.S. EPA, Cincinnati, OH.",
      "intro": "When a sewer network surcharges during rain, the water entering the system isn't just sanitary flow; it is dominated by rainfall-derived inflow and infiltration (RDII) through broken private laterals, illicit roof drains, and cracked manhole covers.",
      "methods": "Models surface catchment runoff using a non-linear reservoir model with Horton or Green-Ampt infiltration. In-sewer infiltration is represented by three triangular unit hydrographs (RTK method) capturing fast inflow, moderate infiltration, and slow groundwater drainage.",
      "scope": "Applies to urban subcatchments, roof disconnections, pervious vs impervious pavements, and sub-surface soil moisture zones.",
      "usefulness": "Gives the exact scientific equations needed to parameterize wet-weather flows in our Walkerville SWMM model. Rather than guessing static I&I rates, we can configure realistic RTK parameters convolved with BOM rainfall depths.",
      "limitations": "The RTK method requires calibrated sensor flow data to tune R, T, and K parameters. Without flow meters, unit hydrograph shapes must be estimated from regional rules of thumb.",
      "conclusions": "RDII is often 5 to 10 times higher than average dry-weather flow in aging separate sewers. Flow sensors must be sited at subcatchment outlets to isolate high-I&I sub-basins.",
      "reflection": "Connects directly to Paper 1 (radar level sensing) and Paper 2 (contactless flow sensors) to validate whether monitored wet-weather flow spikes correspond to modeled RTK curves."
    }
  },

  # -------------------------------------------------------------
  # 3. WSA 02-2014 Sewerage Code of Australia
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-03",
    "title": "WSA 02-2014 Gravity Sewerage Code of Australia (MRWA Edition Version 3.3)",
    "organization": "Water Services Association of Australia (WSAA)",
    "region": "Australia",
    "country": "Australia",
    "year": 2014,
    "docType": "National Design Standard & Code",
    "topic": "Network Hydraulics & Containment Standards",
    "pdfUrl": "#",
    "externalUrl": "https://www.wsaa.asn.au/shop/product/40731",
    "mediaType": "standard",
    "size": "8.2 MB",
    "pages": 280,
    "summary": "The national Australian engineering benchmark for gravity sewer network planning, design, and construction. Mandates self-cleansing velocity (0.6 m/s), maximum design depth ratio (d/D <= 0.7 to 1.0), and diurnal peaking factors.",
    "keyTakeaways": [
      "Specifies minimum self-cleansing scouring velocity of 0.6 m/s at peak daily flow to prevent grit and silt accumulation.",
      "Sets maximum allowable design depth ratio d/D = 0.7 for reticulation sewers and d/D = 1.0 for major trunk sewers at PWWF.",
      "Establishes standardized sizing equations, minimum gradients for 150 mm pipes (1 in 150), and manhole spacing guidelines."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Water Services Association of Australia (WSAA, 2014/2024). WSA 02-2014: Gravity Sewerage Code of Australia (Incorporating Amendments 1 & 2, Version 3.3). WSAA, Melbourne, Australia.",
      "intro": "In Australia, any sensor placement or capacity assessment must be justified against WSA 02. Water utilities don't operate on abstract theory; they operate under WSAA codes and their specific state supplements.",
      "methods": "Provides deterministic engineering formulas for calculating Peak Dry Weather Flow (PDWF) and Peak Wet Weather Flow (PWWF) based on Equivalent Population (EP). Utilises Colebrook-White and Manning equations to calculate conduit capacities at varying d/D ratios.",
      "scope": "Gravity collection sewers from DN 150 up to DN 1200 across all Australian retail water utilities.",
      "usefulness": "Supplies the core design thresholds for our parameter catalogue. A pipe reach operating at d/D > 0.7 in dry weather or surcharging a manhole in wet weather represents an immediate regulatory trigger for sensor placement.",
      "limitations": "WSA 02 is written for designing new greenfield infrastructure. It provides limited guidance on how to retrofit sensors into 80-year-old vitrified clay networks suffering from heavy tree-root intrusion.",
      "conclusions": "Hydraulic capacity thresholds must be dynamic: a pipe with 0.6 m/s velocity during dry weather can still choke if roots reduce effective Manning area by 40%.",
      "reflection": "Serves as the baseline hydraulic design reference across all my sensor research and provides the explicit capacity rules coded into our simulation algorithms."
    }
  },

  # -------------------------------------------------------------
  # 4. SA Water TS 0130 Linear Asset Standard
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-04",
    "title": "SA Water TS 0130: As Constructed Data Requirements for Linear Assets",
    "organization": "SA Water Corporation",
    "region": "Australia",
    "country": "Australia",
    "year": 2024,
    "docType": "Utility Technical Standard",
    "topic": "Asset Data & Survey Specifications",
    "pdfUrl": "#",
    "externalUrl": "https://www.sawater.com.au/developers-and-builders/technical-standards",
    "mediaType": "standard",
    "size": "1.2 MB",
    "pages": 38,
    "summary": "Mandatory technical standard specifying asset handover requirements for SA Water linear infrastructure. Establishes survey accuracy (+/-0.01 m) for invert levels, cover elevations, pipe materials, and GPS coordinates.",
    "keyTakeaways": [
      "Mandates exact survey precision: invert levels must be surveyed to +/-0.01 m AHD and planimetric coordinates to +/-0.02 m MGA.",
      "Requires comprehensive attribute capture: pipe material (PVC, VC, DICL, RC), nominal diameter, joint type, and installation year.",
      "Explains why legacy GIS networks lack verified inverts: older pre-digital assets relied on surface contour interpolation."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "SA Water Corporation (2024). Technical Standard TS 0130: As Constructed Data Requirements for Linear Assets (Water and Wastewater). Version 5.0, SA Water Engineering & Technical Services, Adelaide, SA.",
      "intro": "When we analyzed the SA Water Location SA dataset for Walkerville, we found invert levels were redacted or unrecorded, forcing us to interpolate from surface contours. TS 0130 explains how modern data is captured and what quality standards SA Water enforces.",
      "methods": "Defines mandatory survey verification protocols prior to practical completion. Surveyors must take direct physical rod readings on pipe inverts prior to trench backfilling, recording absolute mAHD elevations and MGA2020 eastings/northings.",
      "scope": "All gravity sewers, pressure rising mains, manhole chambers, and maintenance shafts owned or maintained by SA Water across South Australia.",
      "usefulness": "Directly guides our project's data quality audit. By comparing modern TS 0130 standards against historical Walkerville assets, we can quantify the slope error margin (+/-0.23 m lid error) and understand where physical level sensor verification is most needed.",
      "limitations": "Only enforces data quality on new or refurbished capital works; it does not solve the historical data deficit for pipe networks installed in the 1950s–1980s.",
      "conclusions": "Level sensors placed in manholes with uncertain invert levels must be calibrated using relative water depth rather than relying on absolute datum elevations.",
      "reflection": "Directly addresses the client feedback from Vineeth Maruvada regarding identifying information gaps in SA Water's existing asset register."
    }
  },

  # -------------------------------------------------------------
  # 5. SA Water TS 0103 Survey Requirements
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-05",
    "title": "SA Water TS 0103: Survey Requirements Specifications",
    "organization": "SA Water Corporation",
    "region": "Australia",
    "country": "Australia",
    "year": 2024,
    "docType": "Utility Technical Standard",
    "topic": "Survey Tolerances & Datum Standards",
    "pdfUrl": "#",
    "externalUrl": "https://www.sawater.com.au/developers-and-builders/technical-standards",
    "mediaType": "standard",
    "size": "950 KB",
    "pages": 26,
    "summary": "Defines survey tolerances, reference benchmarks, and coordinate systems for SA Water engineering projects, mandating Map Grid of Australia (MGA2020) and Australian Height Datum (AHD).",
    "keyTakeaways": [
      "Specifies mandatory geodetic datum standards across South Australia (GDA2020 / MGA2020 Zone 54).",
      "Defines vertical control tolerances tied to permanent Survey Mark (PSM) benchmarks on the Australian Height Datum (AHD).",
      "Establishes laser scanning, GNSS RTK, and total station precision requirements for underground utility tracing."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "SA Water Corporation (2024). Technical Standard TS 0103: Survey Requirements Specifications. Version 4.0, Asset Operations, Adelaide, SA.",
      "intro": "In sewer hydraulic modeling, vertical slope errors of just a few centimeters can flip the modeled direction of flow or produce false backwater warnings. TS 0103 sets the benchmark for survey accuracy.",
      "methods": "Sets out rigorous closed-loop leveling and GNSS RTK surveying protocols, establishing permissible misclose formulas (misclose <= 12 mm * sqrt(K), where K is distance in km).",
      "scope": "Applies to site investigations, asset mapping, manhole rim elevations, and pump station wet-well geometry across SA Water infrastructure.",
      "usefulness": "Helps our team understand the difference between high-precision surveyed nodes (like the 10 surveyed lids in Walkerville) and contour-interpolated nodes, allowing us to weight sensor placement toward hydraulically sensitive reaches.",
      "limitations": "Physical surveying is labor-intensive and costly; utilities cannot afford to re-survey thousands of kilometers of established reticulation pipes.",
      "conclusions": "Sensors provide an empirical way to validate modeled pipe slopes and verify actual flow velocities without digging up roads or conducting costly surveys.",
      "reflection": "Directly supports our Parameter Catalogue Deliverable D2 by identifying physical survey certainty as a primary parameter."
    }
  },

  # -------------------------------------------------------------
  # 6. ARR 2019 Book 9 Urban Runoff
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-06",
    "title": "ARR 2019: Australian Rainfall and Runoff Book 9 — Runoff in Urban Areas",
    "organization": "Commonwealth of Australia (Geoscience Australia & Engineers Australia)",
    "region": "Australia",
    "country": "Australia",
    "year": 2019,
    "docType": "National Design Standard & Guide",
    "topic": "Urban Storm Runoff & Temporal Patterns",
    "pdfUrl": "#",
    "externalUrl": "https://arr.ga.gov.au/arr-guideline",
    "mediaType": "guide",
    "size": "7.5 MB",
    "pages": 118,
    "summary": "The national standard for urban stormwater and sewer runoff modeling in Australia. Introduces ensemble storm burst temporal patterns, urban fraction imperviousness, and subcatchment routing.",
    "keyTakeaways": [
      "Replaces outdated single-burst design storms with 10-pattern ensembles to capture diverse rainfall burst dynamics.",
      "Defines Effective Impervious Area (EIA) vs Total Impervious Area (TIA) in residential and commercial catchments.",
      "Provides standardized dimensionless temporal hydrographs for Adelaide and South Australian drainage zones."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Ball, J., Babister, M., Nathan, R., Weeks, W., Weinmann, E., Retallick, M., & Testoni, I. (Eds.) (2019). Australian Rainfall and Runoff: A Guide to Flood Estimation - Book 9: Runoff in Urban Areas. Commonwealth of Australia, Canberra, ACT.",
      "intro": "Wet-weather sewer overflows aren't caused by average rain; they happen during intense burst patterns that overwhelm pipe storage. ARR 2019 is the definitive guide on how Australian rain actually falls.",
      "methods": "Uses an ensemble of 12 discrete temporal patterns for every storm duration and Annual Exceedance Probability (AEP). Rainfall is routed across pervious and directly connected impervious surfaces to produce catchment hydrographs.",
      "scope": "Urban drainage, municipal collection systems, stormwater inlets, and sanitary sewer infiltration across Australia.",
      "usefulness": "Supplied the temporal pattern ensemble in our project data warehouse (`arr2019_temporal_patterns.csv`). Convolving ARR temporal patterns with BOM IFD depths allows us to simulate realistic surcharge waves in SWMM.",
      "limitations": "Urban infiltration equations require local ground calibration; soil moisture prior to the storm strongly influences how much rain enters cracked pipes.",
      "conclusions": "A sewer network that handles a 5-year storm with a late-peaking burst can overflow under the same storm if the burst is front-loaded.",
      "reflection": "Directly links to Paper 5 (UWO dataset hydrology) and provides the meteorological forcing for our sensor placement simulation scenarios."
    }
  },

  # -------------------------------------------------------------
  # 7. CSIRO Data61 Sewer Roughness Guide
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-07",
    "title": "CSIRO Data61 / WSAA Sewer Pipe Degradation and Roughness Matrix",
    "organization": "CSIRO Data61 & WSAA",
    "region": "Australia",
    "country": "Australia",
    "year": 2011,
    "docType": "Research & Industry Matrix",
    "topic": "Pipe Degradation & Roughness Calibration",
    "pdfUrl": "#",
    "externalUrl": "https://research.csiro.au",
    "mediaType": "report",
    "size": "3.4 MB",
    "pages": 64,
    "summary": "Multi-utility research report mapping sewer pipe age, material, and structural defect classes directly to empirical Manning n roughness coefficients (0.009 to 0.018).",
    "keyTakeaways": [
      "Quantifies how aging increases pipe roughness: new PVC has Manning n = 0.009–0.010, while 60-year-old vitrified clay reaches n = 0.015–0.018.",
      "Correlates joint displacement, mineral encrustation, and root penetration with hydraulic capacity losses of up to 45%.",
      "Provides lookup matrices mapping GIS asset fields (MATERIAL, YEAR_INSTALLED) to calibrated hydraulic model parameters."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Davis, P., Marlow, D., & Tran, D. (2011). Condition Assessment and Asset Performance of Underground Wastewater Networks: Material Roughness and Structural Deterioration Matrix. CSIRO Water for a Healthy Country / WSAA, Melbourne, Australia.",
      "intro": "Engineers often assume a single textbook Manning's n value (like 0.013) for an entire network. In reality, a 70-year-old clay pipe choked with slime and roots has drastically less capacity than modern PVC.",
      "methods": "Combined laser profiling, CCTV inspections, and field dye testing across >50,000 sewer pipe segments in Victoria and NSW to measure actual hydraulic resistance as a function of age and material.",
      "scope": "Vitrified clay (VC), reinforced concrete (RCP), unplasticised PVC, asbestos cement (AC), and cast iron sewers from DN 150 to DN 900.",
      "usefulness": "This is the source for `csiro_pipe_roughness_matrix.csv` in our project data warehouse. It allows our simulation engine to calculate real, asset-differentiated capacities for Walkerville's 158 reaches.",
      "limitations": "Local factors like ground movement, reactive clay soils, and aggressive tree species can cause rapid local deterioration that defies national age-based averages.",
      "conclusions": "Pipes with high CSIRO roughness scores represent natural hydraulic bottlenecks where level sensors should be prioritized.",
      "reflection": "Directly supports Paper 6 (Bin Ali et al. on sewer defects) and Paper 10 (CCTV AI defect detection) by linking physical defects to hydraulic flow reduction."
    }
  },

  # -------------------------------------------------------------
  # 8. Innovyze InfoWorks ICM Guide
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-08",
    "title": "Autodesk / Innovyze InfoWorks ICM Sewer Hydraulic Engine Reference Manual",
    "organization": "Innovyze (Autodesk Inc.)",
    "region": "International",
    "country": "United States",
    "year": 2023,
    "docType": "Commercial Simulator Manual",
    "topic": "1D/2D Integrated Catchment Modeling",
    "pdfUrl": "#",
    "externalUrl": "https://www.autodesk.com/products/infoworks-icm/overview",
    "mediaType": "guide",
    "size": "9.1 MB",
    "pages": 312,
    "summary": "Industry-standard engineering reference for integrated 1D collection system and 2D overland flood modeling. Covers manhole head losses, pressurized pipe transitions, and real-time SCADA sensor assimilation.",
    "keyTakeaways": [
      "Provides advanced 1D/2D coupled solvers simulating surface spill pathways when manhole lids blow off during surcharge.",
      "Details manhole energy loss calculations (FHWA, Miller, and Borda-Carnot junction loss models).",
      "Documents live telemetry integration capabilities for real-time model calibration and automated warning generation."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Innovyze (2023). InfoWorks ICM 1D/2D Hydrodynamic Network Simulation Engine Reference Guide. Autodesk Inc., Portland, OR.",
      "intro": "While SWMM is open-source, major water utilities like SA Water and Sydney Water use InfoWorks ICM for operational planning. Understanding its internal logic ensures our sensor placement research translates to utility industry tools.",
      "methods": "Combines a 1D implicit Preissmann-scheme pipe network solver with a 2D shallow water equation surface routing engine. Accurately simulates water escaping manhole lids, flowing along street gutters, and re-entering downstream gullies.",
      "scope": "City-wide sanitary and combined sewer networks, pumping stations, retention basins, and overland flood plains.",
      "usefulness": "Explains junction head-loss phenomena that simple Manning calculations ignore. When multiple pipes meet at an angle inside a manhole, turbulence causes substantial energy loss, raising the upstream hydraulic grade line and triggering premature overflows.",
      "limitations": "High computational overhead for 2D surface meshes; building and maintaining full InfoWorks models requires substantial engineering hours.",
      "conclusions": "Optimal sensor placement must account for junction head losses, because drop manholes and sharp bends frequently act as localized surcharge triggers.",
      "reflection": "Connects directly to Paper 4 (Sikorski et al. on network coverage) by defining where hydraulic stress concentrates in complex topologies."
    }
  },

  # -------------------------------------------------------------
  # 9. WRF Project 5239 Sensor Placement
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-09",
    "title": "Water Research Foundation (WRF) Project 5239: Optimizing Sensor Networks for Collection Systems",
    "organization": "The Water Research Foundation (WRF)",
    "region": "United States",
    "country": "United States",
    "year": 2025,
    "docType": "Research Foundation Report",
    "topic": "Optimal Sensor Placement Frameworks",
    "pdfUrl": "#",
    "externalUrl": "https://www.waterrf.org/research/projects/5239",
    "mediaType": "report",
    "size": "4.8 MB",
    "pages": 142,
    "summary": "Landmark research report establishing the Descriptive–Predictive–Prescriptive Sensor Placement (DPP-SP) framework. Combines machine learning failure forecasting with multi-objective sensor placement optimization.",
    "keyTakeaways": [
      "Demonstrates that redeploying existing sensors using risk-weighted models increases overflow detection by up to 35% without buying new hardware.",
      "Uses XGBoost and Random Forest models on historical GIS and work orders to rank pipe failure probabilities.",
      "Balances detection reliability (upstream placement) against network identifiability (downstream placement)."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Moradi, M. & Najafi, M. (2025). Optimizing Sensor Networks and Advanced Sensing Techniques for Enhanced Collection Systems Management. Research Project Report No. WRF 5239, The Water Research Foundation, Denver, CO.",
      "intro": "Utilities often deploy sensors based on gut instinct or customer complaints. WRF 5239 provides the academic and industry rigor showing how machine learning and optimization algorithms should decide where sensors go.",
      "methods": "Employs a three-stage framework: (1) Descriptive analysis of past sewer choke incidents, (2) Predictive modeling of structural and hydraulic failure risk using machine learning, and (3) Prescriptive optimization (Genetic Algorithms and Greedy heuristics) to locate sensors.",
      "scope": "Municipal sewer collection systems facing sanitary sewer overflows (SSOs), combined sewer overflows (CSOs), and budget caps.",
      "usefulness": "This is the primary modern methodological benchmark for our capstone project. It provides the exact mathematical justification for combining GIS risk factors (pipe age, slope, diameter) with hydraulic surcharge risk in our scoring algorithm.",
      "limitations": "Requires clean historical incident data (work orders, blockage records) to train the predictive machine learning models.",
      "conclusions": "Optimal sensor placement is an optimization trade-off between coverage, lead-time to overflow, and capital budget.",
      "reflection": "Directly links to Paper 4 (Sikorski et al. 2022) and Paper 28 (Moradi & Najafi 2026), providing the theoretical backbone for our placement tool."
    }
  },

  # -------------------------------------------------------------
  # 10. WRF Project 4908 Real-Time Monitoring
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-10",
    "title": "Water Research Foundation (WRF) Project 4908: Demonstrating Real-Time Collection System Monitoring",
    "organization": "The Water Research Foundation (WRF)",
    "region": "United States",
    "country": "United States",
    "year": 2022,
    "docType": "Research Foundation Report",
    "topic": "Real-Time Telemetry & Monitoring",
    "pdfUrl": "#",
    "externalUrl": "https://www.waterrf.org/research/projects/4908",
    "mediaType": "report",
    "size": "5.1 MB",
    "pages": 128,
    "summary": "Field evaluation of real-time sensor networks, telemetry gateways, and automated anomaly detection algorithms deployed across operating wastewater collection catchments.",
    "keyTakeaways": [
      "Evaluates continuous telemetry reliability, reporting data packet loss rates of 2–8% in dense urban manhole environments.",
      "Documents automated anomaly detection algorithms filtering diurnal flow noise to detect illegal industrial dumping and sudden choke events.",
      "Provides operational cost breakdowns: maintenance and battery replacement account for >60% of 10-year total cost of ownership."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "The Water Research Foundation (2022). Demonstrating Real-Time Collection System Monitoring for Source Control and Potable Reuse. Research Report No. WRF 4908, Denver, CO.",
      "intro": "Deploying a sensor in a clean lab is easy; keeping 50 sensors running in an active, damp, corrosive sewer manhole is an operational nightmare. WRF 4908 captures the hard-won practical realities.",
      "methods": "Piloted multi-parameter sensors and ultrasonic level monitors across diverse collection catchments. Tested edge computing gateways that process sensor data locally and transmit only event alarms to save battery life.",
      "scope": "Municipal sewer networks, trade waste trunk mains, and indirect potable reuse collection basins.",
      "usefulness": "Gives our project concrete operational constraints to include in our sensor placement tool. A placement algorithm that chooses inaccessible manholes in high-traffic intersections is useless in practice.",
      "limitations": "Focuses heavily on potable reuse source control, meaning water quality sensors (conductivity, pH, UV-Vis) receive more focus than purely acoustic blockage detection.",
      "conclusions": "Sensor placement must consider physical maintainability, cell signal strength, and confined space access restrictions alongside hydraulic scores.",
      "reflection": "Directly supports Paper 22 (wireless sensor networks) and Paper 23 (low-cost IoT sensors for water quality)."
    }
  },

  # -------------------------------------------------------------
  # 11. ASTM F3220-17 SL-RAT Acoustic Guide
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-11",
    "title": "ASTM F3220-17 / InfoSense SL-RAT Acoustic Inspection Standard",
    "organization": "ASTM International",
    "region": "United States",
    "country": "United States",
    "year": 2017,
    "docType": "Acoustic Inspection Standard",
    "topic": "Acoustic Blockage Screening",
    "pdfUrl": "#",
    "externalUrl": "https://www.astm.org/f3220-17.html",
    "mediaType": "standard",
    "size": "850 KB",
    "pages": 14,
    "summary": "Standard guide for screening gravity sanitary sewers using transmissive acoustic technology (SL-RAT). Defines acoustic blockage scoring (0–10) in under 3 minutes per pipe reach without CCTV.",
    "keyTakeaways": [
      "Standardizes active acoustic sound wave transmission: an acoustic transmitter (TX) yells and a receiver (RX) listens at adjacent manholes.",
      "Scores pipe condition on a 0–10 scale: 7–10 indicates clean pipe with ample flow, while 0–3 indicates severe blockage requiring jetting.",
      "Enables screening up to 3,000 meters of sewer pipe per day, eliminating the need to clean clean pipes."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "ASTM International (2017). ASTM F3220-17: Standard Guide for Prioritizing Sewer Cleaning Operations in Gravity Sanitary Sewer Lines Using Transmissive Acoustic Inspection. ASTM Committee F36, West Conshohocken, PA.",
      "intro": "CCTV inspection is slow and expensive (500 meters a day), and jetting unblocked pipes waste millions of liters of water. Transmissive acoustics like the SL-RAT allow rapid pre-screening to find where blockages actually are.",
      "methods": "Sends a specialized multi-frequency acoustic signal through the air headspace of a sewer pipe. Obstructions (roots, grease, sags, sediment) reflect and attenuate the sound wave, which is processed to generate an immediate blockage score.",
      "scope": "Gravity sanitary sewers DN 150 to DN 450 up to 150 meters in length between manholes.",
      "usefulness": "Connects acoustic screening scores with sensor placement. If a reach has an SL-RAT score of 2, placing a continuous level sensor immediately upstream provides an active early-warning sentinel before a full choke forms.",
      "limitations": "Cannot inspect full-pipe siphons or completely submerged reaches where no air headspace exists for sound propagation.",
      "conclusions": "Acoustic screening is the fastest way to survey a network; coupling periodic acoustic audits with permanent level monitors creates an efficient hybrid defense.",
      "reflection": "Directly links to Paper 6 (Bin Ali et al. on acoustic instrumentation) and Paper 7 (acoustic condition monitoring)."
    }
  },

  # -------------------------------------------------------------
  # 12. WSA 05-2020 Sewer CCTV Defect Code
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-12",
    "title": "WSA 05-2020: Sewer Inspection Reporting Code of Australia (4th Edition)",
    "organization": "Water Services Association of Australia (WSAA)",
    "region": "Australia",
    "country": "Australia",
    "year": 2020,
    "docType": "National Design Standard & Code",
    "topic": "CCTV Defect Scoring & AI",
    "pdfUrl": "#",
    "externalUrl": "https://www.wsaa.asn.au/shop/product/54121",
    "mediaType": "standard",
    "size": "9.4 MB",
    "pages": 240,
    "summary": "The national standard for classifying, coding, and scoring defects in sewer pipes from CCTV camera footage. Defines standardized formulas for structural and service defect grading (Grades 1 to 5).",
    "keyTakeaways": [
      "Standardizes national defect codes: Root Taproot (RT), Root Fine (RF), Encrustation (EN), Fracture (F), Displaced Joint (DJ).",
      "Calculates Mean Defect Score (MDS) and Peak Defect Score (PDS) to grade pipes from Grade 1 (minor) to Grade 5 (imminent collapse).",
      "Establishes CCTV video formats and digital metadata protocols required for automated AI computer vision analysis."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Water Services Association of Australia (WSAA, 2020). WSA 05-2020: Sewer Inspection Reporting Code of Australia (CCTV Inspection and Defect Classification). 4th Edition, WSAA, Melbourne, Australia.",
      "intro": "When human operators inspect sewers with CCTV, their defect grading is notoriously subjective. WSA 05 gives the rigorous, objective mathematical rules that modern AI vision models use to score sewer defects.",
      "methods": "Classifies every pipe anomaly by type, clock-face orientation, and longitudinal percentage. Each defect is assigned a severity weight that sums into Structural and Service condition indices.",
      "scope": "Closed-circuit television (CCTV) and zoom camera inspection of all wastewater and stormwater conduits in Australia.",
      "usefulness": "This is the ground truth coding system needed for Paper 10 (CCTV AI defect detection). In our sensor placement framework, reaches with high WSA 05 Service scores (Grade 4–5 tree roots or grease) receive elevated placement weights.",
      "limitations": "CCTV requires pre-cleaning the pipe, which temporarily washes away grease dams and loose sediment, giving a clean view of the pipe but missing transient operational choke dynamics.",
      "conclusions": "CCTV defect grades should feed directly into hydraulic model roughness factors and sensor priority calculations.",
      "reflection": "Directly supports Paper 10 (review of computer-aided sewer pipeline defect detection)."
    }
  },

  # -------------------------------------------------------------
  # 13. Pulsar Measurement Ultrasonic Level Guide
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-13",
    "title": "Pulsar Measurement Application Guide: In-Sewer Ultrasonic Level Sensing",
    "organization": "Pulsar Measurement Ltd",
    "region": "International",
    "country": "United Kingdom",
    "year": 2023,
    "docType": "Technical Application Note",
    "topic": "Ultrasonic Echo Processing & DATEM",
    "pdfUrl": "#",
    "externalUrl": "https://pulsarmeasurement.com",
    "mediaType": "guide",
    "size": "1.6 MB",
    "pages": 24,
    "summary": "Technical guide on non-contact ultrasonic transducers (dBi series) in damp sewer headspaces. Details digital echo tracking (DATEM), acoustic beam angles, false echo suppression, and manhole mounting.",
    "keyTakeaways": [
      "Explains DATEM (Digital Adaptive Tracking Echo Movement) software isolating moving sewage targets from stationary wall rungs.",
      "Details beam spread dynamics (10° beam angle) and mounting offsets required to prevent false reflections from manhole corbels.",
      "Reviews temperature compensation techniques required when sewer headspace air temperature shifts by 15°C between day and night."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Pulsar Measurement Ltd (2023). Application Note: In-Sewer Level and Overflow Monitoring with dBi Series Ultrasonic Transducers and DATEM Echo Processing. Pulsar Measurement, Malvern, UK.",
      "intro": "The 62 level sensors deployed by SA Water in the Stonyfell catchment (Do et al. 2023) were Pulsar dBi 6 ultrasonic units. To understand why that trial succeeded and where sensors failed, you have to understand this document.",
      "methods": "Emits 125 kHz acoustic pulses and measures time-of-flight to the water surface. Uses dynamic threshold tracking to disregard constant reflections from ladder rungs, dripping condensation, or cobwebs.",
      "scope": "Underground sewer manholes, combined overflow chambers, wet wells, and flumes.",
      "usefulness": "Explains why ultrasonic sensors suffer 20–25% maintenance interventions in year 1: condensation droplets clinging to the transducer face create ringdown dead-zones, and spiderwebs mimic surface targets.",
      "limitations": "Cannot measure through heavy steam or foam; sound velocity changes with methane and CO2 concentration in the manhole, requiring calibration.",
      "conclusions": "Ultrasonic sensors are cost-effective but require careful manhole bracket mounting and periodic lens cleaning to avoid false overflow alarms.",
      "reflection": "Directly connects to Paper 3 (integrated IoT low-power sensors) and the Do et al. (2023) Stonyfell report in our capstone project."
    }
  },

  # -------------------------------------------------------------
  # 14. Siemens SITRANS 80 GHz Radar Whitepaper
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-14",
    "title": "Siemens SITRANS LR110/LR120 80 GHz Radar Level Transmitters in Wastewater",
    "organization": "Siemens AG",
    "region": "International",
    "country": "Germany",
    "year": 2022,
    "docType": "Industry Whitepaper",
    "topic": "80 GHz Radar & Blockage Detection",
    "pdfUrl": "#",
    "externalUrl": "https://www.siemens.com/sitrans-lr110",
    "mediaType": "whitepaper",
    "size": "2.2 MB",
    "pages": 32,
    "summary": "Technical evaluation of 80 GHz frequency modulated continuous wave (FMCW) radar sensors for sewer level tracking. Demonstrates how narrow 4-degree beam angles ignore condensation, grease, and manhole obstacles.",
    "keyTakeaways": [
      "80 GHz radar features an extremely narrow 4° beam angle, allowing installation in tight manholes without sidewall interference.",
      "Unaffected by vapor, condensation, temperature swings, or hazardous sewer gas atmospheres (H2S/CH4).",
      "Coupled with Siemens SIWA Blockage Predictor cloud AI to detect slow hydraulic head rises weeks before overflows occur."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Siemens AG (2022). Application Whitepaper: SITRANS LR110 / LR120 80 GHz FMCW Compact Radar for In-Sewer Monitoring and SIWA Blockage Prediction. Siemens Digital Industries, Nuremberg, Germany.",
      "intro": "For decades, ultrasonic sensors were the sewer standard because radar was too expensive and bulky. 80 GHz microchip radar changed everything, offering millimeter accuracy through steam and grime.",
      "methods": "Transmits high-frequency 80 GHz electromagnetic radar waves. The frequency difference between sent and reflected signals is directly proportional to distance. Bluetooth setup allows surface calibration without confined space entry.",
      "scope": "Sewer collection mains, overflow weirs, wet wells, storm holding basins, and industrial trade waste sumps.",
      "usefulness": "This is the exact technology evaluated in Paper 1 (Drenoyanis et al. 2019). It provides the technical justification for why water utilities are migrating from ultrasonic to compact radar for critical trunk monitoring.",
      "limitations": "Higher initial unit price than basic ultrasonic sentinels; battery draw during continuous transmission requires pulsed sampling intervals (every 2–5 minutes).",
      "conclusions": "80 GHz radar virtually eliminates false echoes from condensation and spiderwebs, dramatically cutting utility truck rolls.",
      "reflection": "Directly supports Paper 1 (IoT based radar sensor network for wastewater management)."
    }
  },

  # -------------------------------------------------------------
  # 15. LoRa Alliance In-Manhole RF Report
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-15",
    "title": "LoRa Alliance: In-Manhole Radio Frequency Propagation and Battery Management",
    "organization": "LoRa Alliance Technical Committee",
    "region": "International",
    "country": "United States",
    "year": 2021,
    "docType": "Technical Research Report",
    "topic": "In-Manhole LoRaWAN RF Propagation",
    "pdfUrl": "#",
    "externalUrl": "https://lora-alliance.org",
    "mediaType": "report",
    "size": "3.8 MB",
    "pages": 56,
    "summary": "Comprehensive RF engineering study quantifying sub-GHz radio transmission through cast-iron manhole covers, asphalt, and concrete lids for underground sewer telemetry.",
    "keyTakeaways": [
      "Solid cast-iron manhole covers attenuate 915 MHz RF signals by 25 to 40 dB, requiring composite lids or slot antennas.",
      "Sub-GHz LoRaWAN (915 MHz in Australia, 868 MHz in Europe) achieves 3–5x better penetration than 2.4 GHz WiFi or Zigbee.",
      "Presents battery life equations: 1 transmission every 15 minutes yields 8–10 years on a single D-cell lithium thionyl chloride (LiSOCl2) pack."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "LoRa Alliance (2021). Technical Report: Sub-GHz RF Propagation and Antenna Optimization Beneath Cast-Iron Manhole Covers for Smart Water Infrastructure. LoRa Alliance, Fremont, CA.",
      "intro": "You can have the best level sensor in the world, but if the radio signal cannot escape from 3 meters underground beneath a 100 kg cast-iron lid, the sensor is completely useless.",
      "methods": "Conducted electromagnetic link budget testing across 120 underground manhole installations with varying lid materials (cast iron, composite, ductile iron with vent holes) and antenna orientations.",
      "scope": "Underground smart water networks, sewer level telemetry, stormwater manholes, and IoT gateway deployments.",
      "usefulness": "Directly explains the communication viability parameter in our sensor placement framework. Siting a sensor under a vented or composite lid ensures 99.5% packet delivery, while a solid iron lid in a roadway requires external puck antennas.",
      "limitations": "High groundwater or street flooding covering the manhole lid temporarily cuts RF transmission completely until floodwaters recede.",
      "conclusions": "Optimal sensor placement algorithms must include an RF link budget constraint; placing a sensor where signal margin is < 10 dB guarantees lost alarm packets.",
      "reflection": "Connects directly to Paper 4 (Sikorski et al. 2022) and Paper 22 (wireless sensor networks for water monitoring)."
    }
  },

  # -------------------------------------------------------------
  # 16. US EPA IDDE Guidance Manual
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-16",
    "title": "US EPA Illicit Discharge Detection and Elimination (IDDE) Technical Guidance Manual",
    "organization": "US Environmental Protection Agency & Center for Watershed Protection",
    "region": "United States",
    "country": "United States",
    "year": 2004,
    "docType": "Regulatory Guidance Manual",
    "topic": "Illicit Discharge & Chemical Tracing",
    "pdfUrl": "#",
    "externalUrl": "https://www.epa.gov/npdes/illicit-discharge-detection-and-elimination-technical-guidance-manual",
    "mediaType": "guide",
    "size": "7.2 MB",
    "pages": 286,
    "summary": "The international handbook for isolating illicit sanitary cross-connections, industrial trade waste dumping, and sewage leaks into stormwater drains using water quality parameters.",
    "keyTakeaways": [
      "Defines key chemical indicator tracer matrices: conductivity, ammonia, potassium, detergents (surfactants), and optical brighteners.",
      "Provides decision trees distinguishing raw sanitary sewage (high ammonia > 1.0 mg/L, high detergents) from commercial wash water or clean tap water.",
      "Details outfall reconnaissance inventory (ORI) methods and automated in-pipe sampling workflows."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Brown, E., Caraco, D., & Pitt, R. (2004). Illicit Discharge Detection and Elimination: A Guidance Manual for Program Development and Technical Assessments. Publication No. EPA 833-B-04-002, Center for Watershed Protection & U.S. EPA, Washington, DC.",
      "intro": "When raw sewage enters a stormwater drain or illegal industrial waste is dumped into a sewer, how do you find the source? This EPA manual is the definitive guide on chemical fingerprinting.",
      "methods": "Uses parameter ratios (e.g. Potassium to Ammonia ratio, Boron, and Electrical Conductivity) as chemical fingerprints to trace contamination upstream through network branches.",
      "scope": "Municipal separate storm sewer systems (MS4), sanitary collection systems, and industrial catchment outfalls.",
      "usefulness": "This is the foundational theory behind Paper 11 (Illicit discharge detection via Arduino conductivity sensors). It proves that low-cost electrical conductivity and temperature sensors can detect sewage cross-connections without expensive lab spectrometry.",
      "limitations": "Chemical concentrations dilute rapidly in wet weather; tracer screening must be performed during baseflow (dry weather) periods.",
      "conclusions": "Multi-parameter sensor nodes placed at strategic branch junctions can isolate the subcatchment source of illegal discharges in hours rather than months.",
      "reflection": "Directly supports Paper 11 (illicit discharge detection using an Arduino) and Paper 12 (multi-parameter water quality monitoring)."
    }
  },

  # -------------------------------------------------------------
  # 17. WERF 01-CTS-1 Real-Time Water Quality
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-17",
    "title": "WERF Report 01-CTS-1: Online Real-Time Wastewater Quality Monitoring in Collection Systems",
    "organization": "Water Environment Research Foundation (WERF)",
    "region": "United States",
    "country": "United States",
    "year": 2004,
    "docType": "Research Foundation Report",
    "topic": "Online Water Quality & Biofouling",
    "pdfUrl": "#",
    "externalUrl": "https://www.waterrf.org",
    "mediaType": "report",
    "size": "4.2 MB",
    "pages": 160,
    "summary": "Technical evaluation of continuous water quality instrumentation (pH, ORP, DO, conductivity, turbidity) directly submerged in raw wastewater collection systems.",
    "keyTakeaways": [
      "Quantifies biofouling dynamics: submerged optical and galvanic sensors develop thick biofilm layers within 48 to 72 hours without active wipers.",
      "Details mechanical wiper blades, ultrasonic cleaning horns, and compressed air flushing to maintain sensor signal integrity.",
      "Establishes calibration drift rates for pH and dissolved oxygen probes in raw sewage environments."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Water Environment Research Foundation (WERF, 2004). Online Real-Time Wastewater Quality Monitoring in Collection Systems: Practical Sensor Evaluation. Project Report 01-CTS-1, IWA Publishing, London, UK.",
      "intro": "Putting an expensive water quality probe into raw sewage sounds great until you pull it out two days later and find it coated in grease, toilet paper, and black biofilm. WERF 01-CTS-1 addresses the real-world maintenance headache.",
      "methods": "Tested commercial water quality analyzers submerged in untreated gravity sewers and pump station wet wells over multi-month trial runs. Evaluated signal drift before and after automatic mechanical cleaning cycles.",
      "scope": "Raw municipal wastewater collection systems, trunk sewers, and treatment plant headworks.",
      "usefulness": "Directly connects to Paper 12 (reliable sewage abnormal event monitoring) and Paper 14 (optical dissolved oxygen analyzers). It proves why non-contact level sensing (radar/ultrasonic) is preferred for level, while submerged water quality probes require motorized wiper arms.",
      "limitations": "Mechanical wiper blades can jam on wet wipes and hair ragging, requiring routine human inspection every 2–4 weeks.",
      "conclusions": "Submerged water quality sensing is only viable if automated cleaning mechanisms are integrated into the sensor body.",
      "reflection": "Supports my research on water quality sensor maintenance intervals across Papers 12, 13, and 14."
    }
  },

  # -------------------------------------------------------------
  # 18. YSI Xylem Sonde Maintenance Guide
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-18",
    "title": "YSI / Xylem Technical Guide: In-Situ Water Quality Sonde Operation in Wastewater",
    "organization": "YSI Incorporated (Xylem Inc.)",
    "region": "United States",
    "country": "United States",
    "year": 2023,
    "docType": "Technical Application Guide",
    "topic": "In-Situ Water Quality Sondes",
    "pdfUrl": "#",
    "externalUrl": "https://www.ysi.com/exo",
    "mediaType": "guide",
    "size": "3.1 MB",
    "pages": 72,
    "summary": "Comprehensive best-practice manual for deploying multi-parameter sondes (EXO series) in aggressive wastewater. Covers copper anti-fouling guards, optical dissolved oxygen (DO) caps, and automated calibration.",
    "keyTakeaways": [
      "Demonstrates that pure copper components (copper-nickel alloys and wiper brushes) prevent barnacle and bacterial biofilm attachment on optical windows.",
      "Details luminescent optical DO (LDO) technology avoiding the electrolyte consumption and membrane fouling of traditional galvanic cells.",
      "Provides step-by-step procedures for calibration frequency, battery budgeting, and smart sensor diagnostics."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "YSI Incorporated / Xylem Inc. (2023). Technical Guide: Best Practices for Continuous In-Situ Water Quality Sondes (EXO Series) in Harsh Wastewater Environments. YSI Technical Publishing, Yellow Springs, OH.",
      "intro": "In Paper 14, I reviewed optical versus amperometric dissolved oxygen sensors in wastewater. This YSI/Xylem guide provides the industry operational standard for keeping those sensors calibrated in the field.",
      "methods": "Uses optical luminescent lifetime measurement: a blue LED excites a ruthenium dye membrane, and the luminescence decay time is inversely proportional to oxygen concentration. Copper wiper guards physically wipe sensor faces before every reading.",
      "scope": "Wastewater networks, aeration basins, outfall discharge channels, and industrial trade waste monitoring.",
      "usefulness": "Provides exact field protocols for our parameter catalogue. When placing water quality sensors for trade waste surveillance, copper guards and optical DO sensors are mandatory to avoid maintenance failure.",
      "limitations": "High initial equipment cost ($8,000–$15,000 per sonde); requires trained field technicians for multi-point chemical buffer calibrations.",
      "conclusions": "Optical dissolved oxygen combined with copper anti-fouling guards extends field maintenance intervals from 3 days to over 30 days in wastewater.",
      "reflection": "Directly links to Paper 14 (comparative validation of amperometric and optical analyzers of DO)."
    }
  },

  # -------------------------------------------------------------
  # 19. ISO 6878 In-Situ Nutrient Analyzers
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-19",
    "title": "European Standard EN ISO 6878: Automated In-Situ Nutrient Monitoring in Wastewater",
    "organization": "International Organization for Standardization (ISO / CEN)",
    "region": "International",
    "country": "Switzerland",
    "year": 2018,
    "docType": "International Standard",
    "topic": "Nutrient ISEs & Spectrometry",
    "pdfUrl": "#",
    "externalUrl": "https://www.iso.org/standard/64588.html",
    "mediaType": "standard",
    "size": "1.4 MB",
    "pages": 42,
    "summary": "International standard specifying automated spectroscopic and electrochemical determination of ammonium, nitrate, and orthophosphate in municipal wastewater collection and treatment systems.",
    "keyTakeaways": [
      "Defines ion-selective electrode (ISE) measurement protocols with potassium and chloride interference compensation.",
      "Sets accuracy and repeatability standards for continuous in-situ nutrient monitoring (+/-5% full scale).",
      "Specifies automatic chemical reagent delivery, filtration membranes, and waste neutralization protocols."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "International Organization for Standardization (ISO, 2018). ISO 6878: Water Quality — Determination of Phosphorus and Nitrogen Fractions for Continuous Online Analyzers. ISO Central Secretariat, Geneva, Switzerland.",
      "intro": "Measuring nutrients (ammonium, nitrate, phosphorus) in real-time in a sewer pipe is difficult because interference from other ions in urine and feces skews standard electrochemical readings. ISO 6878 provides the international benchmark.",
      "methods": "Combines spectrophotometric absorption with ion-selective electrode (ISE) arrays. Uses dynamic mathematical matrix compensation where potassium sensors correct ammonium readings and chloride sensors correct nitrate readings.",
      "scope": "Municipal sewer collection networks, decentralized package plants, and wastewater treatment discharge outfalls.",
      "usefulness": "Directly supports Paper 17 (Electrochemical detection of nitrate, nitrite and ammonium). Provides standard analytical thresholds to evaluate low-cost ISE sensors against certified laboratory instruments.",
      "limitations": "Ion-selective membranes degrade over 3–6 months and require regular chemical replacement; reagents must not freeze in outdoor cabinets.",
      "conclusions": "Electrochemical ISEs provide viable screening for nitrogen spikes, but automated interference compensation is essential in raw sewage.",
      "reflection": "Supports my research on nutrient sensor deployment in Paper 17."
    }
  },

  # -------------------------------------------------------------
  # 20. WRF 4975 Trade Waste Anomaly Detection
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-20",
    "title": "Water Research Foundation Report 4975: Real-Time Trade Waste Sensing & Anomaly Detection",
    "organization": "The Water Research Foundation (WRF)",
    "region": "United States",
    "country": "United States",
    "year": 2023,
    "docType": "Research Foundation Report",
    "topic": "Trade Waste & Industrial Anomaly Detection",
    "pdfUrl": "#",
    "externalUrl": "https://www.waterrf.org/research/projects/4975",
    "mediaType": "report",
    "size": "4.5 MB",
    "pages": 114,
    "summary": "Technical report on sensor networks and machine-learning algorithms deployed to catch illegal trade waste dumps, heavy metal spikes, and acidic discharges in municipal sewers.",
    "keyTakeaways": [
      "Demonstrates multi-sensor fusion (conductivity, pH, temperature, and UV-Vis absorbance) to fingerprint industrial effluent.",
      "Evaluates autoencoder and Isolation Forest machine learning algorithms detecting anomalous discharge events in under 15 minutes.",
      "Documents utility enforcement savings: rapid localization of illegal electroplating and food-processing dumps prevented asset corrosion."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "The Water Research Foundation (2023). Real-Time Sensing, Edge Analytics, and Anomaly Detection for Industrial Trade Waste Tracking. Project Report No. WRF 4975, Denver, CO.",
      "intro": "Illegal trade waste discharges (acids, solvents, concentrated brewery waste) destroy concrete pipes, poison biological treatment plants, and create toxic gas clouds. WRF 4975 shows how real-time sensing catches illegal dumpers.",
      "methods": "Deploys edge-computing sensor pods measuring pH, electrical conductivity, and temperature. An autoencoder neural network learns normal diurnal baseline curves; unexpected deviations trigger automated GPS sampling and valve shutoffs.",
      "scope": "Industrial sewer corridors, commercial food precincts, and municipal trunk sewer interceptors.",
      "usefulness": "Connects to Paper 11 (illicit discharge detection) and Paper 18 (BOD biosensors). Siting sensors in commercial industrial sub-catchments protects downstream assets from biogenic corrosion caused by high-strength organic loads.",
      "limitations": "Fast-moving shock loads can pass through a pipe reach before mobile sampling teams can verify the source.",
      "conclusions": "Sensor placement for trade waste must focus on network junction nodes that aggregate multiple industrial discharge contributors.",
      "reflection": "Directly supports Paper 11, 12, and 18, providing the data analytics bridge between raw water quality readings and utility enforcement."
    }
  },

  # -------------------------------------------------------------
  # 21. WSAA SCORe Concrete Corrosion Guidelines
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-21",
    "title": "WSAA / WaterRA Sewer Corrosion & Odour Research (SCORe) Guidelines & SeweX Tool",
    "organization": "WSAA & Advanced Water Management Centre (UQ)",
    "region": "Australia",
    "country": "Australia",
    "year": 2013,
    "docType": "National Research Guideline & Software",
    "topic": "H2S Gas, Odour & Concrete Corrosion",
    "pdfUrl": "#",
    "externalUrl": "https://www.water360.com.au",
    "mediaType": "guide",
    "size": "6.8 MB",
    "pages": 178,
    "summary": "The landmark A$21M national Australian research study on concrete sewer corrosion and odour. Outlines biogenic sulfuric acid corrosion mechanisms, ventilation dynamics, and the SeweX predictive model.",
    "keyTakeaways": [
      "Explains microbial corrosion cycle: anaerobic biofilms generate liquid sulfide, which transfers into headspace gas as H2S and is oxidized into sulfuric acid (H2SO4) by Thiobacillus bacteria on concrete crowns.",
      "Establishes empirical corrosion rates: crown corrosion can exceed 5–10 mm per year in warm, unventilated, high-H2S (>50 ppm) sewer headspaces.",
      "Introduces the SeweX mathematical model predicting sulfide generation in rising mains and gravity collection networks."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Advanced Water Management Centre & WSAA (2013). Sewer Corrosion and Odour Management: Research Findings, Practical Guidelines, and the SeweX Prediction Model. Water Services Association of Australia & WaterRA, Brisbane, QLD.",
      "intro": "In Paper 19 and 20, I reviewed methods for monitoring hydrogen sulfide (H2S). The SCORe project is the single most important Australian research initiative on this topic, transforming how utilities manage sewer corrosion.",
      "methods": "Combined laboratory thermodynamics, microbiological gene sequencing, and full-scale utility pipeline monitoring across Australia to develop the SeweX hydraulic-chemical model.",
      "scope": "Concrete trunk sewers, force mains, pump stations, air-release valves, and odor treatment scrubbers.",
      "usefulness": "Explains why sewer headspace gas monitoring is critical for asset management. Placing H2S sensors downstream of force main discharge drops detects corrosion hotspots decades before structural collapse occurs.",
      "limitations": "SeweX requires detailed wastewater temperature, sulfate concentration, and COD parameters to predict sulfide generation accurately.",
      "conclusions": "Chemical dosing (ferric chloride, caustic soda, magnesium hydroxide) can be optimized using real-time H2S sensors, cutting chemical costs by 30%.",
      "reflection": "This is the core scientific foundation for my Papers 19, 20, and 21 on H2S gas and liquid bisulfide sensor monitoring."
    }
  },

  # -------------------------------------------------------------
  # 22. Gas Data SA Water H2S Sensor Evaluation
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-22",
    "title": "Gas Data Ltd / SA Water Technical Note: In-Sewer H2S Gas Sensor Longevity & Poisoning",
    "organization": "Gas Data Ltd & SA Water",
    "region": "Australia",
    "country": "Australia",
    "year": 2021,
    "docType": "Technical Evaluation Report",
    "topic": "H2S Gas Sensor Poisoning",
    "pdfUrl": "#",
    "externalUrl": "https://www.gasdata.co.uk",
    "mediaType": "report",
    "size": "1.8 MB",
    "pages": 36,
    "summary": "Technical report on electrochemical and optical H2S gas sensors in raw sewer manhole atmospheres. Analyzes sensor saturation, mercaptan poisoning, and electrolyte drying in extreme humidity.",
    "keyTakeaways": [
      "Standard industrial electrochemical H2S cells suffer severe sensor drift and electrolyte poisoning within 3–6 months in raw sewer atmospheres (>95% RH, 0–200 ppm H2S).",
      "Documents chemical cross-sensitivity to volatile organic compounds, mercaptans, and methane causing false high alarms.",
      "Recommends optical NDIR or robust diffusion-barrier electrochemical cells with automated baseline zeroing."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Gas Data Ltd & SA Water (2021). Technical Report: Performance Evaluation and Chemical Poisoning Mechanisms of Solid-State and Electrochemical H2S Sensors in Raw Sewer Atmospheres. Gas Data Technical Services & SA Water Asset Planning, Adelaide, SA.",
      "intro": "In Paper 20, I compared H2S gas sensors and established a sensor management procedure. This joint evaluation between Gas Data and SA Water documents the exact failure modes seen when deploying gas sensors in South Australian sewers.",
      "methods": "Tested multiple commercial electrochemical H2S sensors installed in Adelaide manholes and Gawler sewer trunks over 12 months. Tracked baseline drift, response time (T90), and sensitivity degradation.",
      "scope": "Sewer manhole headspaces, drop structures, pump station discharge chambers, and air-valve pits.",
      "usefulness": "Crucial operational knowledge for our Parameter Catalogue. Siting an H2S sensor in an unventilated manhole without considering sensor saturation guarantees premature equipment failure within half a year.",
      "limitations": "Optical NDIR gas sensors resist chemical poisoning but require significantly more battery power than passive electrochemical cells.",
      "conclusions": "Electrochemical H2S sensors must be paired with automated environmental baseline recalibration and replaced every 12–18 months.",
      "reflection": "Directly supports Paper 20 (Comparison of H2S gas sensors: a sensor management procedure for collection systems)."
    }
  },

  # -------------------------------------------------------------
  # 23. Safe Work Australia ATEX Confined Spaces Code
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-23",
    "title": "Safe Work Australia: Confined Spaces and Explosive In-Sewer Atmospheres Code",
    "organization": "Safe Work Australia",
    "region": "Australia",
    "country": "Australia",
    "year": 2020,
    "docType": "National Safety Code of Practice",
    "topic": "Confined Space & ATEX Zone 0 Safety",
    "pdfUrl": "#",
    "externalUrl": "https://www.safeworkaustralia.gov.au/doc/model-code-practice-confined-spaces",
    "mediaType": "standard",
    "size": "2.4 MB",
    "pages": 68,
    "summary": "Statutory Australian safety code governing equipment installation in hazardous sewer atmospheres. Mandates intrinsically safe (Ex ia / ATEX Zone 0) certification to prevent electrical sparks from igniting methane gas.",
    "keyTakeaways": [
      "Classifies wastewater manholes and wet wells as Zone 0 / Zone 1 hazardous explosive environments due to methane (CH4) and hydrogen sulfide (H2S).",
      "Mandates that any permanent electronic sensor, battery pack, or antenna must hold certified IECEx / ATEX Ex ia (intrinsically safe) ratings.",
      "Establishes strict gas testing, tripod harness, and continuous atmospheric monitoring rules for human technician entry."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Safe Work Australia (2020). Confined Spaces Code of Practice: Hazardous Atmospheres, Toxic Gases (H2S, CO) and Explosion Risks (CH4). Safe Work Australia, Canberra, ACT.",
      "intro": "Engineers often design clever IoT sensor prototypes using Raspberry Pi or Arduino boards. In the real world, you cannot put an uncertified battery circuit inside a sewer manhole because a single electrical spark could ignite methane gas and blow up the street.",
      "methods": "Defines intrinsic safety parameters: electronic circuits must limit thermal and electrical energy under all normal and fault conditions so they cannot cause an ignition of explosive gas mixtures.",
      "scope": "All municipal sewerage manholes, wet wells, grit chambers, and enclosed wastewater infrastructure in Australia.",
      "usefulness": "This is a hard operational constraint for our sensor placement tool. Siting sensors at sites requiring frequent human descent incurs massive traffic management and confined-space entry costs ($1,500+ per visit). Non-contact sensors installed from the surface avoid these expenses.",
      "limitations": "IECEx certification increases sensor manufacturing costs by 300–500% compared to standard consumer electronics.",
      "conclusions": "Intrinsically safe certification (Ex ia Zone 0) is mandatory; sensor placement should prioritize surface-accessible mountings to minimize confined-space entries.",
      "reflection": "Directly guides the practical feasibility evaluation across all my sensor hardware reviews (Papers 1, 3, 11, 22)."
    }
  },

  # -------------------------------------------------------------
  # 24. Sydney Water Chemical Dosing Strategy
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-24",
    "title": "Sydney Water Wastewater Network Odour and Corrosion Control Strategy",
    "organization": "Sydney Water Corporation",
    "region": "Australia",
    "country": "Australia",
    "year": 2022,
    "docType": "Utility Operational Strategy",
    "topic": "Liquid Sulfide Sensors & Dosing Automation",
    "pdfUrl": "#",
    "externalUrl": "https://www.sydneywater.com.au",
    "mediaType": "report",
    "size": "3.5 MB",
    "pages": 52,
    "summary": "Technical strategy outlining how Sydney Water utilizes online liquid-phase sulfide sensors at pump station discharge rising mains to automate ferric chloride chemical dosing.",
    "keyTakeaways": [
      "Documents automated feed-forward and feedback chemical dosing algorithms using liquid bisulfide (HS-) probes.",
      "Demonstrates 28% reduction in chemical coagulant consumption compared to static timer-based dosing.",
      "Establishes maintenance and cleaning schedules for ion-selective and spectrophotometric sulfide probes in raw sewage."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Sydney Water Corporation (2022). Wastewater Network Odour and Corrosion Control Strategy: Liquid-Phase Monitoring and Dosing Automation Protocols. Sydney Water, Parramatta, NSW.",
      "intro": "Pumping ferric chloride or oxygen into a rising main to stop sulfide costs utilities millions of dollars each year. Sydney Water's strategy shows how online liquid sensors pay for themselves by dialing dosing up and down in real-time.",
      "methods": "Integrates in-line liquid sulfide sensors at rising main discharge outfalls with SCADA dosing pump controllers, modulating chemical addition in response to diurnal sulfate and flow variations.",
      "scope": "Sewage pumping station rising mains, regional transfer tunnels, and odor treatment facilities across Greater Sydney.",
      "usefulness": "Connects directly to Paper 21 (comparison of online sensors for liquid phase hydrogen sulphide). Siting liquid sulfide sensors at rising main discharge points provides immediate ROI through chemical dosing optimization.",
      "limitations": "Liquid sulfide probes foul quickly if fats, oils, and grease (FOG) coat the sensor membrane.",
      "conclusions": "Online liquid-phase sensing transforms chemical dosing from an expensive blunt instrument into an automated closed-loop control system.",
      "reflection": "Directly supports Paper 21 (Comparison of online sensors for liquid phase hydrogen sulphide monitoring)."
    }
  },

  # -------------------------------------------------------------
  # 25. Bellinge Open Benchmark Dataset
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-25",
    "title": "The Bellinge Open Benchmark Dataset: Urban Drainage Systems Research",
    "organization": "Earth System Science Data & Technical University of Denmark (DTU)",
    "region": "International",
    "country": "Denmark",
    "year": 2021,
    "docType": "Open Benchmark Dataset & Paper",
    "topic": "Calibrated SWMM Benchmark Models",
    "pdfUrl": "#",
    "externalUrl": "https://doi.org/10.5194/essd-13-4779-2021",
    "mediaType": "dataset",
    "size": "14.2 MB",
    "pages": 20,
    "summary": "Open-access benchmark dataset covering 10 years of continuous observations (13 level meters, 1 flow meter, 3 rain gauges) and fully calibrated EPA-SWMM dynamic-wave models in Bellinge, Denmark.",
    "keyTakeaways": [
      "Provides a complete, unredacted, fully calibrated EPA-SWMM (.inp) network model with verified invert levels.",
      "Includes 10-year paired continuous time series of rainfall, in-sewer water levels, and pump energy consumption.",
      "Widely recognized international open benchmark for testing and validating sensor placement and anomaly detection algorithms."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Nedergaard Pedersen, A., Pedersen, J. W., Vigueras-Rodríguez, A., Brink-Kjær, A., Borup, M., & Mikkelsen, P. S. (2021). The Bellinge data set: open data and models for community-wide urban drainage systems research. Earth System Science Data, 13(10), 4779–4798.",
      "intro": "One of the greatest bottlenecks in sewer research is that water utilities refuse to share raw network data due to security and privacy concerns. The Bellinge dataset is the gold-standard open alternative.",
      "methods": "Documented 10 years of sensor observations in a 1.7 km2 urban catchment with separate and combined sewers, releasing calibrated hydrodynamic models for EPA SWMM and MIKE URBAN.",
      "scope": "Urban drainage, stormwater retention basins, level sensor networks, and radar rainfall validation.",
      "usefulness": "This is Dataset 1.1 in our project `data_availability_matrix.csv`. Running our sensor placement algorithm on the Bellinge network allows us to prove our heuristic works on an independently calibrated international network.",
      "limitations": "Danish climate and low-relief topography differ from the steeper gradients and intense summer storms of South Australia.",
      "conclusions": "Open benchmark datasets are vital for comparing optimal sensor placement algorithms under objective, repeatable conditions.",
      "reflection": "Provides the external cross-validation dataset required to demonstrate generalizability beyond Walkerville."
    }
  },

  # -------------------------------------------------------------
  # 26. Blumensaat UWO Dataset
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-26",
    "title": "The UWO Dataset: Full-Scale Field Laboratory Observations in Fehraltorf",
    "organization": "Earth System Science Data & Eawag",
    "region": "International",
    "country": "Switzerland",
    "year": 2026,
    "docType": "Open Benchmark Dataset & Paper",
    "topic": "Full-Scale Wireless Sensor Observatory",
    "pdfUrl": "#",
    "externalUrl": "https://doi.org/10.25678/000C5K",
    "mediaType": "dataset",
    "size": "18.5 MB",
    "pages": 22,
    "summary": "Comprehensive 3-year open dataset from the Urban Water Observatory (UWO) in Fehraltorf, Switzerland. Features 124 sensors (89 wireless LoRaWAN nodes) tracking water levels, temperatures, and runoff.",
    "keyTakeaways": [
      "Monitored 124 sensor locations with high temporal resolution (1–5 min) over 3 continuous years (2019–2021).",
      "Demonstrates high-density wireless sensor networks deployed inside manholes using low-power LoRaWAN telemetry.",
      "Supplies paired calibrated hydrodynamic models and GIS asset data for open algorithmic replication."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Blumensaat, F., Bloem, S., Ebi, C., Disch, A., Förster, C., Maurer, M., Rodriguez, M., & Rieckermann, J. (2026). The UWO dataset – long-term observations from a full-scale field laboratory to better understand urban hydrology at small spatio-temporal scales. Earth System Science Data, 18, 5187–5208.",
      "intro": "This dataset represents my own Paper 5 in the research library. It proves that dense, low-power IoT sensor networks can operate reliably across an entire municipal sewer network for years.",
      "methods": "Deployed 89 battery-powered LoRaWAN ultrasonic and radar level nodes, rainfall stations, and temperature loggers, streaming data into an automated quality-control pipeline.",
      "scope": "Municipal sewer collection network, stormwater overflows, urban streams, and subcatchment hydrology.",
      "usefulness": "Provides real-world empirical distributions of sensor failure rates, battery drainage, and communication packet drops that we use to parameterize sensor reliability in our placement tool.",
      "limitations": "Alpine Swiss hydrology features snowmelt and cold groundwater infiltration, which behaves differently from Australian dry-weather sewer regimes.",
      "conclusions": "Dense wireless sensor networks provide unprecedented visibility into localized sewer bottlenecks and inflow dynamics.",
      "reflection": "This is my Paper 5; using its empirical findings anchors our capstone sensor placement logic in published field evidence."
    }
  },

  # -------------------------------------------------------------
  # 27. USGS Ding Duluth Sparse Sensing
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-27",
    "title": "USGS / Ding et al.: Data-Driven Sparse Sensing in Urban Drainage Networks",
    "organization": "University of Minnesota Duluth & USGS",
    "region": "United States",
    "country": "United States",
    "year": 2025,
    "docType": "Research Monograph & Code",
    "topic": "Digital Twin Sparse Sensing",
    "pdfUrl": "#",
    "externalUrl": "https://arxiv.org",
    "mediaType": "report",
    "size": "3.9 MB",
    "pages": 48,
    "summary": "Formulates Digital Twin-based Data-Driven Sparse Sensing (DSS) for urban drainage networks. Couples EPA-SWMM with Singular Value Decomposition (SVD) and QR factorization to find optimal sensor nodes.",
    "keyTakeaways": [
      "Uses SVD and QR decomposition with column pivoting to select sensor locations that maximize flow reconstruction accuracy.",
      "Demonstrates in the Woodland catchment (Duluth, MN) that monitoring just 10–15% of nodes reconstructs system-wide hydraulics.",
      "Directly benchmarks graph-spectral modal exposure against traditional heuristic sensor placement rules."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Ding, Z., Zhang, K., et al. (2025). Digital Twin-Based Data-Driven Sparse Sensing (DSS) for Optimal Sensor Placement in Urban Drainage Networks: Woodland Catchment Case Study, Duluth, MN. UMN Duluth & USGS Research Archive.",
      "intro": "If you have a budget for only 5 sensors in a network of 150 manholes, where do you put them? Ding and Zhang apply mathematical sparse sensing to answer that question with absolute mathematical rigor.",
      "methods": "Runs an ensemble of storm simulations in EPA-SWMM, constructs a spatiotemporal flow matrix, extracts the dominant spatial flow modes via Singular Value Decomposition, and selects optimal sensor locations using QR factorization.",
      "scope": "Urban storm and sanitary sewer collection systems, pipe graphs, and hydrodynamic digital twins.",
      "usefulness": "This is Dataset 1.2 in our project `data_availability_matrix.csv`. We can benchmark our Walkerville 5-factor heuristic against Ding's QR-decomposition sparse sensing algorithm to prove mathematical robustness.",
      "limitations": "Relies entirely on simulation model accuracy; if the underlying SWMM model has incorrect pipe slopes, the extracted flow modes will be skewed.",
      "conclusions": "Sparse sensing mathematical techniques mathematically minimize redundant information between neighboring sensors.",
      "reflection": "Directly inspires the algorithmic comparison tab in our capstone placement tool."
    }
  },

  # -------------------------------------------------------------
  # 28. Do et al. 2023 SA Water Stonyfell Pilot
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-28",
    "title": "Do et al. / SA Water: Early Detection of Wastewater Overflows in Stonyfell",
    "organization": "SA Water Corporation & University of Adelaide",
    "region": "Australia",
    "country": "Australia",
    "year": 2023,
    "docType": "Utility Pilot Case Study & Paper",
    "topic": "Stonyfell Smart Sewer Pilot & FID",
    "pdfUrl": "./contributors/abraham/papers/2023_Do_Stonyfell-SA-overflow-detection.pdf",
    "externalUrl": "https://doi.org/10.1061/JWRMD5.WRENG-5589",
    "mediaType": "pdf",
    "size": "2.8 MB",
    "pages": 14,
    "summary": "The landmark SA Water smart sewer pilot: deployed 62 Pulsar ultrasonic level sensors across 11.3 km of network in Stonyfell, Adelaide. Used the Finding Irregular Duration (FID) algorithm to catch chokes 32.6 days before spills.",
    "keyTakeaways": [
      "Deployed 62 ultrasonic level monitors in typical 150 mm pipes (11,300 m network length, average slope 7.8%).",
      "Finding Irregular Duration (FID) algorithm identified developing choke events an average of 32.6 days prior to overflow.",
      "Reported 24% sensor failure/maintenance rate in year 1, emphasizing sensor reliability and maintenance realities."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Do, N. C., Dix, L., Lambert, M. F., & Stephens, M. L. (2023). Proactive Detection of Wastewater Overflows for Smart Sanitary Sewer Systems: Case Study in South Australia. Journal of Water Resources Planning and Management, 149(1), 05022016.",
      "intro": "This is our primary client's own field trial. SA Water instrumented Stonyfell to prove that smart sensors can catch tree-root chokes weeks before wastewater spills out onto roads or into creeks.",
      "methods": "Placed ultrasonic water-level sensors logging depth every 5 minutes. The FID algorithm flags water levels that remain abnormally elevated for longer than typical diurnal patterns at that specific manhole.",
      "scope": "Stonyfell gravity sewer network in Adelaide's eastern suburbs, featuring steep slopes and heavy tree-root intrusion.",
      "usefulness": "This is the core empirical anchor for our entire capstone. It gives us real South Australian operational metrics: 32.6-day average warning lead time, 150 mm pipe choke dynamics, and a 24% year-1 sensor failure rate.",
      "limitations": "Sensors were placed based on expert operator judgment and blockage history; SA Water did not use an automated optimization algorithm to determine sensor locations.",
      "conclusions": "Continuous level monitoring successfully transforms reactive spill cleanup into proactive, scheduled jetting weeks in advance.",
      "reflection": "This document connects directly to our SA Water project brief, providing the baseline utility practice that our capstone placement algorithm is designed to improve upon."
    }
  },

  # -------------------------------------------------------------
  # 29. UKWIR Sensor Placement Strategies
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-29",
    "title": "UKWIR Report 21/WM/07/11: Sensor Placement Strategies for Early Blockage Detection",
    "organization": "UK Water Industry Research (UKWIR)",
    "region": "United Kingdom",
    "country": "United Kingdom",
    "year": 2021,
    "docType": "Industry Research Report",
    "topic": "Sewer Blockage & Flooding Sensor Strategies",
    "pdfUrl": "#",
    "externalUrl": "https://ukwir.org",
    "mediaType": "report",
    "size": "3.7 MB",
    "pages": 84,
    "summary": "UK water industry guidance comparing heuristic sensor placement (historical flood hotspots, critical trunk junctions) against algorithmic spatial optimization models across 10 water companies.",
    "keyTakeaways": [
      "Finds that heuristic placement (hotspots) catches frequent repeat chokes but misses catastrophic new failures in unmonitored branches.",
      "Recommends a two-tier hybrid strategy: permanent monitoring on critical trunk assets, and roaming sensors in high-risk reticulation zones.",
      "Highlights that grease and wet wipe disposal causes >70% of blockages in the UK, making reticulation branches high-priority."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "UK Water Industry Research (UKWIR, 2021). Sensor Placement Strategies for Early Detection of Sewer Network Blockages and Flooding. Report No. 21/WM/07/11, UKWIR, London, UK.",
      "intro": "Across the UK, water companies are installing tens of thousands of sewer level monitors. UKWIR evaluated how utilities actually decide where to place these sensors and where the industry heuristics fall short.",
      "methods": "Benchmarked sensor siting strategies across 10 UK water companies (Severn Trent, United Utilities, Yorkshire Water), comparing historical incident targeting against network topology algorithms.",
      "scope": "Combined and separate municipal sewer networks, storm overflow assets, and surface flooding hotspots.",
      "usefulness": "Validates our project's approach: relying purely on historical hotspots is backward-looking and fails when urban infill housing adds new load to previously stable pipes.",
      "limitations": "UK sewers are predominantly combined systems, so storm surge dynamics play a heavier role than in Australia's separate sanitary networks.",
      "conclusions": "Optimal placement must integrate hydraulic capacity risk with customer demographic growth, not just past blockage work orders.",
      "reflection": "Directly supports Paper 4 (cost-efficient coverage of wastewater networks by IoT monitoring devices)."
    }
  },

  # -------------------------------------------------------------
  # 30. US EPA CMOM Guide (Shared Duplicate 1/6)
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-30",
    "title": "US EPA CMOM Guide: Capacity, Management, Operation, and Maintenance Programs",
    "organization": "US Environmental Protection Agency (US EPA)",
    "region": "United States",
    "country": "United States",
    "year": 2005,
    "docType": "Regulatory Guidance Manual",
    "topic": "CMOM Capacity Assurance & Inflow Control",
    "pdfUrl": "./contributors/rijoy-john/grey/GL_2005_USEPA_CMOM_Guide.pdf",
    "externalUrl": "https://www.epa.gov",
    "mediaType": "pdf",
    "size": "2.6 MB",
    "pages": 112,
    "summary": "Foundational federal compliance manual for evaluating sewer network capacity, I&I abatement, preventative maintenance, and overflow mitigation. Establishes that blockages cause 48% of events but capacity causes ~75% of volume.",
    "keyTakeaways": [
      "Establishes federal CMOM criteria: utilities must guarantee adequate conveyance capacity before permitting new connections.",
      "Identifies that 48% of SSO events are caused by blockages, but capacity/wet-weather events account for ~75% of total spilled volume.",
      "Mandates regular hydraulic capacity audits and continuous flow monitoring at key interceptors."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "U.S. Environmental Protection Agency (2005). Guide for Evaluating Capacity, Management, Operation, and Maintenance (CMOM) Programs at Sanitary Sewer Collection Systems. Publication No. EPA 305-R-04-001, Office of Wastewater Management, Washington, DC.",
      "intro": "The US EPA's CMOM framework is the universal regulatory standard for collection system management. It defines what a utility must do to prove it has adequate hydraulic capacity.",
      "methods": "Establishes structured audit checklists across collection system capacity assurance, maintenance prioritization, overflow response, and sewer inspection.",
      "scope": "Municipal sanitary sewer collection systems nationwide in the US, widely referenced internationally.",
      "usefulness": "Provides the essential regulatory distinction between blockage-driven spills (frequent, smaller volume) and capacity-driven spills (less frequent, massive volume). Our sensor network must be designed to detect both.",
      "limitations": "Written primarily as a regulatory compliance audit manual rather than a computational sensor optimization guide.",
      "conclusions": "Continuous flow and level monitoring are required to certify capacity before new housing connections are approved.",
      "reflection": "Shared foundational baseline in our library, connecting my sensor research with Rijoy's grey literature review."
    }
  },

  # -------------------------------------------------------------
  # 31. ASCE MOP 60 Siting Checklist (Shared Duplicate 2/6)
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-31",
    "title": "ASCE Manual of Practice No. 60 (MOP 60): Gravity Sanitary Sewer Design (§3.7.2 Checklist)",
    "organization": "American Society of Civil Engineers (ASCE) & WEF",
    "region": "United States",
    "country": "United States",
    "year": 2007,
    "docType": "Industry Standard & Design Manual",
    "topic": "Hydraulic Design & Meter Siting (§3.7.2)",
    "pdfUrl": "./contributors/rijoy-john/grey/GL_2007_ASCE_WEF_MOP60_Gravity_Sanitary_Sewer_Design.pdf",
    "externalUrl": "https://ascelibrary.org",
    "mediaType": "pdf",
    "size": "6.9 MB",
    "pages": 360,
    "summary": "The seminal international manual on gravity sewer design, containing the industry's standard flow meter and sensor siting checklist (§3.7.2).",
    "keyTakeaways": [
      "Authoritative design manual for gravity sanitary sewer networks, pipe hydraulics, and manhole spacing.",
      "Section 3.7.2 provides the industry's foundational flow-meter siting checklist: homogeneous upstream land use, clean hydraulic profile, isolatable upstream pipe footage.",
      "Represents the primary heuristic benchmark against which algorithmic optimal sensor placement (OSP) is evaluated."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "American Society of Civil Engineers & Water Environment Federation (2007). ASCE Manuals and Reports on Engineering Practice No. 60: Gravity Sanitary Sewer Design and Construction. ASCE, Reston, VA.",
      "intro": "When a consulting engineer decides where to put a sewer flow meter, they turn to Section 3.7.2 of ASCE MOP 60. It is the gold standard heuristic siting checklist.",
      "methods": "Specifies hydraulic requirements for meter siting: avoid turbulent drop manholes, choose straight pipe runs with uniform slope, avoid backwater zones from downstream pumps, and isolate homogeneous land uses.",
      "scope": "Gravity collection sewers, interceptors, outfalls, and metering chambers.",
      "usefulness": "This checklist gives our capstone project the exact heuristic rules to beat. Our algorithmic placement tool must incorporate these physical suitability constraints so it doesn't place a sensor in a hydraulically turbulent drop structure.",
      "limitations": "Checklists are applied one manhole at a time; they cannot optimize network-wide coverage or trade-offs across 1,000 pipes simultaneously.",
      "conclusions": "Engineering siting checklists must be integrated with network-wide graph optimization algorithms.",
      "reflection": "Directly supports Paper 2 and Paper 4 by providing the physical hydraulic suitability criteria for sensor nodes."
    }
  },

  # -------------------------------------------------------------
  # 32. Sydney Water WWOM Synthesis (Shared Duplicate 3/6)
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-32",
    "title": "Sydney Water Wastewater Overflow Model (WWOM) 2016–2024 Synthesis Report",
    "organization": "Sydney Water Corporation",
    "region": "Australia",
    "country": "Australia",
    "year": 2024,
    "docType": "Utility Technical Report",
    "topic": "Wet-Weather Overflows & Source Control",
    "pdfUrl": "./contributors/rijoy-john/grey/GL_2024_SydneyWater_WWOM_Synthesis_Report.pdf",
    "externalUrl": "https://www.sydneywater.com.au",
    "mediaType": "pdf",
    "size": "10.5 MB",
    "pages": 48,
    "summary": "Synthesizes Sydney Water's strategic pivot from storage-based containment (>A$18B, 350+ yrs) to I&I source control (17x cheaper). Evaluates 8,000+ level sensor rollouts catching 300+ blockages monthly.",
    "keyTakeaways": [
      "Storage containment rejected as unaffordable (>A$18B, 350+ yrs); pivoted to I&I source control (17x cheaper, target 2060).",
      "Operating licence target reformed from spill frequency to -6% (1.6 GL) wet-weather overflow volume.",
      "Active network sensing: 8,000+ level sensors deployed (+15k planned), detecting 300–370 blockages before spills occur (~A$400k/mo avoided)."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Sydney Water Corporation (2024). Wastewater Overflow Model (WWOM) 2016–2024 Synthesis Report. Sydney Water, Parramatta, NSW.",
      "intro": "Sydney Water operates Australia's largest smart sewer network (8,000+ level monitors, expanding to 23,000). This report documents what happened when they deployed sensors at scale.",
      "methods": "Installed non-contact level sensors at choke-prone manholes and combined flow meters at trunk interceptors. Monitored dry-weather sewage depths in real time to catch blockages before overflow.",
      "scope": "Greater Sydney metropolitan sewerage system (~25,000 km of pipes).",
      "usefulness": "Provides real Australian empirical business-case data: 8,000 sensors catch 300–370 blockages a month before wastewater overflows into homes or waterways, saving ~A$400,000 a month in emergency response.",
      "limitations": "Shows that sensor deployment alone doesn't fix wet-weather inflows; sensors must trigger active I&I rehabilitation programs.",
      "conclusions": "Level sensor rollouts provide immense ROI by stopping dry-weather spills, while buying time for long-term I&I source control.",
      "reflection": "Connects my level and acoustic sensor research (Papers 1–4, 6) with real-world Australian utility practice."
    }
  },

  # -------------------------------------------------------------
  # 33. WSAA CS5 Sydney Water Risk Licensing (Shared Duplicate 4/6)
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-33",
    "title": "WSAA Wet Weather Case Study 5: Sydney Water Risk-Based Licensing (PRP 307)",
    "organization": "Sydney Water / WSAA",
    "region": "Australia",
    "country": "Australia",
    "year": 2019,
    "docType": "Case Study & Regulation",
    "topic": "Risk-Weighted Sensor Placement & Spatial Risk",
    "pdfUrl": "./contributors/rijoy-john/grey/GL_WSAA_WetWeather_CS5_SydneyWater.pdf",
    "externalUrl": "https://www.wsaa.asn.au",
    "mediaType": "pdf",
    "size": "1.1 MB",
    "pages": 12,
    "summary": "Presents Sydney Water's framework with NSW EPA (PRP 307) replacing uniform frequency limits with risk-weighted receptor sensitivity scores (spill volume x environmental vulnerability).",
    "keyTakeaways": [
      "Replaced uniform overflow frequency targets with EPA point-based spatial risk scores.",
      "Utilises GIS layers, hydraulic models, and mobile-phone foot traffic data to prioritize Category-1 overflow abatement.",
      "Establishes precedent for weighted-coverage sensor placement objectives."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Sydney Water & WSAA (2019). WSAA Wet Weather Overflows Case Study 5: Sydney Water Risk-Based Overflows Licensing Framework. WSAA, Melbourne, Australia.",
      "intro": "In traditional regulation, an overflow into a concrete drainage channel is penalized the same as an overflow onto a crowded beach. Sydney Water and the EPA revolutionized this with risk-based licensing.",
      "methods": "Scores overflow points based on environmental and public health exposure: receiving water classification, swimming recreational use, and foot traffic derived from mobile phone density data.",
      "scope": "Sydney Water catchments, environmental protection licences, and wet-weather outfalls.",
      "usefulness": "Gives our optimization algorithm the mathematical foundation for weighting candidate sensor locations: a reach discharging near a school or nature reserve receives a higher placement score than a remote industrial outfall.",
      "limitations": "Calculating receptor sensitivity requires detailed multi-agency GIS layers that are not always maintained by smaller regional councils.",
      "conclusions": "Optimal sensor placement should maximize risk-weighted coverage rather than treating every pipe segment equally.",
      "reflection": "Directly supports our capstone goal of explainable, risk-weighted sensor placement for SA Water."
    }
  },

  # -------------------------------------------------------------
  # 34. WSAA CS6 Unitywater Data-Led Abatement (Shared Duplicate 5/6)
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-34",
    "title": "WSAA Wet Weather Case Study 6: Unitywater Data-Led Overflow Abatement Program",
    "organization": "Unitywater / WSAA",
    "region": "Australia",
    "country": "Australia",
    "year": 2019,
    "docType": "Case Study & Pilot",
    "topic": "I&I Screening & Telemetry Pre-Screening",
    "pdfUrl": "./contributors/rijoy-john/grey/GL_WSAA_WetWeather_CS6_Unitywater.pdf",
    "externalUrl": "https://www.wsaa.asn.au",
    "mediaType": "pdf",
    "size": "937 KB",
    "pages": 10,
    "summary": "Details Unitywater's program abating 90 hotspot overflows by screening existing SCADA, pump run-times, and GIS telemetry before executing targeted field inspections.",
    "keyTakeaways": [
      "Abated 90 hotspot overflow sites without massive capital augmentation.",
      "Built screening KPIs entirely from existing telemetry data (SCADA, pump run-times, GIS) before any field mobilization.",
      "Identified up to 50% of peak wet weather inflow originated from private plumbing defects across 70,000+ inspected lots."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Unitywater & WSAA (2019). WSAA Wet Weather Overflows Case Study 6: Unitywater Data-Led Overflow Abatement Program. WSAA, Melbourne, Australia.",
      "intro": "Vineeth Maruvada (SA Water) emphasized in our project brief that we should determine what existing information can reveal overcapacity before deciding where to place new sensors. Unitywater did exactly that.",
      "methods": "Screened existing SCADA pump run-time data and hydraulic models to rank catchments with excessive wet-weather inflow before spending money on field sensors or smoke testing.",
      "scope": "Unitywater service area (Moreton Bay and Sunshine Coast, Queensland).",
      "usefulness": "This case study validates our project's core philosophy: optimal sensor placement should be the second step, deployed only after pre-screening existing asset and telemetry data.",
      "limitations": "Pump run-time data is coarse; it tells you a catchment is leaking, but not which specific branch pipe contains the illegal connections.",
      "conclusions": "Using existing data to narrow down candidate zones cuts sensor capital expenditure by more than half.",
      "reflection": "Directly embodies the guidance from our SA Water industry partner feedback in the project scoping document."
    }
  },

  # -------------------------------------------------------------
  # 35. WSAA CS7 Icon Water Environmental Duty (Shared Duplicate 6/6)
  # -------------------------------------------------------------
  {
    "id": "SATYA-GL-35",
    "title": "WSAA Wet Weather Case Study 7: Icon Water Environmental Duty Multi-Criteria Assessment",
    "organization": "Icon Water / WSAA",
    "region": "Australia",
    "country": "Australia",
    "year": 2019,
    "docType": "Case Study & Framework",
    "topic": "Growth Overcapacity & Containment Criteria",
    "pdfUrl": "./contributors/rijoy-john/grey/GL_WSAA_WetWeather_CS7_IconWater.pdf",
    "externalUrl": "https://www.wsaa.asn.au",
    "mediaType": "pdf",
    "size": "3.6 MB",
    "pages": 14,
    "summary": "Examines loss of sewer capacity due to incremental urban growth beyond pipe/pump limits in Canberra, implementing multi-criteria risk assessments that saved ~A$173M via smart monitoring.",
    "keyTakeaways": [
      "Identified incremental growth in sewage catchment beyond pipe/pump capacity as primary driver of overflow degradation.",
      "Adopted 1-in-10-year ARI containment standard; Manning full-pipe capacity >= PWWF.",
      "Implemented risk-based MCA allowing smart monitoring and ops alarms as valid alternatives to physical upsizing, saving ~A$173M."
    ],
    "assignedTo": "Satya Siddhartha",
    "steps": {
      "citation": "Icon Water & WSAA (2019). WSAA Wet Weather Overflows Case Study 7: Icon Water Environmental Duty Multi-Criteria Assessment. WSAA, Melbourne, Australia.",
      "intro": "When Canberra's suburbs grew faster than expected, trunk sewers ran out of capacity. Traditional planning said to spend hundreds of millions upsizing pipes. Icon Water proved smart sensors could provide an approved alternative.",
      "methods": "Used a Multi-Criteria Analysis (MCA) framework to demonstrate that enhanced level sensing, early telemetry alarms, and proactive storage management achieved equal environmental protection at a fraction of the cost.",
      "scope": "Canberra municipal sewerage network (Icon Water / ACT).",
      "usefulness": "This is the business case justification for our entire capstone. Regulators accepted smart sensor monitoring as a legal alternative to physical pipe duplication, saving the utility ~A$173M.",
      "limitations": "Monitoring does not create physical pipe volume; it works only where upstream pipes or manholes have residual buffer storage.",
      "conclusions": "Real-time monitoring is now accepted by Australian environmental regulators as an active mitigation strategy against urban growth overcapacity.",
      "reflection": "Directly links to Paper 4 and provides the economic and regulatory justification for the SA Water OSP capstone."
    }
  }
]

out = {
  "contributor": "Satya Siddhartha",
  "totalCount": len(items),
  "greyLiterature": items
}

output_path = os.path.join(
    os.path.dirname(__file__),
    "..",
    "contributors",
    "satya-siddhartha",
    "grey-literature.json"
)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"Successfully generated {len(items)} items in {output_path}")
