# Đánh giá sẵn sàng dự thi — 09/11/2026

**Kết luận chuyên môn: FirmLens đang ở mức ý tưởng có bản mẫu kỹ thuật; chưa phải hệ thống hỗ trợ quyết định tài chính đã được kiểm định.** Có thể trình diễn việc đọc tài liệu, truy nguồn và tính tỷ số trong phạm vi đã kiểm thử. Chưa thể trình bày rằng AI đã dự báo chính xác suy giảm của doanh nghiệp Việt Nam, giúp sinh lợi đầu tư hay dự đoán phá sản. Chưa có tên/quy chế cuộc thi nên không thể khẳng định đủ điều kiện dự thi hoặc khả năng đạt giải.

## Bằng chứng đang có và khoảng trống

| Thành phần | Trạng thái có thể bảo vệ trước hội đồng |
|---|---|
| Hai doanh nghiệp trên sổ cái | 4 công ty-năm minh họa: VNM IFRS 2024/2025 và DGC tạm thời 2024/2025. Đây không phải dữ liệu VAS huấn luyện. |
| Dữ liệu VAS 10 công ty × 10 năm | **0 quan sát số đã đối chiếu nhập vào pipeline**, còn thiếu 100 công ty-năm. Nguồn gốc đã được khảo sát trong `research/source-manifest.json`; tài liệu tồn tại nhưng việc trích/chuẩn hóa/kiểm tra ngày chưa hoàn tất. |
| Mô hình tài chính thực | **Chưa huấn luyện trên dữ liệu thực**. `research/model-status.json` xuất đúng train=0, validation=0, test=0, model/evaluation=null, active=false. |
| Hạ tầng thí nghiệm | Pipeline Python, quy tắc dữ liệu, Ridge/persistence, xuất JSON và kiểm thử có thể tái lập. Fit fixture trong unittest chỉ chứng minh phần mềm chạy, không chứng minh dự báo tốt. |
| Đọc tài liệu bằng LLM | Một năng lực khác với dự báo tài chính. Bằng chứng suy luận thật và chất lượng Q&A do báo cáo kỹ thuật riêng ghi nhận; không suy từ việc model tải được sang việc mọi câu trả lời đúng. |

Các nguồn chính là trang công bố của doanh nghiệp: [SAB](https://www.sabeco.com.vn/en-US/investors/financial-statements/2024-2), [MSN](https://www.masangroup.com/investor-relations/), [MCH](https://masanconsumer.com/en/annual-report/), [BBC](https://www.bibica.com.vn/bao-cao-tai-chinh/2024), [NAF](https://www.nafoods.com/vi/quan-he-co-dong/bao-cao-tai-chinh/). Một số lần đọc VNM bị HTTP 403; PDF MSN/SAB vượt giới hạn công cụ hoặc thiếu lớp văn bản. Đây là hạn chế truy cập/trích xuất của lần khảo sát, **không phải kết luận dữ liệu không tồn tại hoặc phải mua**. Không vượt xác thực, trả phí hay đưa toàn báo cáo vào Git.

## Đúng bài toán tài chính

Đầu ra đã chốt là biên lợi nhuận ròng năm tài chính tiếp theo, với \(m_t=\frac{\mathrm{LNST\ toàn\ tập\ đoàn}_t}{\mathrm{doanh\ thu\ thuần}_t}\). Tín hiệu thí nghiệm xuất hiện khi \(\widehat m_{t+1}\le m_t-0{,}03\), tức giảm ít nhất **3 điểm phần trăm**, không phải giảm 3% tương đối. Đây là tín hiệu cần đọc thêm báo cáo; không đại diện toàn bộ sức khỏe tài chính, thanh khoản hay xác suất vỡ nợ.

Mô hình dùng biên hiện tại, nợ phải trả/tài sản, CFO/tài sản, log tài sản theo triệu VND và cờ thiếu CFO. Những đặc trưng này liên quan đến khả năng sinh lời, cơ cấu vốn và chuyển đổi tiền, nhưng còn bỏ sót lịch đáo hạn, thanh khoản, chất lượng phải thu, giao dịch liên quan và ý kiến kiểm toán. Không tự cộng các tín hiệu thành điểm sức khỏe 0–100. LNST mẹ và LNST toàn tập đoàn không được trộn.

Báo cáo năm t thường công bố **trong niên độ t+1**. Dự báo cả năm t+1 vì vậy có điều kiện trên thông tin tại ngày công bố và một phần năm mục tiêu đã trôi qua; không gọi là dự báo 12 tháng sau ngày người dùng hỏi. [Niên độ AgriS](https://www.ttcagris.com.vn/quan-he-nha-dau-tu/bao-cao-thuong-nien?year=2025) và [báo cáo LASUCO](https://lasuco.vn/wp-content/uploads/2025/10/20251004-LSS-Annual-report-2024-2025-1.pdf) còn dùng niên độ khác năm dương lịch. Pipeline ghép theo năm kết thúc và chặn thay đổi lịch tài chính; ngày công bố vẫn phải xác minh từng phiên bản.

## Kiểm định cần có

Chia theo năm **kết quả mục tiêu**, train đến 2021, validation 2022, test 2023–2025. Tham số Ridge alpha=1 cố định trước; imputation/scaling chỉ học train, theo [hướng dẫn chống rò rỉ của scikit-learn](https://scikit-learn.org/stable/common_pitfalls.html). Nhãn train chỉ được dùng khi đã có tại gốc dự báo holdout sớm nhất. So với persistence: giữ nguyên biên hiện tại. MAE phải báo thêm theo điểm phần trăm, median absolute error và số TP/FP/FN/TN của ngưỡng đã chốt; precision/recall không xác định phải để null cùng mẫu số.

Cổng hiện tại là ít nhất 50 train, 5 validation, 20 test và 5 công ty test. Với 10 công ty năm 2016–2025, tối đa chỉ 50 cặp train; loại một quan sát thiếu/rò ngày có thể làm không đạt. Không hạ cổng để kịp hạn; nếu cần thêm lịch sử phải sửa protocol có phiên bản và giữ test đã chốt. Dù đủ cổng và thắng baseline, kết quả vẫn là pilot ngành hẹp, cần rà soát độc lập trước khi mở cảnh báo.

Cohort cố định không đại diện mọi doanh nghiệp Việt Nam: có thiên lệch chọn/sống sót, sự phụ thuộc giữa MSN–MCH và cấu trúc hàng tiêu dùng/đường rất khác nhau. MCH/QNS có giai đoạn UPCoM: cần trình bày đúng phạm vi “niêm yết/đăng ký giao dịch” theo lịch sử, không giả định cả cohort đã niêm yết suốt 2016–2025. Không chia ngẫu nhiên công ty-năm rồi gọi độc lập. Sau pilot cần kiểm định tiến theo thời gian, kiểm tra bỏ từng doanh nghiệp/nhóm sở hữu, và báo khoảng bất định; 20–30 cặp test không đủ hiệu chuẩn xác suất phá sản.

## GitHub và nguồn mở nào giúp thật sự

- [scikit-learn](https://github.com/scikit-learn/scikit-learn) là công cụ phù hợp với mẫu nhỏ, Ridge minh bạch, [BSD-3-Clause](https://github.com/scikit-learn/scikit-learn/blob/main/COPYING). Đã cài riêng `.venv` cho pipeline; không phải một dataset Việt Nam hay bộ trọng số tài chính sẵn dùng.
- [vnstock](https://github.com/thinh-vu/vnstock) là dự án liên quan đến truy xuất dữ liệu, nhưng trang hiện hành nói kho cũ chỉ còn lịch sử và chuyển sang gói dựng sẵn; không được coi mọi bản là MIT hoặc bảo đảm API cũ hoạt động. [Trang giấy phép](https://vnstocks.com/policies/license) đang hiển thị bản công bố 24/10/2026, **hiệu lực 30/11/2026**, sau ngày khảo sát: phải kiểm tra điều khoản đúng bản cài, không dùng bản tương lai làm bằng chứng quyền hiện tại. Giấy phép phần mềm không cấp quyền dữ liệu bên thứ ba. Chưa cài hay dùng vnstock trong FirmLens.
- [SHAP](https://github.com/shap/shap) dùng [MIT](https://github.com/shap/shap/blob/master/LICENSE), có [LinearExplainer](https://shap.readthedocs.io/en/latest/generated/shap.LinearExplainer.html). Với Ridge tuyến tính, phép phân rã hệ số và đặc trưng chuẩn hóa đã đủ cho bản nhỏ; chưa cần thêm dependency. Đóng góp mô hình không chứng minh quan hệ nhân quả hay lý do kinh tế thực sự.
- [Dataset Việt Nam trên Hugging Face](https://huggingface.co/datasets/thanhnp-uel/vietnam-listed-companies-financial-statements) là ứng viên tăng tốc đối chiếu, snapshot `a86d37d960c74890d39299d3e400802f832cc789`. Card mô tả long format và tên tệp/bảng nguồn, chưa nêu đủ ngày công bố, phạm vi hợp nhất, VAS và đơn vị trong schema. Chưa nhập vào train. Nhãn “Public Domain” của người đăng không tự xác minh quyền nguồn gốc.

## Ưu tiên ba ngày trước hạn 12/11

1. **09/11:** chốt tên/quy chế cuộc thi; khóa claim đúng trạng thái. Hoàn thiện đường đọc PDF–hỏi–mở đúng trang nguồn, reset/hủy và thông báo lỗi; chuẩn bị kịch bản offline nếu máy yếu/mạng chậm. Bắt đầu nhập dữ liệu gốc bằng checklist trong `research/README.md`, ưu tiên đủ lịch sử của cohort đã chốt.
2. **10/11:** rà soát độc lập các số/ngày; chạy pipeline trên dữ liệu thật nếu đạt cổng. Đánh giá 20 câu hỏi tiếng Việt với đáp án/trang chuẩn, ghi số đúng/sai/từ chối và thời gian thực. Không đủ dữ liệu thì giữ dự báo tắt, nêu đây là kết quả thực nghiệm chưa hoàn thành thay vì công bố độ chính xác giả.
3. **11/11:** chạy acceptance trên bản build và thiết bị dự định dùng; đóng băng bằng chứng/commit sau review, chuẩn bị clip demo, sơ đồ hệ thống, bảng giới hạn, danh mục nguồn và phần trả lời phản biện. Phát hành chỉ theo phê duyệt riêng của Manager/người dùng.

Đánh giá giá trị kinh tế trước mắt bằng thời gian một người phân tích cần để tìm và kiểm tra số liệu, tỷ lệ trích đúng, tỷ lệ câu trả lời có nguồn đúng, số lỗi nghiêm trọng và chi phí thiết bị/thời gian chờ. So sánh cùng tác vụ có/không có công cụ bằng bộ câu hỏi khóa trước. Chỉ sau khi có dữ liệu dự báo độc lập mới xem xét cảnh báo bỏ sót/báo nhầm theo chi phí nghiệp vụ. Chưa có backtest giá/cổ tức/chi phí giao dịch thì không báo ROI, lợi nhuận hay khả năng thắng thị trường.

## Lệnh và giới hạn của bằng chứng

`python tools/finance.py` sinh trạng thái rỗng trung thực mà không cần ML dependency. `.venv/Scripts/python.exe -m unittest discover -s tools/tests` kiểm tra trust boundaries, niên độ, ngày công bố, train-only preprocessing, metric và parity hệ số Python/Node trên fixture. Bằng chứng test không thay thế dữ liệu thật hay đánh giá dự báo. `active:false` được giữ cả khi một tập dữ liệu sau này đủ mẫu: mở công khai cần quyết định review riêng.

Kết quả rà soát tài chính ngày 09/11: **10 kiểm thử Python đạt**, dùng scikit-learn 1.7.2 trong `.venv`. Kết quả JS/trình duyệt và suy luận thật cuối được ghi trong [báo cáo Manager](repo-remediation-01.md), tách khỏi bằng chứng kiểm định tài chính. Tệp khóa Python được lưu tại `tools/requirements-lock.txt`.

Chưa kiểm định khả năng kiếm lời, hiệu chuẩn xác suất, độ tổng quát ngoài cohort hay mọi thiết bị trình duyệt. Phần quan trọng nhất còn thiếu để tuyên bố “AI phân tích suy giảm đã được kiểm định” là bộ số VAS có lịch sử thời điểm công bố và kết quả so baseline trên holdout thật.
