# FirmLens Đề xuất ứng dụng AI đánh giá sức khỏe tài chính doanh nghiệp

Nhóm đề xuất hệ thống hỗ trợ nhà đầu tư cá nhân đọc và phân tích doanh nghiệp niêm yết Việt Nam từ dữ liệu công khai. Mục tiêu là giảm thời gian tổng hợp, phát hiện dấu hiệu cần xem xét và giúp người dùng kiểm tra bằng chứng trực tiếp trên trang nguồn.

## Bài toán và giải pháp

Báo cáo dài, số liệu nằm ở nhiều bảng, rủi ro nằm trong phần văn bản. FirmLens kết hợp chỉ tiêu tài chính tính bằng công thức cố định với thông tin định tính được trích xuất có kiểm soát nguồn. Các góc nhìn gồm sinh lời, thanh khoản, đòn bẩy và chất lượng dòng tiền. Mọi kết quả phải gắn với nguồn, trang, kỳ, chuẩn kế toán và phiên bản công bố.

## Dữ liệu đầu vào

Báo cáo tài chính hợp nhất/riêng và thuyết minh; báo cáo kiểm toán hoặc soát xét; báo cáo thường niên và công bố thông tin bất thường. Lưu mã doanh nghiệp, ngành, ngày công bố, kỳ báo cáo, chuẩn kế toán (`VAS`/`IFRS`), đơn vị và phạm vi hợp nhất/riêng. Không dùng bản công bố sau thời điểm dự báo khi kiểm định lịch sử.

## Phạm vi thử nghiệm nghiên cứu tiếp theo

Khởi đầu với nhóm doanh nghiệp niêm yết cùng chuẩn kế toán (`VAS`) để đảm bảo khả năng so sánh. Thu thập lịch sử nhiều năm; kiểm tra cỡ mẫu, hiện tượng rò rỉ thời gian và phân phối nhãn trước khi ước lượng mô hình. Không cam kết dự báo phá sản hoặc xác suất rủi ro khi chưa đủ dữ liệu kiểm định.

## Kế hoạch kiểm chứng

1. Đối chiếu trích xuất số liệu bảng biểu và nhận diện rủi ro với mẫu do người đọc kiểm tra độc lập.
2. Đo thời gian phân tích và tỷ lệ từ chối đúng khi thiếu bằng chứng (tránh trộn lẫn báo cáo hợp nhất với công ty mẹ hoặc trộn `VAS` với `IFRS`).
3. Thử nghiệm dự báo **biên lợi nhuận ròng năm tài chính kế tiếp**. Đánh giá chia tách theo thời gian (temporal split), chỉ dùng thông tin công khai tại mốc dự báo.
4. So sánh mô hình cơ sở (persistence / hồi quy tuyến tính có điều chuẩn chỉ dùng số liệu tài chính) với mô hình bổ sung đặc trưng văn bản để đo giá trị tăng thêm thực chất.

## Trạng thái hiện tại của kho mã

- **Sổ cái minh họa**: Có hai doanh nghiệp (`VNM` phần IFRS hợp nhất 2024–2025; `DGC` bản lịch sử công bố 07/04/2026 do công ty lập, chưa thay bằng bản kiểm toán ngày 25/06/2026), biểu đồ hai kỳ, nhận xét biên soạn sẵn, đối chiếu nguồn và xuất CSV. Các trường thiếu giữ nguyên `null`. Không xếp hạng trực tiếp hai doanh nghiệp khác ngành và khác cơ sở báo cáo.
- **Không gian thử nghiệm đọc tài liệu & AI trình duyệt (`experiments/browser-ai/`)**: Cho phép tra cứu trích lục mẫu `VNM`/`DGC` hoặc tải tệp PDF có lớp văn bản để trích xuất bảng tọa độ qua `PDF.js`, lọc ngữ cảnh chặt và tùy chọn hỏi đáp với mô hình `Qwen2.5-1.5B-Instruct-GGUF` chạy cục bộ qua WebAssembly (không tự động tải 1.12 GB khi mở trang, từ chối câu trả lời thiếu nhãn trang nguồn hợp lệ).
- **Phần chưa thực hiện**: Chưa có bộ dữ liệu huấn luyện nhiều doanh nghiệp, chưa có mô hình dự báo **biên lợi nhuận ròng năm tài chính kế tiếp** đã huấn luyện và chưa có kết quả đánh giá dự báo độc lập.

## Cơ sở tham khảo

- Fan, Wu, Yang (2025), Measuring firm-level supply chain risk using a generative large language model, https://doi.org/10.1016/j.frl.2025.107111
- Fan, Kong, Wu, Yu (2025), Digital innovation and supply chain risk: A large language model-based analysis, https://doi.org/10.1016/j.pacfin.2025.102799

Hai nghiên cứu dùng biên bản hỏi đáp doanh nghiệp Trung Quốc để đo rủi ro chuỗi cung ứng. Chúng hỗ trợ lựa chọn phương pháp khai thác văn bản, không chứng minh sẵn khả năng dự báo sức khỏe doanh nghiệp Việt Nam.
