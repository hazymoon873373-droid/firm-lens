// Exact Qwen2 byte-level BPE + ChatML tokenizer parsed directly from the pinned GGUF v2/v3 model header.
// Zero extra dependencies, zero network calls — reads the same cached GGUF bytes loaded by @wllama/wllama.

const REQUIRED_TOKENIZER_KEYS = [
  'tokenizer.ggml.tokens',
  'tokenizer.ggml.token_type',
  'tokenizer.ggml.merges'
];

function hasRequiredTokenizerKeys(meta) {
  return REQUIRED_TOKENIZER_KEYS.every(k => Array.isArray(meta[k]) && meta[k].length > 0);
}

export function parseGgufTokenizerFromBuffer(bufferLike) {
  const uint8 =
    bufferLike instanceof Uint8Array
      ? bufferLike
      : bufferLike instanceof ArrayBuffer
        ? new Uint8Array(bufferLike)
        : new Uint8Array(bufferLike.buffer, bufferLike.byteOffset, bufferLike.byteLength);

  if (uint8.byteLength < 24) {
    throw new Error('Invalid GGUF buffer: shorter than 24-byte header');
  }

  const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  const dec = new TextDecoder();
  let off = 0;

  const magic = dec.decode(uint8.subarray(0, 4));
  if (magic !== 'GGUF') {
    throw new Error(`Invalid GGUF magic: expected "GGUF", got "${magic}"`);
  }
  off += 4;

  const version = view.getUint32(off, true);
  off += 4;
  if (version < 2) {
    throw new Error(`Unsupported GGUF version: ${version}`);
  }

  off += 8; // tensor_count (uint64)
  const kvCount = Number(view.getBigUint64(off, true));
  off += 8;

  const ensureBytes = n => {
    if (off + n > uint8.byteLength) {
      throw new RangeError('GGUF header slice ended before reading complete metadata');
    }
  };

  const readStr = () => {
    ensureBytes(8);
    const len = Number(view.getBigUint64(off, true));
    off += 8;
    ensureBytes(len);
    const s = dec.decode(uint8.subarray(off, off + len));
    off += len;
    return s;
  };

  const readVal = typeId => {
    switch (typeId) {
      case 0:
        ensureBytes(1);
        return view.getUint8(off++);
      case 1:
        ensureBytes(1);
        return view.getInt8(off++);
      case 2: {
        ensureBytes(2);
        const v = view.getUint16(off, true);
        off += 2;
        return v;
      }
      case 3: {
        ensureBytes(2);
        const v = view.getInt16(off, true);
        off += 2;
        return v;
      }
      case 4: {
        ensureBytes(4);
        const v = view.getUint32(off, true);
        off += 4;
        return v;
      }
      case 5: {
        ensureBytes(4);
        const v = view.getInt32(off, true);
        off += 4;
        return v;
      }
      case 6: {
        ensureBytes(4);
        const v = view.getFloat32(off, true);
        off += 4;
        return v;
      }
      case 7:
        ensureBytes(1);
        return view.getUint8(off++) !== 0;
      case 8:
        return readStr();
      case 9: {
        ensureBytes(12);
        const elemType = view.getUint32(off, true);
        off += 4;
        const len = Number(view.getBigUint64(off, true));
        off += 8;
        const arr = new Array(len);
        for (let i = 0; i < len; i++) {
          arr[i] = readVal(elemType);
        }
        return arr;
      }
      case 10: {
        ensureBytes(8);
        const v = Number(view.getBigUint64(off, true));
        off += 8;
        return v;
      }
      case 11: {
        ensureBytes(8);
        const v = Number(view.getBigInt64(off, true));
        off += 8;
        return v;
      }
      case 12: {
        ensureBytes(8);
        const v = view.getFloat64(off, true);
        off += 8;
        return v;
      }
      default:
        throw new Error(`Unknown GGUF metadata value type: ${typeId}`);
    }
  };

  const meta = {};
  for (let i = 0; i < kvCount; i++) {
    try {
      const key = readStr();
      ensureBytes(4);
      const valType = view.getUint32(off, true);
      off += 4;
      meta[key] = readVal(valType);
    } catch (err) {
      if (err instanceof RangeError && hasRequiredTokenizerKeys(meta)) {
        return meta;
      }
      throw err;
    }
  }
  return meta;
}

function buildByteToUnicode() {
  const bs = [];
  for (let b = 33; b <= 126; b++) bs.push(b);
  for (let b = 161; b <= 172; b++) bs.push(b);
  for (let b = 174; b <= 255; b++) bs.push(b);
  const cs = [...bs];
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n += 1;
    }
  }
  const map = new Array(256);
  for (let i = 0; i < bs.length; i++) {
    map[bs[i]] = String.fromCodePoint(cs[i]);
  }
  return map;
}

export function createQwen2GgufTokenizer(meta) {
  if (meta?.['tokenizer.ggml.pre'] !== 'qwen2' || meta?.['tokenizer.ggml.add_bos_token'] === true || meta?.['tokenizer.ggml.add_eos_token'] === true) {
    throw new Error('Unsupported GGUF tokenizer configuration: expected Qwen2 without automatic BOS/EOS');
  }
  const tokens = meta?.['tokenizer.ggml.tokens'];
  const tokenTypes = meta?.['tokenizer.ggml.token_type'] ?? [];
  const merges = meta?.['tokenizer.ggml.merges'];

  if (!Array.isArray(tokens) || tokens.length === 0 || !Array.isArray(merges)) {
    throw new Error('Missing Qwen2 GGUF tokenizer vocabulary or BPE merges');
  }

  const vocab = new Map();
  const specialTokens = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    vocab.set(tok, i);
    if (tokenTypes[i] === 3 || tokenTypes[i] === 4) {
      specialTokens.push(tok);
    }
  }
  specialTokens.sort((a, b) => b.length - a.length);
  const specialRegex =
    specialTokens.length > 0
      ? new RegExp(`(${specialTokens.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
      : null;

  const bpeRanks = new Map();
  for (let i = 0; i < merges.length; i++) {
    bpeRanks.set(merges[i], i);
  }

  const byteToUni = buildByteToUnicode();
  const textEncoder = new TextEncoder();
  // Official Qwen2 pre-tokenizer regex matching llama.cpp LLM_KV_TOKENIZER_PRE = "qwen2"
  const preRegex =
    /'(?:[sdmt]|ll|ve|re)|'[SDMT]|'(?:LL|VE|RE)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;
  const bpeCache = new Map();

  function bpe(tokenStr) {
    const cached = bpeCache.get(tokenStr);
    if (cached) return cached;
    let word = Array.from(tokenStr);
    if (word.length <= 1) return word;

    while (word.length > 1) {
      let minRank = Infinity;
      let bestPair = null;
      for (let i = 0; i < word.length - 1; i++) {
        const rank = bpeRanks.get(`${word[i]} ${word[i + 1]}`);
        if (rank !== undefined && rank < minRank) {
          minRank = rank;
          bestPair = [word[i], word[i + 1]];
        }
      }
      if (!bestPair) break;
      const [first, second] = bestPair;
      const next = [];
      let i = 0;
      while (i < word.length) {
        if (i < word.length - 1 && word[i] === first && word[i + 1] === second) {
          next.push(first + second);
          i += 2;
        } else {
          next.push(word[i]);
          i += 1;
        }
      }
      word = next;
    }

    if (bpeCache.size >= 4096) bpeCache.clear();
    bpeCache.set(tokenStr, word);
    return word;
  }

  function encodeText(text) {
    const ids = [];
    const raw = String(text ?? '');
    if (!raw) return ids;
    const parts = specialRegex ? raw.split(specialRegex) : [raw];
    for (const part of parts) {
      if (!part) continue;
      if (specialTokens.includes(part)) {
        ids.push(vocab.get(part));
        continue;
      }
      const matches = part.match(preRegex) ?? [];
      for (const piece of matches) {
        const bytes = textEncoder.encode(piece);
        let mapped = '';
        for (let i = 0; i < bytes.length; i++) {
          mapped += byteToUni[bytes[i]];
        }
        const merged = bpe(mapped);
        for (const m of merged) {
          const id = vocab.get(m);
          if (id !== undefined) {
            ids.push(id);
          } else {
            throw new Error('Unsupported GGUF tokenizer: missing byte vocabulary entry');
          }
        }
      }
    }
    return ids;
  }

  // Matches Qwen2.5-Instruct ChatML template used by @wllama/wllama createChatCompletion
  function formatChatMessages(messages = [], { addGenerationPrompt = true } = {}) {
    if (messages.some(m => !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.tool_calls)) {
      throw new Error('Unsupported chat message: only plain text messages without tools are supported');
    }
    let out = '';
    if (!messages.length || messages[0].role !== 'system') {
      out += '<|im_start|>system\nYou are Qwen, created by Alibaba Cloud. You are a helpful assistant.<|im_end|>\n';
    } else {
      out += `<|im_start|>system\n${messages[0].content}<|im_end|>\n`;
    }
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (i === 0 && m.role === 'system') continue;
      out += `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`;
    }
    if (addGenerationPrompt) {
      out += '<|im_start|>assistant\n';
    }
    return out;
  }

  function countChatTokens(messages) {
    return encodeText(formatChatMessages(messages, { addGenerationPrompt: true })).length;
  }

  return {
    vocabSize: tokens.length,
    preTokenizer: meta['tokenizer.ggml.pre'] ?? 'qwen2',
    encodeText,
    formatChatMessages,
    countChatTokens,
    async assertRuntimeCompatible(runtime) {
      const template = meta['tokenizer.chat_template'];
      if (!template || template !== runtime.getChatTemplate() || runtime.mustAddBosToken() || runtime.mustAddEosToken()) {
        throw { code: 'TOKENIZER_MISMATCH', message: 'Bộ đếm GGUF không khớp mẫu hội thoại hoặc token đặc biệt của mô hình đang chạy.' };
      }
      const bytes = await crypto.subtle.digest('SHA-256', textEncoder.encode(template));
      const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
      // Only the no-tools ChatML branch of this pinned Qwen2.5 template is implemented above.
      if (hash !== 'd5495a1e5db0611132a97e46a65dbb64a642a499421228b9c8b93229097fa9a4') {
        throw { code: 'TOKENIZER_MISMATCH', message: 'Mẫu hội thoại GGUF chưa được hỗ trợ; không thể bảo đảm ngân sách token.' };
      }
    }
  };
}

export async function loadGgufTokenizerFromBlobs(blobs, { maxHeaderBytes = 10 * 1024 * 1024 } = {}) {
  if (!Array.isArray(blobs) || blobs.length === 0) {
    throw new Error('No GGUF model blobs available to read tokenizer header');
  }
  const slices = [];
  let collected = 0;
  for (const blob of blobs) {
    if (collected >= maxHeaderBytes) break;
    const take = Math.min(blob.size, maxHeaderBytes - collected);
    if (take <= 0) continue;
    const ab = await blob.slice(0, take).arrayBuffer();
    const u8 = new Uint8Array(ab);
    slices.push(u8);
    collected += u8.byteLength;
  }
  const combined = new Uint8Array(collected);
  let pos = 0;
  for (const s of slices) {
    combined.set(s, pos);
    pos += s.byteLength;
  }
  const meta = parseGgufTokenizerFromBuffer(combined);
  return createQwen2GgufTokenizer(meta);
}
