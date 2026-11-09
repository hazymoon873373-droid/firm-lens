# FirmLens Whole Repository Audit and Remediation Plan

Date: 2026-11-09. Manager: Codex. Implementer: Antigravity Gemini 4 Argon. This task supersedes the still-PENDING firm-lens-task-001-fix-02 and includes all its requirements. Preserve current uncommitted worker files; do not reset, clean or rewrite the project.

## What this repo does and audit coverage

A public static Vietnamese financial-health idea demo plus a separate browser-only Qwen/PDF experiment. Intended load is individual visitors using their own devices, with no paid backend. The project does NOT yet contain the financial training dataset, fitted financial model or independent forecasting evaluation.

Reviewed: main UI/navigation/data/formulas/export, experimental PDF extraction/retrieval/inference/cache/session flow, styles/responsive structure, tests and smoke evidence, package/lock/build/deployment configuration, README, proposal and approved plans. Generated dist, dependency implementation, model binaries and the entire original PDFs were not manually re-audited; targeted installed runtime declarations were inspected. Historical company figures were not all independently re-audited in this pass.

Fresh checks: npm test 11/11 PASS; npm run build PASS with non-blocking bundle warning; npm run test:browser PASS; npm audit --omit=dev --audit-level=high reports 0 vulnerabilities in its current advisory database. Browser layout checks at 320, 375, 768 and 1280px show no page horizontal overflow. The actual 375px AI screenshot nevertheless has only ~247px content because its stylesheet overrides mobile gutters to 64px. Heavy inference was not rerun: worker evidence records correct IFRS sample output at 186495ms, which does not prove general answer quality.

## Must fix: financial correctness and core lifecycle

### C1 — Reject uncited factual final answers
Engine currently returns factual answers with citationValid=false when the citation list is empty; app displays them. Reproduced with an isolated response stub, not model evidence: 'Doanh thu năm 2025 là 999 triệu VND.' passes normally with valid=false. Reject missing/out-of-context citation for factual answers; allow explicit insufficient-evidence refusal; label streaming as provisional and clear rejected final text. Page membership alone must never be described as proof of factual accuracy.

### C2 — Actually enforce financial scope
retrieveRelevantChunks filters SEPARATE but not CONSOLIDATED. Reproduced with a single IFRS/2025/SEPARATE chunk: asking 'Doanh thu hợp nhất IFRS năm 2025 là bao nhiêu?' returns the company-parent chunk. Enforce both directions of explicit scope, year and accounting standard. Unknown/conflicting scope must not silently satisfy an explicit consolidated query; explain missing matching evidence. Preserve the working coordinate-aware table extraction and correct 2025/2024 sample regressions. Do not hardcode company names, pages or answer figures in runtime code.

### C3 — Exact context budgeting and real deadline
Current chars/2.2 estimator is not the pinned model tokenizer. Count final rendered chat input, template/special tokens and completion reserve using the same tokenizer before inference; estimates may only shortlist content. Preserve complete row/year/unit relationships or reject CONTEXT_BUDGET_EXCEEDED. Add a 270000ms production inference deadline, distinct from manual abort; terminate worker and restore usable model/button state. Keep outer smoke timeout 300000ms. If supported tokenizer access is unavailable or CPU use is impractical, report BLOCKED rather than silently weakening acceptance or changing model/API.

### C4 — Validate and isolate PDF selection before allocating the whole file
The file handler calls file.arrayBuffer() before checking file size or starting the PDF session lifecycle. A very large selected file is fully allocated despite the advertised 50MB limit; concurrent reads occur before the current revision guard. Check size/type first, invalidate the previous session at selection time, and include file-read completion in the revision guard. Clear old answer/evidence immediately. Catch read/parser errors with actionable messages. Ensure cancellation/reset during initial parse/extraction releases PDF resources, ignores obsolete results and does not resurrect old UI. Cover A/B selection, cancel, reset and corrupt/scanned/encrypted/oversized PDFs. Never log or transmit uploaded document content.

## Should fix: visitor flow and interface

### U1 — Make the existing AI reachable and understandable
Root index.html has no link to the experiment. Add a clearly labelled AI entry from the main navigation/overview and a return link from the AI screen. Reuse the existing AI modules; do not create a second engine or migrate frameworks. Keep old hash views, company switching, CSV export and source dialog working. Lazy-load heavy AI/PDF code only on the AI screen; never start a 1.12GB download before an explicit action.

### U2 — Repair mobile layout and task hierarchy
Keep Terrazzo tokens/design; this is a repair, not a redesign. On <=640px set gutters to 16px and stack telemetry/panel headers without narrow technical columns; use 24px on tablet. Primary flow: choose document/sample, inspect source, optionally load model, ask question, view source. Place engineering diagnostics (COOP/COEP, timings, revision) in an expandable details region. Tell the visitor about first-download size, CPU slowness, storage and unsupported-device limitations before loading. Provide a labelled progress element/live status, visible keyboard focus and an obvious cancel/retry. Do not claim all phones support the model.

### U3 — Provide a source-backed sample path and usable evidence navigation
Offer existing curated VNM/DGC records OR user text PDF. Reuse data.mjs companies/metrics/locators to build sample context; label this explicitly as curated excerpts, not a newly parsed full PDF. Preserve IFRS/provisional-source differences and missing values. Never ship whole original reports or relabel DGC as current audited data. Keep model/document state separate, so source preview works before the model is loaded. A citation should open/scroll to the corresponding extracted page/excerpt and highlight its evidence, rather than being an inert badge. A missing source must show an honest limitation.

## Should fix: reproducibility, documentation and deployment

### T1 — Tests must work outside the manager's Windows account
AI tests hardcode C:\Users\hazym\Downloads\2025.pdf and skip core PDF checks when absent. Add a small synthetic text-PDF fixture with at least two distinct year/standard/scope cases, clearly identified as test data; use it for portable fast tests and browser state/race tests. Accept FIRMLENS_TEST_PDF_PATH for optional real-report tests; heavy real smoke must fail clearly if its required real fixture is missing, never report a skipped oracle as PASS. Do not commit the original full report. Cover the old ledger interactions and new AI entry, sample path, citations, mobile and keyboard flows.

### T2 — Align commands, Node support and static publishing
README still tells visitors to use a plain Python server and says there is no PDF/AI implementation. It lacks the Vite workflow. Root Node engines >=20 also accepts versions below Vite's installed requirement (^20.19.0 || >=22.12.0). Align declared/tested versions and document npm ci, dev, build, preview and fast/heavy tests; add dev/preview scripts. README/proposal/UI must distinguish static sample, browser AI experiment, unfinished prediction model and recorded versus independently reproduced evidence. Use the approved target (next-fiscal-year net profit margin), not the older four-quarter operating-margin target.

GitHub Pages is currently documented as main/root while Vite emits dist and bare experiment imports require a build. Add a draft GitHub Actions build/test/deploy workflow for dist and base /firm-lens/, default manual release so this correction does not publish automatically. Prepare source-controlled configuration only; no push, merge, Pages setting changes or deploy before manager acceptance. Test built asset paths/WASM/PDF worker under the repository base URL.

## Implementation order and ownership

1. Core gate: C1-C4, carry forward the prior fix-02 requirements. Worker owns experiments/browser-ai modules, associated tests and evidence. Regression RED -> minimum fix -> GREEN. Do not spend time on another heavy run before fast correctness gates pass.
2. Product gate: U1-U3; worker owns main and experimental HTML/CSS/navigation/data adapters. Preserve existing design. Hallmark only for genuinely new components, not a redesign of existing screens. No speculative accounts/backend/analytics.
3. Delivery gate: T1-T2; worker owns package/config/workflow/tests/README/proposal and verification report. Keep dependency changes justified; reuse runtime/library APIs, no copied second server or inference engine merely to satisfy a test.
4. Independent manager review before publication. Make changes reviewable in these groups. No destructive Git operations; do not revert other workers' edits.

## Acceptance and evidence

- npm test, npm run build, npm run test:browser and npm audit --omit=dev --audit-level=high; report observed results and remaining advisories, never silence them by weakening checks.
- Fast tests: no-source factual answer rejected; refusal allowed; wrong year/standard/scope refused; exact token budget including CJK/long words; timeout and retry; pre-allocation PDF limit; delayed A/B reads and reset; stale evidence removed.
- Browser: all four old views plus linked AI page, source-backed samples and uploaded text PDF; error/cancel/empty states; source navigation; keyboard-only operation; 320/375/768/1280/1920px. Record screenshots and actual viewport behavior, not only absence of scrollbars.
- One real pinned-model smoke after the above gates: supported answer must contain correct facts/year/unit/source; unsupported question must refuse; verify actual tokenizer counts, cancel and bounded timeout. Real inference is mandatory evidence; mocks are only for isolated failure/state tests. Preserve historical worker and manager failures.
- Save docs/verification/repo-remediation-01.md and repo-remediation-01-evidence.json with commands, exit codes, covered cases, actual raw question/context/answer and timing. Never store user document text except bounded public-source QA excerpts in evidence; no GGUF/cache/secrets/full PDFs in Git.
- DONE only if this remediation passes, not if the entire investment-AI project is complete. If a gate fails, report BLOCKED with concrete evidence and a bounded next action. Return four lines: STATUS, FILES_CHANGED, VERIFICATION, PONYTAIL_RISK.

## Remaining research roadmap (not fabricated completion)

The approved original data/training plan remains next: source-backed VAS cohort, temporal split, Ridge/persistence comparison, export and independent evaluation. There are currently no eligible dataset/model artifacts to train from the two illustrative companies. This remediation prepares a reliable document-analysis website; it must not create fake health scores, bankruptcy probabilities, forecast charts or claim validated investment recommendations. After acceptance, dispatch data/training as separate queue tasks with the original sample-size and leakage gates.

Verdict: fix core trust-boundary failures before exposing the experiment; then repair visitor flow, portable checks and deployment handoff. No architecture rewrite is justified by the current repo.
