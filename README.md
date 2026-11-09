# FirmLens

Website tiếng Việt minh họa ý tưởng đánh giá sức khỏe tài chính doanh nghiệp từ báo cáo công khai, kết hợp sổ cái đối chiếu thủ công và không gian thử nghiệm đọc tài liệu bằng AI cục bộ trên trình duyệt.

## Phân tách rõ trạng thái dự án

1. **Sổ cái tĩnh có nguồn (`index.html`, `data.mjs`)**: Đã hoạt động. Hiển thị hai doanh nghiệp minh họa (`VNM`, `DGC`) giai đoạn 2024–2025, biểu đồ thực tế, nhận xét biên soạn sẵn, hộp thoại kiểm tra vị trí nguồn và xuất CSV UTF-8.
2. **Không gian thử nghiệm đọc tài liệu & AI trình duyệt (`experiments/browser-ai/`)**: Đã hoạt động ở chế độ tùy chọn (opt-in), không máy chủ và không khóa API trả phí. Hỗ trợ tra cứu trích lục mẫu từ `data.mjs` hoặc trích xuất bảng biểu có tọa độ từ tệp PDF có lớp văn bản (`PDF.js`), lọc hai chiều theo năm / chuẩn mực (`IFRS`, `VAS`) / phạm vi (`Hợp nhất`, `Riêng`), và tùy chọn tổng hợp câu trả lời có nhãn nguồn bằng `Qwen2.5-1.5B-Instruct-GGUF` (`@wllama/wllama` WASM 1 luồng). Trang không tự động tải mô hình 1.12 GB khi mở.
3. **Pipeline nghiên cứu & dữ liệu lịch sử**: Có `tools/finance.py` để kiểm tra đầu vào VAS hợp nhất, chia dữ liệu theo thời gian và so sánh Ridge với dự báo giữ nguyên biên lợi nhuận. **Chưa có dữ liệu lịch sử đã đối chiếu / chưa huấn luyện mô hình trên dữ liệu thật**. `research/model-status.json` giữ `active: false`, `model: null`; không tạo điểm sức khỏe, xác suất phá sản hay khuyến nghị đầu tư. Kiểm thử bằng dữ liệu tổng hợp chỉ xác nhận phần mềm chạy đúng.
4. **Bằng chứng kiểm chứng (`docs/verification/`)**: Phân biệt rõ giữa bài kiểm thử nhanh tái lập trên mọi máy (`npm test`, `npm run test:browser`) và bằng chứng suy luận mô hình thật ghi nhận trên máy thực thi (`npm run test:browser:smoke`), cần Manager hoặc người đọc chạy lại độc lập với tệp báo cáo công khai khi muốn đối chiếu toàn phần.

## Yêu cầu môi trường & Lệnh chạy trên máy

Cần **Node.js `^20.19.0 || >=22.12.0`** (đồng bộ với yêu cầu của `vite@8.3.6`; đã kiểm thử trên Node `v24.14.0`). Không dùng `python -m http.server` ở thư mục gốc cho không gian AI vì trang thử nghiệm sử dụng bare module imports (`@wllama/wllama`, `pdfjs-dist`) cần Vite dev server hoặc bản đóng gói `dist/`.

```sh
# 1. Cài đặt đúng phiên bản dependency từ lockfile
npm ci

# Máy mới / CI: cài trình duyệt cho các bài kiểm tra giao diện
npx playwright install chromium

# 2. Chạy máy chủ phát triển cục bộ (Vite)
npm run dev

# 3. Đóng gói bản tĩnh vào dist/ (base /firm-lens/) và xem thử bản đóng gói
npm run build
npm run preview
```

## Kiểm thử (Tái lập độc lập & Smoke mô hình thật)

```sh
# Kiểm thử đơn vị nhanh (portable, dùng fixture PDF & GGUF tổng hợp trong bộ nhớ — không cần PDF ngoài)
npm test

# Kiểm thử trình duyệt E2E trên bản build dist/ (kiểm tra 4 tab sổ cái, lối vào AI, mẫu VNM/DGC, PDF tổng hợp, điều hướng bàn phím, responsive 320–1920px)
npm run build
npm run test:browser

# Kiểm tra lỗ hổng bảo mật dependency runtime
npm audit --omit=dev --audit-level=high
```

Để chạy thêm kiểm thử trên báo cáo PDF thật hoặc chạy **smoke test suy luận mô hình thật `Qwen2.5-1.5B-Instruct-GGUF`** (tải/kiểm chứng SHA-256 vào `.cache/`, chạy CPU WASM 1 luồng không cần COOP/COEP, đo token GGUF BPE thực tế), truyền đường dẫn tệp PDF công khai qua biến môi trường `FIRMLENS_TEST_PDF_PATH`:

```powershell
# PowerShell (Windows)
$env:FIRMLENS_TEST_PDF_PATH = "C:\duong-dan\toi\2025.pdf"
npm test
npm run test:browser:smoke
```

```sh
# Bash (Linux / macOS)
FIRMLENS_TEST_PDF_PATH=/duong-dan/toi/2025.pdf npm run test:browser:smoke
```

Nếu thiếu `FIRMLENS_TEST_PDF_PATH`, lệnh `npm run test:browser:smoke` sẽ báo lỗi rõ ràng (exit code `1`) thay vì bỏ qua oracle rồi báo `PASS`.

## Dữ liệu và giới hạn trung thực

- **VNM**: Trích từ phần **IFRS hợp nhất** của Báo cáo thường niên 2025, trang in 214–218 (`Trang PDF 108–110`) và báo cáo quản trị rủi ro (`Trang PDF 95`). Lợi nhuận là lợi nhuận thuần toàn tập đoàn, đơn vị triệu VND; không trộn với số liệu VAS.
- **DGC**: Trích từ bảng kết quả hợp nhất trong **bản công bố lịch sử ngày 07/04/2026** (mục III.1.2, trang in 19–20, nhãn `Trang PDF 21–22` trong bản Word OCR). Đây là số liệu công ty tự lập làm tròn theo tỷ đồng (đã quy đổi sang triệu VND), **chưa cập nhật theo bản kiểm toán công bố ngày 25/06/2026**. Các chỉ tiêu chưa nhập (`cashflow`, `currentAssets`, `currentLiabilities`, `inventory`) được giữ nguyên `null`, không thay bằng `0`.
- **Giới hạn AI trình duyệt**: Chỉ hỗ trợ PDF có lớp văn bản (`≤ 50 MB`, `≤ 250 trang`, chưa hỗ trợ OCR ảnh scan). Mô hình 1.12 GB chạy trên CPU WASM 1 luồng có thể mất vài phút/câu (ngắt tự động ở `270 giây`), cần trống trên 2 GB RAM/OPFS và không hỗ trợ mọi thiết bị di động. Nhãn trang trích dẫn chỉ xác nhận trang nằm trong ngữ cảnh đã truy xuất để người đọc bấm mở đối chiếu nguyên văn, không phải chứng nhận kiểm toán tự động.
- Không đẩy toàn bộ tệp PDF/Word gốc, tệp trọng số `*.gguf`, thư mục `.cache/` hoặc khóa bí mật lên Git.

Để giới hạn chi phí CPU, mỗi lượt hỏi dùng tối đa 256 token đầu vào đo bằng tokenizer GGUF, trong cửa sổ mô hình 1024 token; giữ 128 token dự phòng đầu ra. Nên hỏi ngắn về 1–2 chỉ tiêu cùng bảng, ghi rõ năm và đúng doanh nghiệp trong tài liệu đang mở. Đoạn trích quá dài bị từ chối; tra cứu nguồn vẫn hoạt động. Với câu hỏi nêu một năm, các cột của năm khác chỉ được bỏ khỏi **ngữ cảnh gửi mô hình** khi bảng có tiêu đề năm/đơn vị nhất quán và câu hỏi không yêu cầu so sánh hay số bình quân. Bản trích nguồn trên giao diện vẫn giữ đầy đủ để đối chiếu. Bằng chứng hiện tập trung vào báo cáo năm; chưa kiểm định đầy đủ kỳ quý/lũy kế, mọi mẫu bảng hay mọi doanh nghiệp.

Đã thử Qwen 0,5B để giảm tải nhưng loại khỏi bản phát hành vì ghép sai chỉ tiêu/số tiền trong kiểm thử thật. Giữ bằng chứng thất bại trong `docs/verification/`; việc có citation không chứng minh số liệu đúng. Bản 1,5B vẫn là thử nghiệm đọc tài liệu, cần người dùng đối chiếu nguồn.

## Công thức cơ sở trên sổ cái

- Tăng trưởng kỳ năm: \(\frac{\text{Kỳ hiện tại} - \text{Kỳ trước}}{|\text{Kỳ trước}|} \times 100\%\)
- Tỷ lệ nợ phải trả trên tổng tài sản: \(\frac{\text{Nợ phải trả}}{\text{Tổng tài sản}} \times 100\%\) (biến động trình bày bằng điểm phần trăm). Nếu thiếu số liệu hoặc mẫu số bằng `0`, trả về `null`.

## Pipeline nghiên cứu độc lập với web

Môi trường tham chiếu: Python 3.13. Tạo môi trường riêng và cài bản khóa trong `tools/requirements.txt`; không cài vào Python hệ thống.

```powershell
py -3.13 -m venv .venv
.venv/Scripts/python -m pip install -r tools/requirements-lock.txt
.venv/Scripts/python -m unittest discover -s tools/tests -v
.venv/Scripts/python tools/finance.py
```

Linux/macOS dùng `python3.13 -m venv .venv` và `.venv/bin/python` ở các lệnh còn lại. Đọc [đánh giá sẵn sàng dự thi](docs/verification/competition-readiness.md) và [nguồn công cụ](docs/verification/toolkit-sources.md) trước khi diễn giải kết quả. Không đưa dữ liệu tổng hợp kiểm thử vào `research/vas-observations.json` để kích hoạt dự báo.

Hồ sơ [cơ sở khoa học và đối chiếu Q1](research/co-so-khoa-hoc.md) ghi DOI, phạm vi đã đọc, năm/ngành xếp hạng và điều kiện áp dụng. Hai bài toàn văn mở và một abstract được tách rõ; không mượn độ chính xác nghiên cứu khác để quảng bá sản phẩm.

## Cấu trúc & Triển khai tĩnh

- `index.html`, `styles.css`, `tokens.css`, `base.css`, `app.mjs`, `data.mjs`: Sổ cái chính và hệ thống thiết kế Hallmark Terrazzo.
- `experiments/browser-ai/`: Không gian đọc PDF & hỏi đáp AI cục bộ (`index.html`, `styles.css`, `app.mjs`, `pdf-rag.mjs`, `engine.mjs`, `gguf-tokenizer.mjs`).
- `tests/`: Kiểm thử đơn vị (`data.test.mjs`, `browser-ai.test.mjs`), fixture tổng hợp (`helpers/synthetic-pdf.mjs`), E2E (`browser-ai-e2e.mjs`) và smoke mô hình thật (`browser-ai-smoke.mjs`).
- `tools/`, `research/`: Pipeline Ridge/persistence, kiểm thử và hồ sơ nguồn; bản trạng thái công khai vẫn chưa có mô hình tài chính đã huấn luyện.
- `.github/workflows/pages-draft.yml`: Workflow GitHub Actions kiểm thử JS/Python/trình duyệt, đóng gói `dist/` với đường dẫn gốc `/firm-lens/`, phát hành thủ công bằng `deploy_to_pages: true` sau khi nghiệm thu. GitHub Pages cần dùng nguồn GitHub Actions thay cho xuất bản trực tiếp thư mục gốc.
