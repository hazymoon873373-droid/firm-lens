// Deterministic in-memory synthetic PDF and GGUF tokenizer fixtures for portable offline tests.
// Clearly labelled as synthetic test data — never contains or impersonates real company filings.

function buildToUnicodeCmap(chars) {
  const uniqueCodePoints = [...new Set(chars.map(ch => ch.codePointAt(0)))].sort((a, b) => a - b);
  const validSlots = [];
  for (let c = 33; c <= 126; c++) validSlots.push(c);
  for (let c = 161; c <= 254; c++) validSlots.push(c);
  if (uniqueCodePoints.length > validSlots.length) {
    throw new Error(`Synthetic PDF supports up to ${validSlots.length} unique characters, got ${uniqueCodePoints.length}`);
  }
  const lines = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<21> <FE>',
    'endcodespacerange'
  ];

  for (let i = 0; i < uniqueCodePoints.length; i += 100) {
    const slice = uniqueCodePoints.slice(i, i + 100);
    lines.push(`${slice.length} beginbfchar`);
    for (let j = 0; j < slice.length; j++) {
      const slot = validSlots[i + j];
      const cidHex = slot.toString(16).padStart(2, '0').toUpperCase();
      const uniHex = slice[j].toString(16).padStart(4, '0').toUpperCase();
      lines.push(`<${cidHex}> <${uniHex}>`);
    }
    lines.push('endbfchar');
  }

  lines.push('endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end');
  const cmapText = lines.join('\n');
  const cidByCodePoint = new Map();
  uniqueCodePoints.forEach((cp, idx) => {
    cidByCodePoint.set(cp, validSlots[idx]);
  });
  return { cmapText, cidByCodePoint };
}

function encodePdfHexText(str, cidByCodePoint) {
  let hex = '';
  for (const ch of String(str)) {
    const cid = cidByCodePoint.get(ch.codePointAt(0)) ?? 1;
    hex += cid.toString(16).padStart(2, '0').toUpperCase();
  }
  return `<${hex}>`;
}

export function createSyntheticPdfBuffer({ pages } = {}) {
  const defaultPages = [
    {
      width: 595,
      height: 842,
      cells: [
        { x: 50, y: 780, text: 'DỮ LIỆU KIỂM THỬ TỔNG HỢP (SYNTHETIC TEST FIXTURE)' },
        { x: 50, y: 756, text: 'Báo cáo kết quả hoạt động kinh doanh hợp nhất theo chuẩn mực IFRS' },
        { x: 50, y: 734, text: 'I. Báo cáo lãi lỗ cho năm tài chính kết thúc ngày 31 tháng 12 năm 2025' },
        { x: 50, y: 706, text: 'Chỉ tiêu' },
        { x: 320, y: 706, text: '2025' },
        { x: 430, y: 706, text: '2024' },
        { x: 320, y: 686, text: 'Triệu VND' },
        { x: 430, y: 686, text: 'Triệu VND' },
        { x: 50, y: 660, text: 'Doanh thu' },
        { x: 320, y: 660, text: '12.345.000' },
        { x: 430, y: 660, text: '11.100.000' },
        { x: 50, y: 636, text: 'Lợi nhuận thuần' },
        { x: 320, y: 636, text: '2.345.000' },
        { x: 430, y: 636, text: '2.100.000' }
      ]
    },
    {
      width: 595,
      height: 842,
      cells: [
        { x: 50, y: 780, text: 'DỮ LIỆU KIỂM THỬ TỔNG HỢP (SYNTHETIC TEST FIXTURE)' },
        { x: 50, y: 756, text: 'Báo cáo kết quả hoạt động kinh doanh riêng (Công ty mẹ) theo chuẩn mực kế toán Việt Nam VAS' },
        { x: 50, y: 734, text: 'Cho năm tài chính kết thúc ngày 31 tháng 12 năm 2025' },
        { x: 50, y: 706, text: 'Chỉ tiêu' },
        { x: 320, y: 706, text: '2025' },
        { x: 430, y: 706, text: '2024' },
        { x: 320, y: 686, text: 'Triệu VND' },
        { x: 430, y: 686, text: 'Triệu VND' },
        { x: 50, y: 660, text: 'Doanh thu' },
        { x: 320, y: 660, text: '6.789.000' },
        { x: 430, y: 660, text: '6.200.000' },
        { x: 50, y: 636, text: 'Lợi nhuận thuần' },
        { x: 320, y: 636, text: '1.111.000' },
        { x: 430, y: 636, text: '1.050.000' }
      ]
    }
  ];

  const pageSpecs = pages ?? defaultPages;
  const allChars = [];
  for (const p of pageSpecs) {
    for (const c of p.cells ?? []) {
      for (const ch of String(c.text ?? '')) allChars.push(ch);
    }
  }
  if (allChars.length === 0) allChars.push(' ');

  const { cmapText, cidByCodePoint } = buildToUnicodeCmap(allChars);
  const enc = new TextEncoder();

  // Object IDs:
  // 1: Catalog, 2: Pages, 3: Type1 Font with ToUnicode, 4: ToUnicode CMap
  // Then for each page i: pageObjId = 5 + i*2, contentObjId = 6 + i*2
  const objects = [];
  const pageIds = pageSpecs.map((_, i) => 5 + i * 2);

  objects.push({ id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' });
  objects.push({
    id: 2,
    body: `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageSpecs.length} >>`
  });
  objects.push({
    id: 3,
    body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /ToUnicode 4 0 R >>'
  });
  const cmapBytes = enc.encode(cmapText);
  objects.push({
    id: 4,
    body: `<< /Length ${cmapBytes.byteLength} >>\nstream\n${cmapText}\nendstream`
  });

  pageSpecs.forEach((p, idx) => {
    const pageId = 5 + idx * 2;
    const contentId = 6 + idx * 2;
    const width = p.width ?? 595;
    const height = p.height ?? 842;
    const ops = ['BT', '/F1 11 Tf'];
    for (const cell of p.cells ?? []) {
      ops.push(`1 0 0 1 ${cell.x} ${cell.y} Tm`);
      ops.push(`${encodePdfHexText(cell.text, cidByCodePoint)} Tj`);
    }
    ops.push('ET');
    const streamStr = ops.join('\n');
    const streamLen = enc.encode(streamStr).byteLength;

    objects.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
    });
    objects.push({
      id: contentId,
      body: `<< /Length ${streamLen} >>\nstream\n${streamStr}\nendstream`
    });
  });

  objects.sort((a, b) => a.id - b.id);
  const chunks = [];
  let byteOffset = 0;
  const pushStr = s => {
    const b = enc.encode(s);
    chunks.push(b);
    byteOffset += b.byteLength;
  };

  pushStr('%PDF-1.4\n');
  const offsets = [0];
  for (const obj of objects) {
    offsets[obj.id] = byteOffset;
    pushStr(`${obj.id} 0 obj\n${obj.body}\nendobj\n`);
  }

  const xrefStart = byteOffset;
  const maxObj = objects.length + 1;
  pushStr(`xref\n0 ${maxObj}\n0000000000 65535 f \n`);
  for (let id = 1; id < maxObj; id++) {
    pushStr(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${maxObj} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const out = new Uint8Array(byteOffset);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.byteLength;
  }
  return out;
}

function buildByteToUnicodeList() {
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

// Builds a valid GGUF v3 header buffer containing a Qwen2 byte-level BPE vocabulary (all 256 base bytes + merges + ChatML special tokens)
// so unit tests run offline in <5ms without needing the 1.12 GB .gguf file on disk.
export function createSyntheticQwen2GgufBuffer() {
  const byteToUni = buildByteToUnicodeList();
  const tokens = [...byteToUni];
  const tokenTypes = new Array(256).fill(1); // NORMAL
  const enc = new TextEncoder();

  // Add realistic multi-byte BPE merges for common Vietnamese/ASCII prompt words so synthetic vocab
  // compresses normal Vietnamese prompts similarly to Qwen2 while leaving CJK / arbitrary unspaced strings unmerged
  const merges = [];
  const mergeSet = new Set();
  const tokenSet = new Set(tokens);
  const commonPieces = [
    'Bạn', ' là', ' trợ', ' lý', ' phân', ' tích', ' báo', ' cáo', ' của', ' FirmLens',
    ' Trả', ' lời', ' ngắn', ' gọn', ' bằng', ' tiếng', ' Việt', ' chỉ', ' dựa', ' trên',
    ' đoạn', ' trích', ' được', ' cung', ' cấp', ' chuẩn', ' mực', ' kế', ' toán', ' đơn', ' vị',
    ' tính', ' nhãn', ' nguồn', ' Trang', ' PDF', ' không', ' đáng', ' tin', ' cậy', ' thông',
    ' Doanh', ' thu', ' năm', ' 2025', ' 2024', ' Triệu', ' VND', ' Lợi', ' nhuận', ' thuần',
    ' Tài', ' liệu', ' Câu', ' hỏi', ' tất', ' cả', ' tiêu', ' số', 'system', 'user', 'assistant'
  ];
  for (const word of commonPieces) {
    const bytes = enc.encode(word);
    let symbols = Array.from(bytes, b => byteToUni[b]);
    while (symbols.length > 1) {
      const a = symbols[0];
      const b = symbols[1];
      const pair = `${a} ${b}`;
      const joined = a + b;
      if (!mergeSet.has(pair)) {
        mergeSet.add(pair);
        merges.push(pair);
      }
      if (!tokenSet.has(joined)) {
        tokenSet.add(joined);
        tokens.push(joined);
        tokenTypes.push(1);
      }
      symbols = [joined, ...symbols.slice(2)];
    }
  }

  // Add ChatML control tokens (type 3 = CONTROL)
  for (const special of ['<|endoftext|>', '<|im_start|>', '<|im_end|>']) {
    tokens.push(special);
    tokenTypes.push(3);
  }

  const parts = [];
  const pushBytes = b => parts.push(b);
  const pushU32 = v => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, true);
    parts.push(b);
  };
  const pushI32 = v => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, v, true);
    parts.push(b);
  };
  const pushU64 = v => {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigUint64(0, BigInt(v), true);
    parts.push(b);
  };
  const pushStr = s => {
    const b = enc.encode(s);
    pushU64(b.byteLength);
    pushBytes(b);
  };

  pushBytes(enc.encode('GGUF'));
  pushU32(3); // version 3
  pushU64(0); // tensor_count = 0
  pushU64(4); // kv_count = 4

  // 1. tokenizer.ggml.pre = 'qwen2' (type 8 = STRING)
  pushStr('tokenizer.ggml.pre');
  pushU32(8);
  pushStr('qwen2');

  // 2. tokenizer.ggml.tokens (type 9 = ARRAY of type 8 = STRING)
  pushStr('tokenizer.ggml.tokens');
  pushU32(9);
  pushU32(8);
  pushU64(tokens.length);
  for (const t of tokens) pushStr(t);

  // 3. tokenizer.ggml.token_type (type 9 = ARRAY of type 5 = INT32)
  pushStr('tokenizer.ggml.token_type');
  pushU32(9);
  pushU32(5);
  pushU64(tokenTypes.length);
  for (const tt of tokenTypes) pushI32(tt);

  // 4. tokenizer.ggml.merges (type 9 = ARRAY of type 8 = STRING)
  pushStr('tokenizer.ggml.merges');
  pushU32(9);
  pushU32(8);
  pushU64(merges.length);
  for (const m of merges) pushStr(m);

  const totalLen = parts.reduce((s, p) => s + p.byteLength, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}
