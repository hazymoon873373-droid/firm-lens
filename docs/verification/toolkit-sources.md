# Công cụ và nguồn mở đã chọn

Kiểm tra ngày 09/11/2026. Repo mã nguồn, thư viện chạy trong sản phẩm, skill cho trợ lý và connector dịch vụ là các loại khác nhau. Cài skill không làm website có thêm mô hình dự báo.

| Nguồn | Vai trò và trạng thái | Giấy phép / lưu ý |
|---|---|---|
| [ngxson/wllama](https://github.com/ngxson/wllama) | Web dùng `@wllama/wllama@3.8.1` để suy luận GGUF bằng CPU/WASM. | MIT; chạy một luồng, không bắt buộc WebGPU. |
| [mozilla/pdf.js](https://github.com/mozilla/pdf.js) | Web dùng `pdfjs-dist@5.4.624` để đọc PDF có lớp văn bản. | Apache-2.0; chưa có OCR ảnh scan. |
| [microsoft/playwright](https://github.com/microsoft/playwright) | Kiểm thử trình duyệt bằng `playwright@1.65.0`. | Apache-2.0; kiểm thử mô hình thật tách khỏi bài kiểm tra nhanh. |
| [scikit-learn/scikit-learn](https://github.com/scikit-learn/scikit-learn) | Pipeline nghiên cứu Python, cài riêng trong `.venv`; không đưa vào bundle web. | BSD-3-Clause; có mã huấn luyện không đồng nghĩa đã có mô hình được kiểm định. |
| [Qwen2.5-1.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF) | Trọng số hỏi đáp có sẵn, tải khi người dùng chủ động chọn; revision và SHA-256 trong manifest. | Apache-2.0; khoảng 1,12 GB. Đây là mô hình ngôn ngữ, chưa được nhóm huấn luyện để dự báo tài chính. |

Phiên bản thư viện JS được khóa trong `package-lock.json`; phiên bản Python trong `tools/requirements.txt`. Không sao chép toàn bộ các repo này vào mã ứng dụng.

## Skill đã cài cho Codex trên máy

- `playwright`: nguồn [openai/skills](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/playwright), revision `49f948faa9258a0c61caceaf225e179651397431`; cài tại `C:/Users/hazym/.codex/skills/playwright`.
- `huggingface-datasets`: nguồn [huggingface/skills](https://github.com/huggingface/skills/tree/25910b3d0ba31a2ba102f901cdc9e008c278a69c/skills/huggingface-datasets), revision `25910b3d0ba31a2ba102f901cdc9e008c278a69c`; cài tại `C:/Users/hazym/.codex/skills/huggingface-datasets`.

Đã đọc hướng dẫn và kiểm tra thư mục cài. Skill mới được tự động nhận từ lượt hội thoại tiếp theo. Các bài E2E hiện tại dùng Playwright API đã có trong repo; không tuyên bố đã chạy CLI của skill mới. Hallmark, Superpowers và Ponytail là workflow sẵn có được áp dụng trong đợt sửa này.

Tra cứu marketplace bằng từ khóa Hugging Face / dữ liệu tài chính Việt Nam chưa tìm được connector phù hợp trong các kết quả trả về. Không cài connector trả phí hoặc không liên quan để thay thế.

## Nguồn dữ liệu cần đánh giá tiếp

- [Vietnam listed companies financial statements](https://huggingface.co/datasets/thanhnp-uel/vietnam-listed-companies-financial-statements), snapshot `a86d37d960c74890d39299d3e400802f832cc789`: đã xác nhận có tệp Parquet và metadata. Dataset Viewer trả lỗi vì cấu hình glob không khớp thư mục; lỗi này không chứng minh các tệp dữ liệu trống. Card tự mô tả dữ liệu được chuẩn hóa từ nguồn công khai và yêu cầu kiểm tra báo cáo gốc. Các trường được công bố chưa đủ để tự xác minh ngày công bố, chuẩn kế toán, hợp nhất/riêng và lịch sử điều chỉnh. Chưa coi là dữ liệu huấn luyện đã được duyệt.
- [vnstock](https://github.com/thinh-vu/vnstock): chỉ tham khảo. Phải kiểm tra giấy phép và điều khoản truy cập dữ liệu của đúng phiên bản trước khi dùng; không giả định README/mã mẫu cũ áp dụng cho bản mới. Chưa cài package này.

Ưu tiên tiếp theo là đối chiếu dữ liệu với báo cáo doanh nghiệp, đơn vị, kỳ tài chính và ngày công bố; thêm thư viện không thay thế được bước này.

## Chữ tiếng Việt

Phông tiêu đề dùng [Noto Serif của Google Fonts](https://github.com/google/fonts/tree/main/ofl/notoserif), các subset Vietnamese/Latin/Latin-ext được tự lưu trong `public/fonts/` cùng SIL OFL 1.1. Tổng khoảng 80 KB; khi xem web không gửi yêu cầu tới Google Fonts. Giữ sans hệ thống cho bảng và thao tác. Kiểm tra UTF-8/NFC của nội dung và tải font trong suite trình duyệt; đây không phải cam kết đã kiểm tra mọi hệ điều hành.
