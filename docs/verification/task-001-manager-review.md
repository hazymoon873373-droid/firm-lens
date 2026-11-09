# Manager review of task-001

Date: 2026-11-08. Scope: uncommitted browser-AI experiment on feature/ai-competition-20261108. No production source was modified by the manager. Existing GitHub Pages site has not been updated with this experiment.

## Verdict

Request changes before accepting task-001 or advancing to data/training tasks. The worker has implemented a real runtime experiment, but successful execution is not proof of a correct financial answer. Task-001 is not the complete AI product and does not train the financial prediction model.

## Verified checks

- Independently reran npm test: 8/8 pass.
- Independently reran npm run build: pass, with a non-blocking large JavaScript chunk warning.
- Independently reran npm run test:browser: pass on Chrome 156.0.8078.80, crossOriginIsolated=false, outboundRequests=0 during tested PDF processing.
- Independently reran npm run test:browser:smoke: FAIL, exit code 1. Cached model SHA-256 matched; cold initialization 32,437 ms, warm initialization 10,720 ms, actual 112-page PDF extraction 1,206 ms. Inference then exceeded the 300,000 ms deadline at tests/browser-ai-smoke.mjs:256. No completed generated answer was available to validate. This is a failed repeat run, not proof that inference can never work.
- Additional focused stub checks below verify error conditions/state contracts only, NOT real LLM performance.

## Findings and required fixes

### F1 P1: Retrieval mixes accounting standards and years and loses the requested table values

Location: experiments/browser-ai/pdf-rag.mjs, chunkPdfPages/retrieveRelevantChunks; smoke question in tests/browser-ai-smoke.mjs.

Reproduced on actual 2025.pdf using PDF.js and current retrieval functions. For the question asking 2025 consolidated IFRS revenue and net profit, top two chunks are p48-c7 (VAS narrative including 9,414 billion VND profit) and p109-c2 (including the 2024 IFRS net profit 8,686,245 million VND). The requested 2025 figures, 54,248,830 and 8,505,216 million VND, are absent from those retrieved chunks.

Required: preserve table labels/column-year/value association; respect explicitly requested year, accounting standard and consolidated scope. Retrieve matching evidence before generation. If sufficient evidence cannot fit or be identified, explicitly refuse to provide the figures; never substitute VAS or prior-year values. Add a regression using actual extracted source structure, not only a synthetic prose summary.

### F2 P1: Citation output and smoke assertions cannot establish answer correctness

Location: experiments/browser-ai/engine.mjs:125-126; app.mjs:261-281; tests/browser-ai-smoke.mjs:282-283.

Current engine sets citations from every retrieved page, independent of answer text. A focused stub returning 'Không đủ thông tin.' still returns citations:[109]. The smoke test checks only answer length >20 and this prepopulated citation list. A refusal or wrong financial answer can therefore pass.

Required: separate retrieved-context pages from citations actually appearing in an answer. Reject unknown page references; do not present retrieved pages as automatically verified evidence for a generated claim. Update the real smoke oracle to validate both requested 2025 IFRS figures, unit and source; store raw question/context/answer/result. Supported questions must not pass on a refusal. Unsupported questions should pass only on appropriate refusal. Financial formatting/unit-equivalent answers may be normalized, but canned substitution is forbidden.

### F3 P1: Changing/resetting PDF can mix sessions and keep obsolete answers

Location: experiments/browser-ai/app.mjs:75-84,178-214,218-232,307-311.

PDF input remains enabled during inference. Uploading another PDF does not clear prior answer, citations or lastInferStats. Extraction has no revision guard: loading A, then B or resetting, can let completion of A restore obsolete content. Errors also leave old answer/evidence visible.

Required: invalidate document session on replacement/reset; clear old answer, evidence and inference metadata immediately. Ignore obsolete extraction/inference results and release PDF resources on errors. Disable replacement while generation is active, or cancel and await it before replacement. Show extraction as a busy action and support cancellation. Test rapid A/B selection, reset during extraction and replacement after an answer.

### F4 P2: Context budget is not enforced

Location: experiments/browser-ai/pdf-rag.mjs:limits/buildGroundedPrompt; engine.mjs:125.

Current nCtx is 1024 while the question has no length limit. A focused check produces a user prompt of 100,149 characters. Character-based chunk limits do not reserve token capacity for the system prompt, question, chat template and completion.

Required: reject empty/oversized questions with an explicit limit; enforce actual tokenizer-based context budgeting including completion reserve before inference. Reduce context safely or return a clear error; never silently cut a table away from its labels/year. Test oversized input, exact boundary and missing evidence. The present unit test about embedded instructions checks prompt wording only; do not claim it proves model resistance to injection.

### F5 P2: Cache/model identity can be falsely reported

Location: experiments/browser-ai/engine.mjs:57-65; app.mjs:14-15.

Focused check: a cached model with a different URL but size 1,117,320,736 bytes is marked as a hit for the requested URL. Also arbitrary ?modelUrl= URLs are accepted while UI/manifest retain hard-coded Qwen identity.

Required: cache identity must match the pinned model URL/revision and available metadata, not size alone. Permit local test-model override only in an explicit loopback smoke mode; public builds must use the pinned model. Clearly separate verified file checksum from merely configured checksum. Test same-size/different-URL cache misses and rejected public overrides.

### F6 P1: Reported real-model success did not reproduce within the smoke deadline

Location: tests/browser-ai-smoke.mjs:256; docs/verification/task-001.md, measured results and PASS claim.

The independent run completed checksum verification, cold/warm loading and actual PDF extraction, then failed with page.waitForFunction: Timeout 300000ms exceeded during inference. The report supplies measurements but not the raw prior answer/evidence. Success is therefore not independently reproduced for the submitted code/runtime.

Required: investigate actual prompt-processing/generation progress, context length and resource use; ensure a user can cancel and receive an explicit timeout instead of waiting indefinitely. Rerun with recorded actual answer, context, timings and environment. Do not merely raise the test timeout, change the model, or relabel the timeout as PASS. If the specified model remains impractical on the tested CPU, return BLOCKED with benchmark evidence and a bounded alternative for manager approval.

## Usability and project assessment

- Worker reports one real CPU response took 212,854 ms. Until quality fixes and repeatable timing are established, treat this as an experimental technical page, not a ready-to-use public investment assistant.
- Preserve single-thread zero-backend operation and current website. Do not add paid services or replace the selected model without manager review.
- After fixing correctness, record cold/warm and time-to-first-token/total inference, real answer and cancellation behavior. Display honest slow-device guidance rather than invented latency claims.
- Do not implement tasks 002-005, push or deploy as part of this correction.

## Correction acceptance

1. Failing-then-passing regression tests for F1-F5; mocks are appropriate only for isolated state/error tests. Reproduce and investigate F6, preserving failures in the report.
2. npm test, npm run build, npm run test:browser pass.
3. Actual-model smoke after retrieval/oracle fixes; raw answer must satisfy the financial question or the correction remains blocked. Include a deliberately unsupported question and a cancellation check.
4. Update docs/verification/task-001.md with observed evidence, truthful result and known limits. Preserve the old worker measurements as historical, not current.
5. Return STATUS / FILES_CHANGED / VERIFICATION / PONYTAIL_RISK. Manager independently reviews again before acceptance.
