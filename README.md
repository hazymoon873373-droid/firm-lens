# FirmLens

Website tiếng Việt minh họa ý tưởng AI đánh giá sức khỏe tài chính doanh nghiệp từ báo cáo công khai.

## Xem website

https://hazymoon873373-droid.github.io/firm-lens/

## Chạy trên máy

Không cần cài dependency để chạy website. Từ thư mục này:

```sh
python -m http.server 8080
```

Mở http://localhost:8080. Cần HTTP server để trình duyệt nạp JavaScript module; không mở trực tiếp qua file://.

Kiểm tra dữ liệu với Node.js 20 trở lên:

```sh
npm test
```

## Chức năng

- Tổng quan số liệu và biểu đồ 2024–2025; chuyển Vinamilk/Đức Giang.
- Nhận xét biên soạn sẵn, đối chiếu nguồn theo từng chỉ tiêu.
- Bảng dữ liệu có đơn vị, phạm vi và phiên bản; tải CSV UTF-8.
- Tìm tài liệu tham khảo, mô tả phương pháp và tải đề xuất Markdown.
- Link lưu lựa chọn doanh nghiệp trong URL; giao diện điện thoại, điều hướng bàn phím.

## Dữ liệu và giới hạn

`data.mjs` là bộ mẫu nhập thủ công từ tài liệu người dùng cung cấp; không phải nguồn dữ liệu thời gian thực.

- VNM: phần IFRS hợp nhất của báo cáo thường niên 2025, trang in 214–218 (PDF 108–110). Lợi nhuận là lợi nhuận thuần toàn tập đoàn, không phải riêng phần cổ đông công ty mẹ. Đơn vị gốc triệu VND.
- DGC: bảng kết quả hợp nhất trong bản thường niên công bố tháng 4/2026, mục III.1.2, trang in 19–20 (nhãn Trang PDF 21–22 trong bản Word OCR). Bảng gốc tỷ VND đã quy đổi sang triệu VND, giữ giới hạn làm tròn. Đây là số liệu công ty lập; chưa cập nhật theo bản kiểm toán công bố ngày 25/06/2026. Các trường chưa nhập giữ `null`.
- Không trộn số liệu công ty mẹ/hợp nhất hoặc VAS/IFRS để xếp hạng. Không tính xác suất phá sản hay điểm sức khỏe tùy ý.
- Chưa tích hợp mô hình AI, OCR tự động, tải file hoặc backend. Nhận xét trên web là nội dung đã biên soạn, không phải kết quả gọi AI trực tiếp.
- Chỉ chia sẻ số liệu trích chọn, mô tả ngắn và liên kết nguồn. Không đẩy toàn bộ PDF, Word hoặc nội dung bài báo lên repository.

## Công thức

Tăng trưởng = (kỳ hiện tại − kỳ trước) / trị tuyệt đối kỳ trước × 100. Nợ phải trả/tài sản = tổng nợ phải trả / tổng tài sản × 100. Biến động tỷ lệ được trình bày bằng điểm phần trăm. Nếu thiếu số liệu hoặc mẫu số bằng 0, trả về `null`.

## Cấu trúc

`index.html`: nội dung và giao diện. `styles.css`, `tokens.css`, `base.css`: hệ thống thiết kế Hallmark Terrazzo. `app.mjs`: tương tác trình duyệt. `data.mjs`: dữ liệu và công thức. `tests/`: kiểm tra dữ liệu. `de-xuat.md`: bản mô tả chia sẻ.

GitHub Pages phục vụ trực tiếp nhánh `main`, thư mục gốc. Không có khóa API, tài khoản đăng nhập hoặc dữ liệu người dùng trên website.
