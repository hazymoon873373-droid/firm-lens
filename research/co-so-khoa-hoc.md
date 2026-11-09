# Cơ sở khoa học và quyết định cho FirmLens

Rà soát ngày 09/11/2026. Q1 là phân vị của **tạp chí theo cơ sở xếp hạng, ngành và năm**, không phải chứng nhận sản phẩm hay từng bài báo. Không chuyển độ chính xác trong nghiên cứu khác thành độ chính xác của FirmLens.

## Phạm vi đọc và kiểm tra Q1

Đã đọc các phần phương pháp, dữ liệu, đánh giá và giới hạn trong hai bài toàn văn mở trên Springer; bài tổng quan ESWA dưới đây mới truy cập được abstract/highlights của nhà xuất bản (toàn văn bị 403). Không tuyên bố đã đọc toàn văn bài thứ ba.

| Tạp chí | Mốc tham chiếu | Nguồn đối chiếu |
|---|---|---|
| Artificial Intelligence Review | SJR/JCR 2024, Q1; dùng cho bài năm 2024 | [Hồ sơ Đại học Comillas](https://www.iit.comillas.edu/publicacion/info_revista/en/229/Artificial_Intelligence_Review), [bảng SJR 2024 do thư viện UMB lưu](https://kniznica.umb.sk/app/cmsSiteBoxAttachment.php?ID=6369&cmsDataID=0) |
| Expert Systems with Applications | SJR/JCR 2024, Q1 | [Hồ sơ Đại học Comillas](https://www.iit.comillas.edu/publicacion/info_revista/en/60/expert-systems-with-applications) |
| Financial Innovation | Hồ sơ Scopus 2024 ghi Q1 ở Management of Technology and Innovation; mốc tham chiếu cho tạp chí, không tự gán Q1 năm 2025 | [Hồ sơ Pusan National University](https://scholar2.pusan.ac.kr/en/journals/019f8e7b-9fbd-7e9f-a2a8-ea2474ab6032) |

Các bản đối chiếu trên là hồ sơ học thuật/thư viện. Truy cập trực tiếp SCImago bị 403 trong lần rà soát, chưa truy cập tài khoản JCR. Trước khi nộp, nhóm cần lưu bản xác nhận đúng hệ/ngành/năm mà quy chế cuộc thi yêu cầu; không ghi chung chung “Q1 hiện tại”.

## 1. Giải thích AI trong tài chính

Černevičienė & Kabašinskas (2024), **Explainable artificial intelligence (XAI) in finance: a systematic literature review**, Artificial Intelligence Review 57:216. [Toàn văn/DOI](https://doi.org/10.1007/s10462-024-10854-8).

Tổng quan 138 nghiên cứu phân biệt giải thích cục bộ, toàn cục và theo nhiệm vụ. Rủi ro và yêu cầu người dùng khác nhau giữa chấm tín dụng, đầu tư và dự báo. **Áp dụng của nhóm:** hiển thị công thức và nguồn; không gọi văn bản LLM là lời giải thích nhân quả. Đây là lựa chọn thiết kế, chưa phải kiểm định hiệu quả FirmLens.

## 2. Dự báo sức khỏe qua nhiều niên độ

Zhu, Zhang & Crabbe (2025), **Exploring small-scale optimization coupling learning approaches for enterprises’ financial health forecasts**, Financial Innovation 11:78. [Toàn văn/DOI](https://doi.org/10.1186/s40854-024-00748-7). DOI chứa 2024, nhưng ngày xuất bản là 08/02/2025.

Nghiên cứu 3.424 doanh nghiệp Trung Quốc, dùng tín hiệu nhiều năm và nhãn ST/*ST. **Áp dụng:** theo dõi nhiều niên độ và so mô hình cơ sở. Không mang nhãn ST, dữ liệu thương mại hay kết quả của bài sang Việt Nam. Biên lợi nhuận của FirmLens là mục tiêu khác; bài này không xác nhận ngưỡng giảm 3 điểm phần trăm của nhóm.

## 3. Tổng quan dự báo phá sản

Dasilas & Rigani (2024), **Machine learning techniques in bankruptcy prediction: A systematic literature review**, Expert Systems with Applications 255:124761. [Abstract nhà xuất bản](https://www.sciencedirect.com/science/article/pii/S0957417424016282), [DOI](https://doi.org/10.1016/j.eswa.2024.124761).

Abstract mô tả tổng hợp 207 nghiên cứu và vai trò cả biến tài chính lẫn phi tài chính. **Áp dụng:** giữ báo cáo kiểm toán, công bố bất thường và văn bản trong danh mục đầu vào tương lai. Chưa có toàn văn để đánh giá chi tiết thiết kế kiểm định; không viện dẫn bài này làm bằng chứng mô hình phức tạp luôn tốt hơn trên mẫu nhỏ.

## Những gì được thể hiện trong web

- **Đang có:** tỷ số từ công thức xác định, nguồn/kỳ/chuẩn/phạm vi, mẫu lịch sử được gắn nhãn; trích xuất PDF và hỏi đáp LLM tùy chọn; kiểm tra thiếu bằng chứng và điều hướng trích dẫn.
- **Pipeline đã viết, chưa có thực nghiệm tài chính:** Ridge/persistence, tiền xử lý chỉ học train, tách theo thời gian và ngày công bố. Ngưỡng giảm biên 3 điểm phần trăm là giả thuyết chốt trước, cần đánh giá nghiệp vụ.
- **Chưa có:** mô hình dự báo được kiểm định trên dữ liệu Việt Nam, xác suất phá sản, đánh giá lợi nhuận đầu tư, bộ 20 câu hỏi được chấm bởi người thứ hai. Không hiển thị các chỉ số giả để lấp khoảng trống này.

Hai bài rủi ro chuỗi cung ứng năm 2025 do nhóm cung cấp vẫn là tài liệu phương pháp khai thác văn bản; chúng không thay thế nghiên cứu dự báo suy giảm. Lựa chọn trước mắt là hoàn thiện công cụ hỗ trợ đọc và kiểm tra báo cáo, đo thời gian/độ đúng, rồi mở dự báo khi đủ dữ liệu thật.
