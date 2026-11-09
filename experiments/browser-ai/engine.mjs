// Real browser AI runtime wrapper around @wllama/wllama (single-thread WASM, zero backend, no COOP/COEP required).
import { Wllama } from '@wllama/wllama/esm/index.js';
import {
  MODEL_MANIFEST,
  validateQuestionAndBudget,
  parseAndVerifyCitations,
  resolveModelUrl,
  describeMissingEvidence
} from './pdf-rag.mjs';
import { loadGgufTokenizerFromBlobs } from './gguf-tokenizer.mjs';

export function classifyEngineError(err) {
  if (err && typeof err === 'object' && typeof err.code === 'string' && typeof err.message === 'string') {
    return err;
  }
  const name = String(err?.name ?? '');
  const msg = String(err?.message ?? err ?? 'Lỗi không xác định');

  if (/timeout|quá thời gian|quá thời hạn/i.test(msg)) {
    return {
      code: 'INFERENCE_TIMEOUT',
      message: 'Quá thời hạn chờ suy luận trên CPU trình duyệt. Đã dừng worker để giải phóng tài nguyên.'
    };
  }
  if (name === 'AbortError' || name === 'WllamaAbortError' || /abort|hủy/i.test(msg)) {
    return {
      code: 'ABORTED',
      message: 'Đã hủy tác vụ tải hoặc suy luận mô hình theo yêu cầu người dùng.'
    };
  }
  if (
    /memory|oom|out of memory|allocation|webassembly\.memory|storage quota|quota|no space available|filesystemsyncaccesshandle/i.test(
      msg
    )
  ) {
    return {
      code: 'MEMORY_ERROR',
      message:
        'Thiết bị hoặc trình duyệt không đủ bộ nhớ/dung lượng lưu trữ tạm (RAM/OPFS/WASM) để nạp mô hình 1.12 GB. Hãy dùng chế độ duyệt web thông thường và đảm bảo còn trống trên 2 GB.'
    };
  }
  if (/fetch|network|http|failed to load|404|503|cors|networkerror/i.test(msg)) {
    return {
      code: 'NETWORK_ERROR',
      message: `Lỗi mạng khi tải mô hình GGUF: ${msg}`
    };
  }
  if (/webassembly|wasm|unsupported|sharedarraybuffer/i.test(msg)) {
    return {
      code: 'UNSUPPORTED_DEVICE',
      message: `Trình duyệt hoặc thiết bị không hỗ trợ WebAssembly cần thiết: ${msg}`
    };
  }
  return {
    code: 'INFERENCE_ERROR',
    message: `Lỗi mô hình AI cục bộ: ${msg}`
  };
}

export class BrowserAiEngine {
  constructor({ wasmUrl, allowLoopbackOverride = false } = {}) {
    if (!wasmUrl) {
      throw new Error('BrowserAiEngine requires wasmUrl pointing to wllama.wasm');
    }
    this.wasmUrl = wasmUrl;
    this.allowLoopbackOverride = Boolean(allowLoopbackOverride);
    this.wllama = null;
    this.tokenizer = null;
    this.loadedModelUrl = null;
    this.lastLoadStats = null;
    this.verifiedModelSha256 = null;
  }

  _createWllama() {
    if (typeof WebAssembly === 'undefined') {
      throw new Error('WebAssembly is unsupported in this environment');
    }
    return new Wllama({ default: this.wasmUrl }, { suppressNativeLog: true });
  }

  async checkCacheStatus(targetUrl = MODEL_MANIFEST.downloadUrl) {
    const resolved = resolveModelUrl(targetUrl, { allowLoopbackOverride: this.allowLoopbackOverride });
    if (!resolved.ok) {
      return {
        isCached: false,
        cachedCount: 0,
        cachedBytes: 0,
        configuredSha256: MODEL_MANIFEST.sha256,
        sha256Verified: false,
        verifiedSha256: null,
        error: resolved
      };
    }

    try {
      const instance = this.wllama ?? this._createWllama();
      const models = await instance.modelManager.getModels();
      const matched = models.find(
        m => m.url === resolved.url && m.size === MODEL_MANIFEST.sizeBytes
      );
      const cachedSha256 = matched?.files?.[0]?.metadata?.sha256 ?? null;
      const sha256Verified =
        Boolean(cachedSha256 && cachedSha256 === MODEL_MANIFEST.sha256) ||
        Boolean(this.verifiedModelSha256 === MODEL_MANIFEST.sha256);

      return {
        isCached: Boolean(matched),
        cachedCount: models.length,
        cachedBytes: matched?.size ?? 0,
        matchedUrl: matched?.url ?? null,
        configuredSha256: MODEL_MANIFEST.sha256,
        sha256Verified,
        verifiedSha256: sha256Verified ? MODEL_MANIFEST.sha256 : null
      };
    } catch {
      return {
        isCached: false,
        cachedCount: 0,
        cachedBytes: 0,
        configuredSha256: MODEL_MANIFEST.sha256,
        sha256Verified: false,
        verifiedSha256: null
      };
    }
  }

  async _ensureTokenizerFromCache(resolvedUrl) {
    if (this.tokenizer) return this.tokenizer;
    const models = await this.wllama.modelManager.getModels();
    const matched = models.find(
      m => m.url === resolvedUrl && m.size === MODEL_MANIFEST.sizeBytes
    );
    if (!matched || typeof matched.open !== 'function') {
      throw {
        code: 'TOKENIZER_UNAVAILABLE',
        message: 'Không tìm thấy tệp GGUF đã nạp trong bộ nhớ đệm để trích xuất bộ đếm token.'
      };
    }
    const blobs = await matched.open();
    this.tokenizer = await loadGgufTokenizerFromBlobs(blobs);
    await this.tokenizer.assertRuntimeCompatible(this.wllama);
    return this.tokenizer;
  }

  async loadModel({
    modelUrl = MODEL_MANIFEST.downloadUrl,
    onProgress,
    signal,
    verifiedSha256 = null
  } = {}) {
    signal?.throwIfAborted();
    if (typeof WebAssembly === 'undefined') {
      throw classifyEngineError(new Error('WebAssembly unsupported'));
    }
    const resolved = resolveModelUrl(modelUrl, { allowLoopbackOverride: this.allowLoopbackOverride });
    if (!resolved.ok) {
      throw resolved;
    }

    if (verifiedSha256 === MODEL_MANIFEST.sha256) {
      this.verifiedModelSha256 = verifiedSha256;
    }

    const cacheBefore = await this.checkCacheStatus(resolved.url);
    signal?.throwIfAborted();
    if (this.wllama && this.wllama.isModelLoaded()) {
      await this.wllama.exit();
    }
    this.wllama = this._createWllama();
    this.tokenizer = null;

    const t0 = performance.now();
    try {
      await this.wllama.loadModelFromUrl(resolved.url, {
        n_threads: 1,
        n_ctx: MODEL_MANIFEST.limits.nCtx,
        n_batch: 64,
        n_ubatch: 64,
        n_gpu_layers: 0,
        useCache: true,
        signal,
        progressCallback: ({ loaded, total }) => {
          onProgress?.({
            loaded,
            total: total || MODEL_MANIFEST.sizeBytes,
            percent: total ? Math.min(100, Math.round((loaded / total) * 100)) : 0
          });
        }
      });

      signal?.throwIfAborted();
      const tok = await this._ensureTokenizerFromCache(resolved.url);
      signal?.throwIfAborted();
      const loadMs = Math.round(performance.now() - t0);
      const numThreads = this.wllama.getNumThreads();
      const cacheAfter = await this.checkCacheStatus(resolved.url);

      const stats = {
        ok: true,
        modelUrl: resolved.url,
        isLoopbackOverride: resolved.isOverride,
        configuredSha256: MODEL_MANIFEST.sha256,
        sha256Verified: cacheAfter.sha256Verified,
        verifiedSha256: cacheAfter.verifiedSha256,
        cacheMode: cacheBefore.isCached ? 'warm' : 'cold',
        loadMs,
        numThreads,
        tokenizerVocabSize: tok.vocabSize,
        tokenizerPre: tok.preTokenizer,
        crossOriginIsolated: Boolean(globalThis.crossOriginIsolated),
        metadata: this.wllama.getModelMetadata()
      };
      this.loadedModelUrl = resolved.url;
      this.lastLoadStats = stats;
      return stats;
    } catch (err) {
      await this.abortActiveInference();
      this.tokenizer = null;
      throw err;
    }
  }

  async abortActiveInference() {
    const runtime = this.wllama;
    this.wllama = null;
    this.loadedModelUrl = null;
    try { await runtime?.exit(); } catch {}
  }

  async ask({
    question,
    chunks = [],
    allChunks = null,
    docName = 'Báo cáo PDF',
    maxTokens = 96,
    temperature = 0.0,
    deadlineMs = MODEL_MANIFEST.limits.inferenceDeadlineMs,
    onToken,
    onPromptProgress,
    signal
  } = {}) {
    if (!this.wllama || !this.wllama.isModelLoaded()) {
      throw {
        code: 'MODEL_NOT_LOADED',
        message: 'Mô hình AI chưa được tải. Vui lòng bấm "Nạp mô hình AI" trước.'
      };
    }

    const t0 = performance.now();
    const budgetCheck = validateQuestionAndBudget({
      question,
      chunks,
      docName,
      tokenizer: this.tokenizer,
      nCtx: MODEL_MANIFEST.limits.nCtx,
      maxPromptTokens: MODEL_MANIFEST.limits.maxPromptTokens,
      completionReserveTokens: Math.max(maxTokens, MODEL_MANIFEST.limits.completionReserveTokens)
    });
    if (!budgetCheck.ok) {
      throw { code: budgetCheck.code, message: budgetCheck.message };
    }

    const {
      fittedChunks,
      messages,
      promptTokens,
      estimatedPromptTokens,
      tokenCountMethod,
      totalBudgetTokens
    } = budgetCheck;
    const retrievedPages = [...new Set(fittedChunks.map(c => c.pageNumber))];

    if (fittedChunks.length === 0) {
      const refusalText = describeMissingEvidence(question, Array.isArray(allChunks) ? allChunks : chunks);
      return {
        answer: refusalText,
        rawAnswer: refusalText,
        retrievedPages: [],
        citations: [],
        invalidCitations: [],
        isRefusal: true,
        citationValid: true,
        fittedChunks: [],
        messages: [],
        promptTokens,
        estimatedPromptTokens,
        llamaCppPromptTokens: null,
        tokenCountMethod,
        totalBudgetTokens,
        prefillMs: 0,
        firstTokenMs: 0,
        inferMs: Math.round(performance.now() - t0),
        tokensGenerated: 0
      };
    }

    let firstTokenMs = null;
    let prefillMs = null;
    let llamaCppPromptTokens = null;
    let rawAnswer = '';
    let tokensGenerated = 0;
    let abortedByUser = false;
    let timedOut = false;
    const runtime = this.wllama;
    let rejectInterruption;
    const interrupted = new Promise((_, reject) => { rejectInterruption = reject; });

    const internalAbort = new AbortController();
    const onUserAbort = () => {
      abortedByUser = true;
      internalAbort.abort();
      this.abortActiveInference().catch(() => {});
      rejectInterruption(Object.assign(new Error('Operation aborted'), { name: 'AbortError' }));
    };

    if (signal) {
      if (signal.aborted) {
        onUserAbort();
      } else {
        signal.addEventListener('abort', onUserAbort, { once: true });
      }
    }

    const elapsedBeforeStream = performance.now() - t0;
    const remainingMs = Math.max(1, Math.round(deadlineMs - elapsedBeforeStream));
    const deadlineTimer = setTimeout(() => {
      timedOut = true;
      internalAbort.abort();
      this.abortActiveInference().catch(() => {});
      rejectInterruption({ code: 'INFERENCE_TIMEOUT' });
    }, remainingMs);

    try {
      const inference = (async () => {
        if (signal?.aborted) throw Object.assign(new Error('Operation aborted'), { name: 'AbortError' });
        const stream = await runtime.createChatCompletion({
          messages,
          stream: true,
          return_progress: true,
          max_tokens: maxTokens,
          temperature,
          abortSignal: internalAbort.signal
        });

        for await (const chunk of stream) {
          if (timedOut) {
            throw {
              code: 'INFERENCE_TIMEOUT',
              message: `Quá thời hạn suy luận ${Math.round(deadlineMs / 1000)} giây trên CPU trình duyệt. Đã dừng worker để giải phóng tài nguyên.`
            };
          }
          if (abortedByUser || signal?.aborted) {
            const abortErr = new Error('Operation aborted');
            abortErr.name = 'AbortError';
            throw abortErr;
          }
          if (chunk?.prompt_progress) {
            prefillMs = Math.round(performance.now() - t0);
            if (Number.isInteger(chunk.prompt_progress.total)) {
              llamaCppPromptTokens = chunk.prompt_progress.total;
              if (llamaCppPromptTokens !== promptTokens) {
                this.abortActiveInference().catch(() => {});
                throw { code: 'TOKENIZER_MISMATCH', message: 'Số token do mô hình đếm khác với bộ đếm GGUF. Đã dừng suy luận; không thể bảo đảm ngữ cảnh.' };
              }
            }
            onPromptProgress?.({
              ...chunk.prompt_progress,
              elapsedMs: prefillMs
            });
          }
          const piece = chunk?.choices?.[0]?.delta?.content ?? '';
          if (piece) {
            if (firstTokenMs === null) {
              firstTokenMs = Math.round(performance.now() - t0);
              if (prefillMs === null) prefillMs = firstTokenMs;
            }
            rawAnswer += piece;
            tokensGenerated += 1;
            onToken?.({ piece, text: rawAnswer, tokensGenerated, firstTokenMs, provisional: true });
          }
        }
      })();
      await Promise.race([inference, interrupted]);
    } catch (err) {
      if (timedOut || err?.code === 'INFERENCE_TIMEOUT') {
        throw {
          code: 'INFERENCE_TIMEOUT',
          message: `Quá thời hạn suy luận ${Math.round(deadlineMs / 1000)} giây trên CPU trình duyệt. Đã dừng worker để giải phóng tài nguyên.`
        };
      }
      if (abortedByUser || signal?.aborted) {
        throw classifyEngineError(Object.assign(new Error('Operation aborted'), { name: 'AbortError' }));
      }
      throw classifyEngineError(err);
    } finally {
      clearTimeout(deadlineTimer);
      if (signal) {
        signal.removeEventListener('abort', onUserAbort);
      }
    }

    const inferMs = Math.round(performance.now() - t0);
    if (firstTokenMs === null) firstTokenMs = inferMs;
    if (prefillMs === null) prefillMs = firstTokenMs;

    const trimmedAnswer = rawAnswer.trim();
    const citationCheck = parseAndVerifyCitations(trimmedAnswer, fittedChunks);

    if (citationCheck.invalidCitations.length > 0) {
      throw {
        code: 'INVALID_CITATION',
        message: `Mô hình trích dẫn trang không nằm trong ngữ cảnh đã truy xuất ([Trang PDF ${citationCheck.invalidCitations.join(', ')}]). Đã từ chối hiển thị để bảo toàn độ tin cậy.`
      };
    }

    if (!citationCheck.valid) {
      throw {
        code: 'MISSING_CITATION',
        message:
          'Mô hình trả về nội dung chưa có nhãn nguồn hợp lệ ([Trang PDF ...]) thuộc ngữ cảnh đã truy xuất. Đã từ chối hiển thị câu trả lời chưa kiểm chứng.'
      };
    }

    return {
      answer: trimmedAnswer,
      rawAnswer: trimmedAnswer,
      retrievedPages,
      citations: citationCheck.citations,
      invalidCitations: citationCheck.invalidCitations,
      isRefusal: citationCheck.isRefusal,
      citationValid: citationCheck.valid,
      fittedChunks,
      messages,
      promptTokens,
      estimatedPromptTokens,
      llamaCppPromptTokens,
      tokenCountMethod,
      totalBudgetTokens,
      prefillMs,
      firstTokenMs,
      inferMs,
      tokensGenerated
    };
  }

  async clearCache() {
    if (this.wllama && this.wllama.isModelLoaded()) {
      await this.wllama.exit();
    }
    const instance = this.wllama ?? this._createWllama();
    await instance.cacheManager.clear();
    this.wllama = null;
    this.tokenizer = null;
    this.loadedModelUrl = null;
    this.lastLoadStats = null;
    this.verifiedModelSha256 = null;
    return { cleared: true };
  }
}
