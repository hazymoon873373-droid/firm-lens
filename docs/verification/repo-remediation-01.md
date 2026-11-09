# Manager review — tiếp quản từ Antigravity

Ngày 09/11/2026. Phạm vi: sửa bản mẫu và chuẩn bị phát hành sau kiểm chứng; không tuyên bố đã hoàn tất nghiên cứu dự báo tài chính.

## Phần Antigravity để lại và phần tiếp quản

Queue còn PENDING, RESULT trống khi tiếp quản theo yêu cầu người dùng. Mã có sẵn gồm thử nghiệm Qwen/PDF, tokenizer GGUF, mẫu có nguồn, kiểm thử tổng hợp và cấu hình Vite/Actions. Đây là mã dở dang có thể sử dụng, không phải bằng chứng task đã nghiệm thu. Giữ lại lịch sử và mọi thay đổi có ích.

Codex tiếp tục sửa các cổng nguồn/citation, phạm vi/năm/chuẩn kế toán, deadline/hủy, vòng đời PDF, kiểm tra template/tokenizer và trạng thái giao diện. Giao diện được nâng trong hệ Terrazzo: masthead tối, nội dung phân tích, số liệu và biểu đồ có nguồn, ba tỷ số tính trực tiếp; không chấm điểm sức khỏe giả. Có lối đi rõ giữa sổ cái và không gian AI, khai báo chi phí tải và giới hạn thiết bị.

Bổ sung pipeline VAS/Ridge/persistence và hồ sơ nguồn, nhưng bộ đầu vào thực chưa được đối chiếu. Kết quả hiện tại đúng là `active:false`, `model:null`, không có chỉ số dự báo thực. Đọc [đánh giá chuyên môn](competition-readiness.md) cho điều kiện dự thi và những gì cần làm trước hạn.

## Review độc lập và lỗi phát hiện thêm

Reviewer chỉ đọc mã đã tìm thấy lỗi P1: cột mã số/thuyết minh trước cột năm có thể bị nhận nhầm thành giá trị tài chính. Ví dụ mã 10 và thuyết minh 6.1 bị gán cho doanh thu 2025/2024 dù số thực nằm ở hai cột sau. Đã sửa theo tọa độ cột tiêu đề; Manager chạy lại regression PDF.js tổng hợp và PDF thật, có cả ô thiếu để ngăn dịch cột. Citation đúng trang không bảo vệ được lỗi trích bảng này.

Một lần `npm test` của Manager có 29 đạt, 1 lỗi ở thao tác mở trang Vite trong bài kiểm tra UI khi nhiều trình duyệt đang chạy. Không ghi nhận lần đó là PASS. Đã hợp nhất các phép kiểm tra UI vào suite trình duyệt trên bản build, giữ các assertion riêng về tỷ số, giá trị thiếu, nguồn và responsive; bỏ lần khởi động Vite/Chrome trùng trong unit suite.

## Tối ưu sau kiểm thử thực

Qwen 1,5B có lượt trả lời đúng 201.996 ms, prompt 457 token khớp native, nhưng có lượt sau quá hạn. Bản 0,5B được thử với cùng oracle: có lượt quá hạn và có lượt dẫn đúng trang nhưng trả nhầm doanh thu/lợi nhuận thành 8.505.216 và 15.542.110. **Loại 0,5B, không phát hành nó.** Các tệp `qwen-05b-*-failure.json` giữ kết quả thất bại; không dùng chúng làm bằng chứng PASS.

Giữ 1,5B và rút phần hướng dẫn lặp. Chỉ chuẩn hóa bảng khi tiêu đề năm/đơn vị khớp tất cả hàng; bảng mơ hồ giữ chú thích tường minh. Câu hỏi một năm được chiếu cột tương ứng, câu hỏi so sánh/bình quân giữ các năm. Toàn bộ nguồn hiển thị không đổi. Cổng CPU 256 token từ chối ngữ cảnh quá dài, không giảm xuống một hàng để ép vừa. Thử thật tiếp tục giữ oracle cả doanh thu và lợi nhuận 2025, thêm câu hỏi doanh thu 2024 và parity khi dùng cache; không hạ deadline hay đổi số chuẩn.

Đã thay serif dự phòng bằng Noto Serif Vietnamese tự lưu kèm OFL, kiểm tra tải font/UTF-8/NFC, chỉnh tracking, bảo đảm input mobile 16px và Việt hóa nút chọn PDF. Bổ sung hồ sơ khoa học: hai toàn văn mở, một abstract, tách rõ nguồn xếp hạng Q1/năm/ngành và hạn chế truy cập SCImago/JCR.

## Bằng chứng và giới hạn

- Manager đã chạy độc lập 10/10 Python tests đạt; CLI trên dữ liệu thật hiện rỗng xuất số cặp 0/0/0, model/evaluation null. Fixture chỉ kiểm tra phần mềm.
- Kiểm tra HTTP HEAD đến đúng revision GGUF từ Origin Pages: HTTP 200, Content-Length 1.117.320.736, Access-Control-Allow-Origin `*`, hỗ trợ byte ranges. Đây không phải lần tải trọn qua mạng công cộng trên trình duyệt.
- `npm audit --omit=dev --audit-level=high`: 0 lỗ hổng theo cơ sở advisory tại lần chạy. Không coi đây là chứng nhận an toàn tuyệt đối.
- Manager đã xem ảnh desktop và mobile của cả hai màn hình. Hallmark sweep của worker: không FAIL/REFLEX; còn cảnh báo tĩnh về cascade/weight. Không có phép đo chất lượng dự báo tài chính.

## Kết quả cuối trên máy thực thi

`npm test` với `FIRMLENS_TEST_PDF_PATH` trỏ PDF Vinamilk thật: **35/35 đạt**, không skip. Python **10/10 đạt**. Build và suite trình duyệt đạt: bốn view sổ cái, mẫu/nguồn/PDF, trạng thái lỗi/hủy/reset, thao tác bàn phím, 320/375/768/1280/1920px, font Vietnamese/Latin tải cục bộ, không tự phát sinh yêu cầu tải model. CI không có PDF riêng ngoài repo nên một oracle PDF thật tùy chọn sẽ skip; fixture tổng hợp vẫn chạy.

[Bằng chứng suy luận thật](https://github.com/hazymoon873373-droid/firm-lens/blob/main/docs/verification/qwen-15b-final-evidence.json), ghi lúc 01:57 UTC / 08:57 giờ Việt Nam ngày 09/11/2026:

| Câu hỏi | Kết quả đối chiếu | Thời gian / token |
|---|---|---|
| Doanh thu và lợi nhuận thuần IFRS hợp nhất 2025 | 54.248.830 và 8.505.216 triệu VND; trang PDF 109 | 92.494 ms; đếm GGUF = native = 236 |
| Doanh thu IFRS hợp nhất 2024, hỏi tiếp trên cùng model | 52.576.991 triệu VND; trang PDF 109 | 50.337 ms; đếm GGUF = native = 208 |

Cùng lượt kiểm tra xác minh SHA-256, cache lạnh/ấm, hủy và nạp lại worker, câu hỏi 2019 thiếu bằng chứng bị từ chối. “Cache lạnh” ở đây là bộ nhớ đệm trình duyệt rỗng nhưng GGUF phục vụ từ bản đĩa đã xác minh qua localhost: **không phải** thời gian tải 1,12 GB qua mạng Internet công cộng. Thời gian tải model lần lượt 10.237 / 4.998 ms trong môi trường đó. Không hứa thời gian này trên mọi máy.

Hai câu hỏi thật là bằng chứng vận hành mẫu, không phải bộ đánh giá độ chính xác tổng quát, kiểm toán tất cả số gốc hoặc backtest đầu tư. Chưa chấm bộ 20 câu hỏi độc lập; chưa có dữ liệu VAS lịch sử đã duyệt và mô hình dự báo tài chính thực. Bản 0,5B sai số bị loại; không dùng kết quả đúng của 1,5B để xóa những thất bại đã ghi nhận.

Quyết định Manager: chấp nhận bản mẫu phân tích có nguồn và AI đọc tài liệu ở chế độ thử nghiệm, giữ dự báo tài chính tắt. Kiểm tra phát hành GitHub Pages thực tế được ghi sau khi workflow hoàn tất.
