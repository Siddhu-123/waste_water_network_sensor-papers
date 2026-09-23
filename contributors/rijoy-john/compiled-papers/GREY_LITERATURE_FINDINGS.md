# Grey Literature Findings: How Water Utilities Handle Sewer Overflows, Capacity and Growth

**What this is:** a stand-alone summary of *everything found so far in the grey literature*: documents published by water utilities,
utility associations, regulators and government agencies. It is the source text for the LaTeX write-up
`grey_literature/grey_literature_review.tex` (+ `grey_literature.bib`).

**Built from:**
- `grey_literature/GREY_LITERATURE_TRACKER.md`: GL-01…GL-59, sewer case studies worldwide (**45 PDFs** in `grey_literature/0923/`,
  about 40 web/news pages; the former `corpus_copies/` folder was deleted 2026-09-24).
- `modelling/grey_literature/GREY_LITERATURE_LINKS.md`: growth → capacity → monitoring sources (**24 PDFs** in `modelling/grey_literature/`,
  about 25 web/news pages), collected for `modelling/08`.

Every grey-literature PDF is named `GL_<Year>_<Org>_<ShortTitle>.pdf`. Look up links and local paths in the two index files. This file only cites
the GL ID or the filename.

**Date:** 2026-09-24 · **Evidence grades:** ✔ = checked in the primary document · [N] = news or search summary only (verify before citing).

---

## 1. Executive summary

1. **Growth-driven overcapacity is real and acknowledged by utilities, but it is episodic.** Utilities name "incremental growth beyond
   pipe/pump capacity" (Icon Water, GL-07), infill densification (Watercare, GL-08), capacity reached "sooner than originally projected"
   (SA Water, Adelaide north, via ESCOSA 2024) and "insufficient residual capacity to accommodate future growth" (Sydney Water, GL-13) as
   drivers of overflows and capital programs. Where capacity runs out, **development is stopped**: Auckland connection pauses, and US
   moratoria in Anne Arundel County MD and Mooresville NC in 2026.
2. **Blockages dominate incident counts, but capacity events dominate overflow volume.** US EPA 2004: 48% of SSO events are blockages vs 26% wet-weather/capacity,
   but capacity events carry about ¾ of the volume. Tree roots cause ~65% of SA blockages [N].
3. **Wet-weather I&I is the multiplier that turns growth into overflow.** New development often exceeds its I&I allowance (York Region:
   ~24% of young basins exceed 0.26 L/s/ha). Excess I&I uses up capacity *reserved for growth* (Metro Vancouver, allowance 11,200 L/ha/d;
   King County). Utilities are moving from storage to **source control** (Sydney Water: 17× cheaper; Unitywater smoke-tested 70k+ properties).
4. **Australian design codes give usable capacity thresholds, and they differ by utility:**
   - Icon Water / WSA 02: Manning full-pipe capacity ≥ PWWF.
   - TasWater: design d/D = 0.7 and 5-yr ARI containment.
   - Sydney Water planning: PDWF depth < 60% of pipe height, and wet-weather manhole surcharge ≤ 5 in 10 yrs.
   - Containment targets: 1-in-5-yr ARI in Melbourne, 1-in-10 in Canberra, an average of 2 spills per location per year in Auckland.
   - England: at most 10 spills a year per overflow by 2050.
5. **Monitoring has scaled up enormously, but site selection is ad hoc.** Sydney Water has 8,000+ level sensors (15k more planned), United Utilities ~20k,
   and Yorkshire Water 27k level monitors + 45k customer alarms (2025–30). SA Water had 82–88 at Stonyfell, HK DSD 250+, and South Bend ~150.
   The only published placement rules are coarse, e.g. "suburbs with higher than average blockage rates" (SA Water) or "areas at high risk of flooding" (Yorkshire).
   **No utility document describes an optimisation-based placement method**; the closest is ASCE MOP 60's meter-siting checklist.
6. **Monitoring pays when it feeds control or re-planning.** South Bend: CSO −70%, ~US$500 m capex avoided. Louisville RTC: US$200–300 m avoided.
   Kansas City updates its system model every year from monitoring data (adaptive management under a consent decree). Anne Arundel's moratorium was lifted partly because the regulator
   accepted **measured peak flows** instead of design assumptions.
7. **Regulators now prefer risk-weighted objectives to blanket targets.** Examples: Sydney Water's EPA point system (PRP 307), Icon Water's risk MCA (saved ~A$173 m),
   Melbourne Water's deferred augmentation, and effects- and outcomes-based studies (Hunter, Yarra Valley Water). UK DWMPs screen every catchment for growth, urban creep
   and climate using a common risk-based method. This supports a **weighted-coverage** OSP objective.
8. **Ageing and corrosion are the long-tail risk** (Yashio 2025 collapse; Tokyo 23% → 69% of sewers past 50 years). These are out of scope for capacity OSP,
   but relevant to sensor survival and maintenance.

---

## 2. Growth → capacity → overflow: what utilities report

| Evidence | Source | Grade |
|---|---|---|
| Design performance lost "due to incremental growth in the sewage catchment beyond pipe/pump capacity, failures in power supply … or climate change" | Icon Water, WSAA CS7 (GL-07) | ✔ |
| Quarter-acre lots → 2–4 houses, a dozen townhouses or 4–5-storey blocks; overflows at 219 locations → target 10; NZ$1.2 bn Central Interceptor | Watercare, WSAA CS8 (GL-08) | ✔ |
| Victorian interceptors sized for ~4 M people, London now ~9 M; by 2011 as little as 2 mm of rain triggered a discharge; Tideway aims for −95% | Thames Tideway (GL-32) | [N] |
| Growth Servicing Plan 2025–30 for 377k homes (NSW Housing Accord); the Operating Licence requires 10-yr disclosure of wastewater capacity constraints | Sydney Water (GL-13/14) | ✔ |
| SAWRD24 Metropolitan Growth project **$1,070 M**; SA Water "$1.2 bn to support housing growth"; Adelaide north "at capacity sooner than originally projected" | ESCOSA 2024; SA Water AR 2023–24; ABC [N] | ✔ / [N] |
| Target 85% of new housing in established areas by 2045 (infill); regional plan locates 315k homes | Living Adelaide 2017; PlanSA 2025 | ✔ |
| SA Water cannot confirm trunk capacity for 340 homes at Kadina; decision deferred to the 2028 pricing cycle | The Good Builder 2026 | [N] |
| "Timing of maximum development capacity being reached is unknown", so upgrade timing is hard (MDRS intensification) | Waikato DC, Variation 3 | ✔ |
| Capacity is "monitored … and assessed against discharge consent limits, including wastewater overflow frequency"; 4-category capacity maps | Watercare Growth Servicing Policy 2026 | ✔ |
| Sewer capacity moratorium (2 Mar – 3 Jun 2026) triggered by switching from average-day to **peak-flow** accounting; lifted after the regulator accepted **actual peak-flow data** | Anne Arundel County MD | ✔ |
| A pump station at full capacity gives up to a 35-month pause on development | Mooresville NC | [N] |
| Capacity certification required before new connections (consent-decree Capacity Assurance Program) | Chattanooga TN (2016) | ✔ (TOC) |
| New development brings I&I above allowance: ~24% of basins < 20 yrs exceed 0.26 L/s/ha; some systems reach 80% of design capacity 11 yrs early | York Region 2019 | ✔ |
| Counter-evidence: established Melbourne sewers usually absorb infill, but wet-weather flows bind and loads "will at some stage exceed the capacity" | Infrastructure Victoria 2019 | ✔ |
| Bottlenecks raise the HGL upstream (backwater); separate *root-cause* bottleneck pipes from backwater-affected pipes | Scotts Valley CA master plan | ✔ |
| UK DWMPs: 25-yr plans against growth, urban creep and climate; Anglian Water risk-assessed ~600 catchments to 2050 (≤ £5 bn) | Water UK (GL-33/34); Anglian (GL-38) | ✔ / [N] |
| US 20-yr needs US$630 bn, of which conveyance repair and new conveyance ≈ US$151 bn | US EPA CWNS 2022 | ◻ |

**Take-away.** Growth overcapacity is **low-frequency, high-consequence and predictable**. It becomes major when fast or unplanned growth lands on an
old or small trunk or pump station **and** wet-weather I&I is high. Its costs show up as capital programs and development holds more than as incident counts.

---

## 3. Capacity and performance criteria used in practice

| Criterion | Value | Source |
|---|---|---|
| Capacity test (new design) | Manning full-pipe capacity ≥ PWWF; surcharge = water above the obvert | Icon Water WSA 02 supplement (`iconwater2025wsa02`) |
| Design depth | **d/D = 0.7** (Colebrook–White, k = 1.5 mm) | TasWater WSA 02 supplement (GL-58) |
| Planning depth trigger | **PDWF depth < 60% of pipe-full** | Sydney Water planning guideline (GL-12) |
| Wet-weather surcharge | Manhole surcharge within a property ≤ 5 times in 10 yrs (2-yr ARI); no repeat internal surcharge | GL-12 |
| Containment standard | 1-in-5-yr (Victoria; TasWater 5-yr ARI) · 1-in-10-yr ARI (Canberra) | GL-01b, GL-58, GL-07 |
| Overflow frequency limits | EPL/SOLP per system, e.g. St Marys 35 → 20 in 10 yrs (Sydney) · average 2/yr per location (Auckland consent) · ≤ 10 spills/yr by 2050 (England SODRP) | GL-12, GL-08, GL-39 |
| Residential load | 150 L/p/d for new residents (Sydney) · 150 / 180 L/d/EP new / existing = 450 / 540 L/ET/d (TasWater) · 180 L/EP/d (Icon Water) | GL-12, GL-58, `iconwater2025wsa02` |
| Commercial load | 0.225 EP per employee (Sydney) | GL-12 |
| Dry-weather peaking | Sydney: `d = 0.01(logA)^4 − 0.19(logA)^3 + 1.4(logA)^2 − 4.66(logA) + 7.57` (A = gross area, ha) | GL-12 |
| I&I for new areas | 2% (gravity), 1% (pressure sewer); existing I/I extrapolated from its 10-yr trend with 20 yrs of deterioration | GL-12 |
| I&I allowance | 11,200 L/ha/d (Metro Vancouver) · 0.26 L/s/ha upper RDII design allowance (York) | GL-20, York |
| When infill needs its own model sub-catchment | ≥ ~200 dwellings (infill); > 500 dwellings (major development → extend the model); ±10% growth sensitivity | GL-12 |
| Pump-station resilience | ≥ 4 h emergency storage at PDWF | GL-12 |

**Take-away.** The *headroom* signal must be defined against a **utility-specific threshold** (0.6 / 0.7 / 1.0 of full depth). For SA Water this is an open
client question (`modelling/06`).

---

## 4. Monitoring deployments: scale, purpose and how sites were chosen

| Utility / programme | Scale | Main purpose | How sites were chosen (as published) | Reported result |
|---|---|---|---|---|
| SA Water, Stonyfell (2018–) (GL-01, `do2023overflow`) | 82–88 level sensors over 11 km + weather station; Gawler: 88 odour sensors | Blockages → overflows; odour | Suburb with **higher than average blockage rates**; expert judgement within it | ~10 overflows prevented/yr; 24% sensor failures in year 1 |
| Sydney Water (GL-10) | 4,600 (2022) → **8,000+**, +15,000 planned | Blockage detection | Not published | ~20 blockages/month; 300–370+ caught before overflow; ~A$400k/month avoided; meter vs level r = 0.97 (dry days) |
| Yarra Valley Water (GL-19) | Network-wide IoT (≈20,000 km water + sewer) | Blockages → spills; pressure-sewer control | Not published | [N] |
| Unitywater + GHD (GL-18) | ML on radar + SPS data | SPS overflow prediction | Pump-station level | Faster than hydraulic models (trial) [N] |
| United Utilities, DNM (GL-30) | ~19–20k manhole sensors (2021–22), 78,000 km | Blockages, flooding, pollution | "Key points on the sewer pipes" | Preston pilot −80% blockages [N] |
| Yorkshire Water (GL-31) | 27k level monitors + 45k customer alarms + 20k replacements (2025–30), £53 m | Flooding, pollution | "Areas with a high risk of flooding" (hyper-local rainfall modelling) | 35+ pollution incidents prevented, −15% reactive visits [N] |
| England EDM / Scottish Water (GL-39/39c) | Every storm overflow (EDM); Scotland +1,009 sites, live API | Regulatory transparency | All overflows (regulatory) | 3.6 M spill hours in 2024 |
| Hong Kong DSD (GL-46) | 250+ rain/level sensors | Flooding, blockage | Not published | −70–75% emergency overflows in trial areas [N, unverified] |
| South Bend CSOnet (GL-40) | 110 → ~150 wireless sensors, 9 valves, 3 weirs | CSO RTC | Engineering + control needs | CSO −70%; ~US$500 m capex avoided |
| Louisville MSD (GL-43) | System-wide RTC (Csoft) | CSO | RTC design | −247 MG/yr; US$200–300 m avoided |
| Singapore PUB (GL-47) | ~50 km fibre-optic strain/temperature sensing | Tunnel structural health | Whole deep-tunnel length | — |
| **ASCE MOP 60 §3.7.2 (GL-59)** | Guidance | Flow/I&I studies | Homogeneous upstream land use; hydraulically clean manhole; **upstream footage isolatable** for I/I; rain gauges | — |

**Take-away.** The gap in practice is not sensors but **where to put them**. Published rules are hotspot heuristics (incident rate, flood risk) or
engineering checklists. An optimisation that is **explainable** (reason per site), **risk-weighted** and **re-run when growth arrives** matches what
regulators already accept (risk-based licensing, adaptive management).

---

## 5. Wet weather, I&I and overflows

- **Sydney Water WWOM 2016–24 (GL-11):** meeting the 2000-era frequency targets by storage would cost **> A$18 bn** and take **> 350 yrs**, so the utility shifted to
  **I&I source control** (17× cheaper, complete by 2060). The new licence target is **−6% (1.6 GL) of WWO volume**. Sewers in rock/clay trenches channel stormwater into defects.
- **Unitywater (GL-06):** overflows at 50–100 mm of rain. Up to half of RDI comes from private plumbing. 90 hotspot overflows were abated. Screening KPIs are built from *existing* data
  (SCADA, Maximo, GIS) before any field work.
- **Metro Vancouver (GL-20/21), King County (GL-22):** I&I above allowance consumes growth capacity. The barrier is priority, not tools. King County chose project-specific
  I/I reduction over regional targets.
- **Illegal stormwater connections:** smoke-testing programs (Hunter Water, TasWater, East Gippsland), Bengaluru (15,000 connections removed, overflows persist), and Brazil
  (separate systems that behave as combined).
- **Surface-water removal / GI:** Welsh Water RainScape (−85% discharge volume at Cambrian SPS), Philadelphia "Greened Acres", DC Water's Environmental Impact Bond (payment
  tied to measured runoff reduction), Copenhagen (disconnect 30% of impervious area; 300 surface projects).

## 6. Blockages

- Blockages are the most frequent sewer incident everywhere: Thames Water ~75,000/yr (wipes the #1 cause, ~£18 m/yr); SA 17,392 tree-root blockages in 2025–26 [N];
  US EPA 2004 found 48% of SSO events are blockages.
- Responses: **level sensors + analytics** (Sydney Water, SA Water, UU, Yorkshire, YVW) and **behaviour campaigns** (Anglian "Keep it Clear": −80% blockages after a 7-week
  Peterborough trial; Sydney "Toilet Blockers Anonymous").
- Implication: the **same level sensors** detect blockages (fast, local, dry weather) and capacity stress (slow, wet-weather, growth-driven). An OSP that
  serves both has a stronger business case.

## 7. Planning, prioritisation and regulation frameworks

| Framework | Idea | Relevance to OSP |
|---|---|---|
| Risk-based licensing (Sydney Water PRP 307; GL-05/11) | Category-1 overflows first; a point system replaces frequency targets; spatial risk tool (GIS + model + mobile-phone data) | Weights for coverage (receptor sensitivity × likelihood) |
| Environmental duty MCA (Icon Water; GL-07) | Asset-level risk; options from "monitoring + alarms + ops" to upsizing; saved ~A$173 m | Monitoring is an accepted *alternative* to augmentation |
| Effects / outcomes-based studies (Hunter, YVW, Melbourne Water; GL-01b/03/04) | Spend where harm is; sewage often < 1% of the pollutant load | Receiving-environment weights |
| UK DWMP RBCS + BRAVA (GL-33–37) | Screen every catchment (flooding, collapses, blockages, spill triggers, **planned development above thresholds**, 1/10 km hexagons) → detailed risk to 2050 | Two-stage screen → place; hexagon grid for reporting coverage |
| Adaptive management (KC Water; GL-42) | Model updated annually from monitoring; projects re-evaluated at design | Precedent for **growth-triggered re-placement** |
| Capacity assurance (US CMOM, Chattanooga; GL-23) | Certify capacity before connection | Sensors provide the evidence base for certification |
| Capacity disclosure (Sydney Operating Licence; Watercare capacity maps) | Publish constraints per (sub)catchment | Monitoring data defines capacity status |

## 8. Ageing, corrosion and failure

- **Yashio, Saitama (Jan 2025):** a 4.74 m RC trunk (1983) collapsed from H₂S corrosion. The sinkhole grew to ~40 m, the driver died, and 1.2 M people were affected. MLIT's nationwide
  survey found 201 km of emergency-I and 547 km of emergency-II pipe (GL-50).
- **Tokyo (GL-45):** 16,200 km, 82% combined; 23% past the 50-yr life, rising to 69% in 20 yrs.
- **WSAA SCORe (GL-15/16):** A$21 m research program; corrosion models and dosing tools.
- **South Africa (GL-48):** failures driven by underfunded O&M (sewer faults tripled in eThekwini). Monitoring alone cannot fix it.

## 9. Regional contrasts

| Region | Dominant problem | Dominant response |
|---|---|---|
| Australia | Wet-weather overflows in **separate** systems; blockages (tree roots); growth on fringe and infill | Risk-based licensing, I&I source control, large level-sensor rollouts, growth servicing plans |
| New Zealand | Infill densification + combined/partly separated legacy; overflow consents | Tunnels (Central Interceptor), capacity maps, connection limits |
| UK / Ireland | Storm overflows (combined), public pressure | EDM everywhere, SODRP targets, DWMPs, 20–70k network sensors |
| US / Canada | CSO/SSO consent decrees; I&I | Tunnels, GI, RTC, adaptive management, capacity assurance, moratoria |
| Continental Europe | Cloudbursts, CSOs | Surface (blue-green) solutions, radar-based RTC |
| Japan / Asia | Ageing (Japan), flooding (HK), rapid growth (India) | Reconstruction, inspection mandates, deep tunnels (SG), IoT level networks (HK) |
| Africa / Latin America | Under-funded O&M; illegal connections | Backlog funding; enforcement |

---

## 10. Implications for the capstone (OSP for growth-driven overcapacity, SA Water)

1. **Novelty holds in practice as well as in research.** Utilities deploy thousands of sensors without a published optimisation method. SA Water's own rule
   (incident-rate hotspot) and ASCE's siting checklist are the **baselines to beat**.
2. **Headroom threshold:** make it a parameter (0.6 Sydney PDWF / 0.7 TasWater / 1.0 Icon full pipe) and ask SA Water which one applies (`modelling/06`).
3. **Growth load recipe:** EP-based ΔQ with 150–180 L/EP/d, peaking factor, and 2% I&I for new areas (York shows new areas often exceed that, so run a sensitivity case).
4. **Objective:** risk-weighted coverage (receptor sensitivity × overflow likelihood × growth exposure), consistent with PRP 307, DWMP BRAVA and the Icon MCA.
5. **Two-stage design:** screen catchments with existing data (Unitywater KPIs, DWMP RBCS), then place sensors. Report coverage on a hexagon grid (DWMP style).
6. **Re-placement:** adaptive management (Kansas City) and the Anne Arundel "actual peak data" decision justify **augmenting the network when growth is approved**
   and using measured peaks to re-rate capacity.
7. **Dual use:** show that the same placement also covers blockage hotspots (a stronger business case).
8. **Sensor reliability:** plan for failures (24% in year 1 at Stonyfell) through redundancy or robustness in the objective.

## 11. Evidence quality and caveats

- Utility documents are **self-reported** and written for regulators or the public. Results (e.g. "−80% blockages") are rarely independently evaluated.
- Several numbers come from **news or vendor pages** ([N]): Preston −80%, HK −70–75%, Mooresville, Kadina. Verify before citing in the report.
- Vendor case studies (Detectronic, StormHarvester, Iota, Xylem) carry commercial bias.
- Some text layers are garbled (TasWater table, Icon Water equations). Confirm values in the PDFs.
- ASCE MOP 60 is a **commercial** manual: cite it, but don't redistribute it.

## 12. Gaps still open

- The WSAA *Managing Wet Weather Overflows* guideline and Case Study 9; SA Water's own capacity/planning criteria; WRF 5297 and the WRF sensor-network optimisation reports;
  Watercare Code of Practice (◻ not read); SIAAP/Berlin/RIONED (non-English); China sponge-city evaluations.
- No grey-literature source quantifies **how infill changes overflow frequency in a separate system using monitoring data**. That is still the evidence gap the capstone can target.
