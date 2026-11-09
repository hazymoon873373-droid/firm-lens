# Bản phát hành đã kiểm tra — 09/11/2026

- Website: https://hazymoon873373-droid.github.io/firm-lens/
- Commit ứng dụng được phát hành: `c1cab4064dfc23c0c11942f70d78322cdfc21cc7`.
- [GitHub Actions 42549000612](https://github.com/hazymoon873373-droid/firm-lens/actions/runs/42549000612): build-and-verify và deploy đều **success**. GitHub Pages dùng `build_type: workflow`, xuất bản `dist/`.
- Kiểm tra bản công khai bằng `node tests/public-smoke.mjs`: **PASS**, lúc 02:09 UTC / 09:09 giờ Việt Nam. Xem [JSON kết quả](public-smoke-evidence.json) và ảnh `screenshots/public-*`.

Đã mở trang thật, tải ba subset phông chữ, chuyển doanh nghiệp, xác nhận hai tỷ số còn thiếu của DGC giữ trạng thái thiếu, kiểm tra bảy nguồn tài liệu, đi từ sổ cái sang trích lục VNM, tra số liệu không cần model và kiểm tra giao diện 375px. Không có JS error, phản hồi HTTP lỗi hoặc yêu cầu tự tải GGUF trong lượt này. Năm tệp hồ sơ/tài liệu kiểm chứng tải được HTTP 200.

HEAD trên tài nguyên công khai: WASM HTTP 200 `application/wasm`; PDF worker HTTP 200 `text/javascript`; font tiếng Việt HTTP 200 `font/woff2`. Manager đã xem ảnh desktop/mobile lấy từ chính bản công khai.

Kiểm thử mô hình thật dùng GGUF đã xác minh SHA-256 qua localhost, ghi riêng tại [qwen-15b-final-evidence.json](qwen-15b-final-evidence.json). Hai câu hỏi 2025/2024 đạt oracle, lần lượt khoảng 92/50 giây; không suy ra thời gian tải trọn model qua Internet hoặc độ chính xác mọi câu hỏi. Không tải lại 1,12 GB trên website công khai trong lượt kiểm tra này.

Workflow có annotation về các action dùng Node 20 được GitHub buộc chạy bằng Node 24 và chuyển image Ubuntu; các bước vẫn đạt. Build có cảnh báo bundle AI lớn hơn 500 KB; bundle này chỉ ở màn hình AI. Không tắt cảnh báo hoặc giảm kiểm tra để qua gate.

Phạm vi phát hành là **bản mẫu đọc/đối chiếu báo cáo có nguồn**. Pipeline tài chính vẫn `active:false`, dữ liệu VAS đã duyệt 0 quan sát, chưa có model hay metric dự báo thật. Chưa hoàn thành bộ 20 câu hỏi chấm độc lập, kiểm định mọi kỳ báo cáo/mẫu bảng/thiết bị hoặc xác nhận Q1 trực tiếp trong JCR. Đọc [đánh giá dự thi](competition-readiness.md) và [hồ sơ khoa học](../../research/co-so-khoa-hoc.md).

Các tệp bổ sung sau commit phát hành là script/ảnh/biên bản xác minh bản công khai; không sửa runtime ứng dụng.
