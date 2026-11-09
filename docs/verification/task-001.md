# Báo cáo Nghiệm thu Kỹ thuật — `task-001` & `task-001-fix-01` (Technical Feasibility Gate)

- **Ngày kiểm chứng cập nhật:** `2026-11-08` (`2026-11-08T17:43:52.145Z`)
- **Nhánh Git:** `feature/ai-competition-20261108`
- **Phạm vi:** Thực thi độc lập `task-001` và bản sửa lỗi nghiệm thu `firm-lens-task-001-fix-01` theo kế hoạch `docs/superpowers/plans/2026-11-08-real-ai.md` và biên bản rà soát `docs/verification/task-001-manager-review.md` (không triển khai `task-002` đến `task-005`, giữ nguyên trang sản phẩm chính `index.html`).
- **Tệp bằng chứng JSON nguyên bản:** `docs/verification/task-001-fix-01-evidence.json`

---

## 1. Cấu hình Ghim Phiên bản (Pinned Manifest)

| Thành phần | Giá trị ghim cố định |
| :--- | :--- |
| **HuggingFace Repo** | `Qwen/Qwen2.5-1.5B-Instruct-GGUF` |
| **Tên tệp GGUF** | `qwen2.5-1.5b-instruct-q4_k_m.gguf` |
| **Revision (Commit SHA)** | `91cad51170dc346986eccefdc2dd33a9da36ead9` |
| **Configured LFS SHA-256** | `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e` |
| **Verified SHA-256 (`sha256Verified: true`)** | `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e` |
| **Dung lượng chính xác** | `1,117,320,736` bytes (~1.12 GB) |
| **Runtime suy luận** | `@wllama/wllama@3.8.1` (WASM 1 luồng, `n_threads: 1`, `n_batch: 64`, `n_gpu_layers: 0`) |
| **Runtime đọc PDF** | `pdfjs-dist@5.4.624` |
| **Công cụ đóng gói & E2E** | `vite@8.3.6` (`base: '/firm-lens/'`), `playwright@1.58.2` |

---

## 2. Môi trường Kiểm chứng Thực tế

- **Hệ điều hành & Runtime:** Windows `win32 x64` (`Node.js v24.14.0`)
- **Trình duyệt kiểm thử:** Headless Google Chrome / Chromium `156.0.8078.80` (điều khiển qua Playwright)
- **Kiểm chứng không cần `COOP`/`COEP`:** Máy chủ HTTP tĩnh phục vụ `dist/` không gắn header `Cross-Origin-Opener-Policy` hay `Cross-Origin-Embedder-Policy`. Giá trị thực tế trong trình duyệt:
  - `window.crossOriginIsolated === false`
  - `wllama.getNumThreads() === 1` (chạy hoàn toàn bằng WebAssembly 1 luồng, không cần `SharedArrayBuffer` và không cần WebGPU)
- **Tài liệu PDF thực tế:** Báo cáo thường niên công khai năm 2025 của Vinamilk (`C:\Users\hazym\Downloads\2025.pdf`, dung lượng `28,823,803` bytes, `112` trang PDF; không commit vào Git).

---

## 3. Lịch sử Lần chạy Đầu tiên Trước khi Sửa F1–F6 (Historical Context)

Để đảm bảo tính minh bạch lịch sử kỹ thuật, bảng dưới đây lưu giữ số liệu của lần chạy đầu tiên (trước đợt rà soát `task-001-manager-review.md`) và hiện tượng timeout khi Manager chạy lại:

- **Số liệu lần chạy đầu tiên của Worker:** Cold load `19,992 ms`, Warm load `8,607 ms`, trích xuất PDF `905 ms` (`1,260` đoạn cắt theo độ dài ký tự), suy luận `212,854 ms` (`17` tokens).
- **Lỗ hổng phát hiện khi Manager kiểm tra lại (`docs/verification/task-001-manager-review.md`):**
  1. **F1:** Nối tuần tự `content.items` của `PDF.js` làm tách rời cột nhãn chỉ tiêu (`x ≈ 28`) khỏi cột số liệu năm 2025 (`x ≈ 390`) và năm 2024 (`x ≈ 484`) trên trang trải ngang 2 cột (`width = 1190.55`), đồng thời trộn lẫn trang VAS (`[Trang PDF 48]`) vào truy vấn IFRS 2025 (`[Trang PDF 109]`).
  2. **F2:** Trộn lẫn `retrievedPages` với `citations` thực sự xuất hiện trong văn bản trả lời của mô hình; bài smoke test chưa kiểm tra khớp số liệu tài chính chuẩn (`54.248.830` và `8.505.216` Triệu VND).
  3. **F3:** Khi nạp tệp PDF mới, đặt lại phiên, hoặc gặp lỗi PDF, giao diện chưa tăng `docRevision` và chưa xóa sạch câu trả lời/trích dẫn cũ ngay lập tức.
  4. **F4:** Chưa kiểm tra giới hạn độ dài câu hỏi và ngân sách token (`n_ctx = 1024`) trước khi gọi suy luận.
  5. **F5:** Kiểm tra bộ nhớ đệm OPFS chỉ so khớp kích thước tệp (`m.size === sizeBytes`) và cho phép ghi đè `?modelUrl=` không giới hạn trên đường dẫn công khai.
  6. **F6:** Khi truyền 2 đoạn trích dài (~900+ token) vào WASM 1 luồng, giai đoạn prefill C++ kéo dài ~235–310 giây khiến lần chạy lại của Manager chạm ngưỡng timeout `300,000 ms`, và thao tác hủy (`AbortController`) chưa dừng worker ngay lập tức khi đang ở giữa vòng lặp C++.

---

## 4. Nguyên nhân Gốc rễ & Giải pháp Kỹ thuật cho F1–F6 (`task-001-fix-01`)

1. **F1 — Tái tạo bảng theo tọa độ `(x, y)` của `PDF.js` & Lọc chuẩn mực kế toán/năm (`experiments/browser-ai/pdf-rag.mjs`):**
   - Phát hiện trang trải đôi (`viewport.width > 900`) để tách riêng nửa trang trái (`x < pageWidth * 0.52`, ví dụ trang in 216) và nửa trang phải (`x >= pageWidth * 0.52`, trang in 217) trước khi gom dòng theo tung độ `|Δy| <= 5` và sắp xếp hoành độ từ trái sang phải (`a.x - b.x`).
   - Tự động nhận diện hàng tiêu đề năm (`2025 | 2024`) và đơn vị (`Đơn vị: Triệu VND`) để gắn nhãn trực tiếp vào từng dòng chỉ tiêu:
     - `Doanh thu | 2025 (Triệu VND): 54.248.830 | 2024 (Triệu VND): 52.576.991`
     - `Lợi nhuận thuần | 2025 (Triệu VND): 8.505.216 | 2024 (Triệu VND): 8.686.245`
   - Theo dõi ngữ cảnh chuẩn mực kế toán (`IFRS` so với `VAS`) xuyên suốt các trang báo cáo và lọc cứng theo năm/chuẩn mực/phạm vi trong `retrieveRelevantChunks()`. Câu hỏi hợp nhất IFRS năm 2025 chỉ truy xuất `[Trang PDF 109]`, loại bỏ hoàn toàn trang VAS `[Trang PDF 48]`. Câu hỏi năm không tồn tại (`2019`) trả về `0` đoạn trích.
2. **F2 — Tách biệt `retrievedPages` với `citations` & Đối chiếu số liệu chuẩn (`experiments/browser-ai/pdf-rag.mjs`, `engine.mjs`, `tests/browser-ai-smoke.mjs`):**
   - Hàm `parseAndVerifyCitations()` tách riêng `retrievedPages` (trang đưa vào prompt) và `citations` (nhãn `[Trang PDF X]` thực sự xuất hiện trong câu trả lời của mô hình).
   - Nếu mô hình trích dẫn trang nằm ngoài `retrievedPages`, `engine.ask()` từ chối kết quả với mã lỗi `INVALID_CITATION`. Khi từ chối trả lời (`isRefusal === true`), `citations` luôn là mảng rỗng `[]`.
3. **F3 — Quản lý phiên `docRevision` & Dọn dẹp trạng thái tức thì (`experiments/browser-ai/app.mjs`):**
   - Mỗi lần nạp PDF mới, bấm "Đặt lại phiên PDF", hoặc gặp lỗi tệp PDF đều tăng `state.docRevision`, hủy tác vụ trích xuất/suy luận đang chạy và gọi `clearAnswerAndEvidenceUI()` để xóa sạch câu trả lời, nhãn trích dẫn và đoạn trích của tài liệu cũ.
4. **F4 — Kiểm soát ngân sách ngữ cảnh & Rút gọn bảng bảo toàn dòng (`experiments/browser-ai/pdf-rag.mjs`):**
   - Hàm `validateQuestionAndBudget()` chặn câu hỏi rỗng (`EMPTY_QUESTION`), câu hỏi quá `500` ký tự (`QUESTION_TOO_LONG`), và kiểm tra tổng ngân sách token (`promptTokens + completionReserveTokens <= 1024`).
   - Hàm `compactChunkForQuestion()` giữ nguyên tiêu đề bảng, năm, đơn vị tính và các dòng chỉ tiêu khớp từ khóa câu hỏi mà không bao giờ cắt cụt giữa dòng.
5. **F5 — Xác thực bộ nhớ đệm theo URL + Kích thước & Khóa `?modelUrl=` công khai (`experiments/browser-ai/pdf-rag.mjs`, `engine.mjs`):**
   - `checkCacheStatus()` yêu cầu khớp đồng thời `m.url === resolved.url` và `m.size === MODEL_MANIFEST.sizeBytes` (`1,117,320,736` bytes), đồng thời tách bạch `configuredSha256` và `sha256Verified`.
   - `resolveModelUrl()` chặn mọi tham số `?modelUrl=` ở chế độ công khai (`OVERRIDE_DISABLED`), chỉ cho phép địa chỉ loopback (`127.0.0.1` / `localhost`) khi bật cờ kiểm thử `?smoke=1` và đúng tên tệp GGUF đã ghim.
6. **F6 — Khắc phục Timeout 300,000 ms & Phục hồi giao diện khi Hủy (`experiments/browser-ai/engine.mjs`):**
   - Rút gọn ngữ cảnh bảng còn `404` token BPE thực tế (ước tính bảo thủ `promptTokens = 499`, `totalBudgetTokens = 627 / 1024`), cấu hình `n_batch: 64`, `return_progress: true`, đo tách bạch `prefillMs`, `firstTokenMs` (TTFT) và `inferMs`.
   - Khi người dùng bấm Hủy giữa lúc prefill C++ 1 luồng, `abortActiveInference()` chủ động gọi `proxy.abort()` để giải phóng toàn bộ Promise đang chờ trong `resultQueue` của `@wllama/wllama` trước khi `worker.terminate()`, giúp giao diện phục hồi tức thì dưới 1 giây.

---

## 5. Kết quả Đo lường Thực tế Sau khi Sửa (`task-001-fix-01`)

Trích xuất trực tiếp từ `docs/verification/task-001-fix-01-evidence.json` (chạy lệnh `npm run test:browser:smoke`, mã thoát `0`):

| Hạng mục đo lường | Kết quả thực tế (`fix-01`) | Chi tiết xác minh |
| :--- | :--- | :--- |
| **Xác thực SHA-256 tệp GGUF** | `sha256Verified: true` | Khớp tuyệt đối `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e` (`1,117,320,736` bytes) |
| **Cold Load (`cacheMode: "cold"`)** | `26,796` ms (~26.8 giây) | Nạp mô hình vào OPFS cache + khởi tạo WASM (`numThreads: 1`, `crossOriginIsolated: false`) |
| **Warm Load (`cacheMode: "warm"`)** | `10,147` ms (~10.1 giây) | Nạp lại từ OPFS cache sau `page.reload()` (**nhanh hơn 2.64×** so với Cold load) |
| **Trích xuất PDF theo tọa độ bảng (`PDF.js`)** | `875` ms | `2025.pdf` (`112` trang, `464,250` ký tự, `396` đoạn trích bảo toàn cấu trúc dòng–cột–năm–đơn vị) |
| **Kiểm thử Hủy suy luận & Phục hồi UI (`F6`)** | `lastErrorCode: "ABORTED"` | Hủy giữa lúc prefill, dừng Worker sạch sẽ, nút `#load-model` bật lại (`disabled: false`), `#cancel-action` tắt (`disabled: true`), `citationsCount: 0` |
| **Kiểm thử Câu hỏi ngoài phạm vi (`Năm 2019`)** | Từ chối chính xác (`isRefusal: true`) | `retrievedPages: []`, `citations: []`, trả lời: *"Không đủ thông tin trong đoạn trích báo cáo phù hợp với năm, chuẩn mực kế toán hoặc chỉ tiêu được hỏi."* |
| **Ngân sách Token câu hỏi IFRS 2025 (`F4`)** | `promptTokens: 499` / `totalBudgetTokens: 627` | Nằm gọn trong giới hạn `n_ctx = 1024` (dự trữ `128` token sinh câu trả lời); thực tế Wllama BPE là `404` token |
| **Thời gian Prefill (`prefillMs`)** | `157,374` ms (~157.4 giây) | Giảm mạnh so với mức ~235–300+ giây trước đây |
| **Thời gian Token Đầu tiên (`firstTokenMs` / TTFT)** | `157,913` ms (~157.9 giây) | Token đầu tiên sinh ngay sau khi hoàn tất prefill ~0.54 giây |
| **Tổng thời gian Suy luận (`inferMs`)** | `186,495` ms (~186.5 giây, `64` tokens) | Hoàn tất ổn định trong ngân sách `< 300,000 ms` (còn dư hơn 113 giây an toàn) |
| **Bộ nhớ JS Heap (`performance.memory`)** | `usedJSHeapMB: 7.3 MB` / `totalJSHeapMB: 8.8 MB` | Giới hạn JS Heap: `4,192 MB`; bộ nhớ mô hình nằm trong `WebAssembly.Memory` của Worker |

### Bằng chứng Nguyên bản Câu hỏi, Ngữ cảnh và Câu trả lời Thực tế (IFRS 2025)

- **Câu hỏi (`question`):**
  `Doanh thu và lợi nhuận thuần năm 2025 theo báo cáo kết quả hoạt động kinh doanh hợp nhất IFRS là bao nhiêu?`
- **Trang truy xuất (`retrievedPages`):** `[109]` (không còn lẫn trang `48` của báo cáo VAS)
- **Đoạn trích đã rút gọn theo dòng (`fittedChunks[0].text`):**
  ```text
  Báo cáo kết quả hoạt động kinh doanh và
  2025 | 2024
  Đơn vị: Triệu VND | Triệu VND
  I. Báo cáo lãi lỗ
  cho năm kết thúc ngày 31 tháng 12 năm 2025
  Doanh thu | 2025 (Triệu VND): 54.248.830 | 2024 (Triệu VND): 52.576.991
  Lợi nhuận thuần | 2025 (Triệu VND): 8.505.216 | 2024 (Triệu VND): 8.686.245
  ```
- **Câu trả lời nguyên bản từ mô hình (`rawAnswer`):**
  ```text
  [Trang PDF 109]
  """
  Doanh thu năm 2025: 54.248.830 Triệu VND
  Lợi nhuận thuần năm 2025: 8.505.216 Triệu VND
  """
  ```
- **Kiểm tra trích dẫn (`citations` & `citationValid`):** `citations: [109]`, `invalidCitations: []`, `citationValid: true`.

---

## 6. Giới hạn Kỹ thuật Trung thực trên Thiết bị Người dùng (Known Limitations)

1. **Tốc độ suy luận trên CPU WASM 1 luồng (`crossOriginIsolated = false`):**
   - Trên môi trường tĩnh không có header `COOP`/`COEP` (như GitHub Pages mặc định), trình duyệt khóa `SharedArrayBuffer`, buộc `@wllama/wllama` chạy ở chế độ **WebAssembly 1 luồng duy nhất** (`n_threads = 1`).
   - Với mô hình thật `Qwen2.5-1.5B-Instruct` (`Q4_K_M`, 1.12 GB), tốc độ prefill trên 1 luồng CPU đạt khoảng `~2.5–3.2 token/giây`, nên một truy vấn thực tế (~400 token ngữ cảnh) cần khoảng **2.5 – 3.1 phút** để hoàn tất.
2. **Yêu cầu dung lượng bộ nhớ đệm & RAM:**
   - Thiết bị cần tối thiểu ~2 GB dung lượng đĩa trống cho OPFS/IndexedDB và ~1.5–2.0 GB RAM trống cho `WebAssembly.Memory`. Chế độ ẩn danh (Incognito) hoặc thiết bị di động cấu hình thấp có thể bị trình duyệt giới hạn hạn ngạch OPFS (được bắt và thông báo rõ bằng mã `MEMORY_ERROR`).
3. **Định vị sản phẩm:**
   - Trang `/experiments/browser-ai/index.html` là **cổng kiểm chứng kỹ thuật thực nghiệm (Technical Feasibility Gate)** cho khả năng đọc PDF và chạy LLM nội bộ trên trình duyệt không máy chủ, **không phải** hệ thống tư vấn đầu tư hoàn chỉnh.

---

## 7. Lệnh Kiểm tra Tái lập & Mã thoát (Reproducible Commands)

| Lệnh kiểm tra | Mã thoát | Kết quả xác minh |
| :--- | :---: | :--- |
| `npm test` | `0` | **11/11 PASS** — Gồm 3 bài test sổ cái gốc (`tests/data.test.mjs`) và 8 bài test đơn vị/hồi quy F1–F5 (`tests/browser-ai.test.mjs`, bao gồm kiểm thử trực tiếp trên `2025.pdf`). |
| `npm run build` | `0` | **PASS** — Đóng gói Vite đa trang (`dist/index.html` và `dist/experiments/browser-ai/index.html`) với `base: '/firm-lens/'`. |
| `npm run test:browser` | `0` | **PASS** — Kiểm thử Playwright E2E không `COOP`/`COEP`: xác minh trang chính VNM/DGC, chặn `?modelUrl=` công khai (`F5`), trích xuất bảng `2025.pdf` (`F1`), xóa trạng thái khi thay thế/lỗi/đặt lại phiên PDF và đua nạp nhanh A/B (`F3`). |
| `npm run test:browser:smoke` | `0` | **PASS** — Kiểm thử mô hình thật `Qwen2.5-1.5B-Instruct-GGUF` (xác minh SHA-256, Cold/Warm load, hủy suy luận & phục hồi worker, từ chối câu hỏi năm 2019, và kiểm tra khớp số liệu IFRS 2025 `54.248.830` & `8.505.216` Triệu VND tại `[Trang PDF 109]`). |
