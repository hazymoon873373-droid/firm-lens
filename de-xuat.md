# FirmLens Đề xuất ứng dụng AI đánh giá sức khỏe tài chính doanh nghiệp

Nhóm đề xuất hệ thống hỗ trợ nhà đầu tư cá nhân đọc và phân tích doanh nghiệp niêm yết Việt Nam từ dữ liệu công khai. Mục tiêu là giảm thời gian tổng hợp, phát hiện dấu hiệu cần xem xét và giúp người dùng kiểm tra bằng chứng.

## Bài toán và giải pháp

Báo cáo dài, số liệu nằm ở nhiều bảng, rủi ro nằm trong phần văn bản. FirmLens kết hợp chỉ tiêu tài chính tính bằng công thức cố định với thông tin định tính được AI trích xuất. Các góc nhìn gồm sinh lời, thanh khoản, đòn bẩy và chất lượng dòng tiền. Mọi kết quả phải gắn với nguồn, trang, kỳ và phiên bản.

## Dữ liệu đầu vào

Báo cáo tài chính hợp nhất và thuyết minh; báo cáo kiểm toán hoặc soát xét; báo cáo thường niên và công bố thông tin bất thường. Lưu mã doanh nghiệp, ngành, ngày công bố, kỳ báo cáo, chuẩn kế toán, đơn vị và phạm vi hợp nhất/riêng. Không dùng bản công bố sau thời điểm dự báo khi kiểm định lịch sử.

## Phạm vi thử nghiệm

Khởi đầu với doanh nghiệp niêm yết trong một ngành để tăng khả năng so sánh. Thu thập lịch sử nhiều năm; kiểm tra số lượng quan sát và nhãn trước khi chọn mô hình. Không cam kết dự báo phá sản hoặc xác suất rủi ro khi chưa đủ dữ liệu.

## Kế hoạch kiểm chứng

1. Đối chiếu trích xuất số liệu và nhận diện rủi ro với mẫu do người đọc kiểm tra.
2. Đo thời gian phân tích và lỗi bỏ sót so với đọc thủ công.
3. Thử nghiệm dự báo biên lợi nhuận hoạt động bốn quý tiếp theo. Đánh giá theo thời gian, chỉ dùng thông tin công khai tại mốc dự báo.
4. So sánh mô hình chỉ dùng số liệu với mô hình bổ sung thông tin văn bản để đo giá trị tăng thêm của AI.

## Trạng thái bản mẫu

Website hiện có hai doanh nghiệp và dữ liệu 2024–2025 nhập thủ công, biểu đồ, nhận xét biên soạn sẵn, tra nguồn và tải CSV. Chưa tích hợp AI trực tiếp, tải báo cáo tự động hoặc mô hình dự báo đã huấn luyện. Mẫu Vinamilk dùng phần IFRS hợp nhất. Mẫu Đức Giang dùng bản tháng 4/2026, số liệu công ty lập, chưa thay bằng bản cập nhật kiểm toán ngày 25/06/2026. Không xếp hạng trực tiếp hai doanh nghiệp khác ngành và khác cơ sở báo cáo.

## Cơ sở tham khảo

- Fan, Wu, Yang (2025), Measuring firm-level supply chain risk using a generative large language model, https://doi.org/10.1016/j.frl.2025.107111
- Fan, Kong, Wu, Yu (2025), Digital innovation and supply chain risk: A large language model-based analysis, https://doi.org/10.1016/j.pacfin.2025.102799

Hai nghiên cứu dùng biên bản hỏi đáp doanh nghiệp Trung Quốc để đo rủi ro chuỗi cung ứng. Chúng hỗ trợ lựa chọn phương pháp khai thác văn bản, không chứng minh sẵn khả năng dự báo sức khỏe doanh nghiệp Việt Nam.
