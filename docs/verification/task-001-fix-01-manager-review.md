# Manager review of task-001-fix-01

Date: 2026-11-09. Reviewed current working tree on feature/ai-competition-20261108. Verdict: request a bounded correction, not a restart of task-001. No production application code changed by the manager; no push/deployment.

## Evidence and progress

- Independently ran npm test: 11/11 pass, including the real-PDF IFRS 2025/2024 retrieval regression.
- Independently ran npm run build: pass; large bundle warning remains non-blocking for the experiment.
- Independently ran npm run test:browser: pass, Chrome 156.0.8078.80, crossOriginIsolated=false, outboundRequests=0 for the tested flow.
- Read worker evidence at docs/verification/task-001-fix-01-evidence.json. It contains correct IFRS 2025 revenue 54,248,830 and net profit 8,505,216 million VND, page 109, actual answer, context and reported 186,495 ms total inference. This is worker-supplied evidence; the manager has not independently rerun the heavy corrected inference in this review.
- Source separation, table extraction for the target example, PDF reset protection, strict cache URL comparison, and actual answer-citation parsing improved. These improvements should be preserved.
- No financial prediction model has been trained; that remains task-003, intentionally outside this fix.

## Remaining acceptance gaps

### R1 P1: Uncited factual answers are still accepted and displayed

experiments/browser-ai/engine.mjs:328-344 rejects invalid page numbers, but does not reject citationCheck.valid=false when no citation is present. experiments/browser-ai/app.mjs:389-395 displays the answer without checking that flag.

Focused engine stub check (not real-model evidence): response 'Doanh thu năm 2025 là 999 triệu VND.' against a retrieved 2025 revenue row returned normally with citationValid:false and citations:[].

Required: engine must fail closed for non-refusal answers without a valid source; app clears the final answer and badges on rejection. Preserve legitimate insufficient-evidence refusal without a citation. Clearly mark streaming as provisional until validation. Tests: factual answer with no source, unknown page, valid source, empty answer and legitimate refusal. This validates source presence, not universal factual correctness.

### R2 P2: F4 still uses a character estimate instead of the model tokenizer

experiments/browser-ai/pdf-rag.mjs:594-658 estimates tokens with chars/2.2 and words*1.45; engine.mjs:222-228 uses it as the final gate. A focused check accepts a 1,200-CJK-character evidence chunk despite nCtx=1024. An estimate cannot guarantee the actual chat input fits; the evidence JSON field promptTokens is an estimate, not a measured model-token count.

Required: measure the exact final formatted chat input with the tokenizer for the same pinned model, including template/special tokens and output reserve. Estimation may shortlist chunks but must not be the final safety check. Compact complete financial rows safely or return CONTEXT_BUDGET_EXCEEDED. If supported runtime tokenizer access is unavailable, report that blocker instead of claiming F4 complete. Tests: Vietnamese, numeric tables, CJK, long single words, actual boundary and completion reserve. Distinguish measured and estimated token metadata.

### R3 P2: No production inference deadline

experiments/browser-ai/app.mjs:350-383 creates an AbortController but no timer; engine has timeout error classification but no deadline trigger. The 300,000 ms limit only exists in the external smoke test. If inference hangs, the real website can wait indefinitely unless the visitor manually cancels.

Required: implement a 270,000 ms wall-clock deadline covering validation/prefill/generation, distinct from manual abort; terminate pending worker work, return INFERENCE_TIMEOUT, clear timers/listeners in finally, recover buttons/model state and permit reload/retry. Keep the outer smoke limit at 300,000 ms; do not increase it to conceal failure. Tests may inject a short deadline for a hanging operation; real heavy inference must remain real, not mocked.

## Next correction

Only R1-R3, related tests and evidence documentation. Preserve F1/F3/F5 fixes, current design, pinned model and zero-cost/single-thread scope. No backend, paid API, model switch, tasks002-005 or public release.

Acceptance: npm test; npm run build; npm run test:browser; then one actual-model smoke with actual tokenizer count, correct answer/unit/year/source, unchanged outer deadline, cancellation and raw evidence. Return BLOCKED if these cannot be met. Update documentation to separate prior measurements from current ones, preserving failures.
