# VAS pilot: dữ liệu thật chưa được chuẩn hóa

`vas-observations.json` hiện là mảng rỗng có chủ ý. Không nhập hai mẫu IFRS VNM / DGC tạm thời của giao diện vào tập huấn luyện VAS. `source-manifest.json` ghi nguồn đã tìm, kết quả truy cập và đúng 100 công ty-năm còn thiếu; có URL không đồng nghĩa đã xác minh số liệu.

## Tái lập

```powershell
py -3.13 -m venv .venv
.venv/Scripts/python.exe -m pip install -r tools/requirements-lock.txt
.venv/Scripts/python.exe -m unittest discover -s tools/tests
.venv/Scripts/python.exe tools/finance.py
```

Lệnh cuối tạo `research/model-status.json`. Với dữ liệu hiện tại: 0 quan sát, 0 công ty, train/validation/test đều 0; `active: false`, `model: null`, `evaluation: null`. Có thể chạy riêng lệnh xuất trạng thái bằng Python chuẩn mà chưa cài scikit-learn. Kiểm thử huấn luyện cần môi trường `.venv` ở trên. Các fixture trong `tools/tests/` là **tổng hợp chỉ để kiểm thử phần mềm**, không phải kết quả tài chính thực nghiệm.

## Nhập dữ liệu được đối chiếu

Mỗi phần tử JSON cần các trường sau; không có script nào tự gán `verified: true` cho dữ liệu lấy từ PDF hay LLM:

| Trường | Quy ước |
|---|---|
| `ticker`, `fiscal_year`, `fiscal_end`, `period_months` | Mã thuộc 10 công ty cố định; năm **kết thúc niên độ** 2016–2025; ngày ISO; đủ 12 tháng. SBT/LSS cần ngày kết thúc thực, không đổi thành 31/12. |
| `standard`, `scope`, `unit` | Chính xác `VAS`, `consolidated`, `million_VND`. Chuyển VND sang triệu bằng chia một triệu; lưu đơn vị gốc và phép chuyển trong bản đối chiếu. |
| `revenue`, `net_profit` | Doanh thu **thuần** và LNST **toàn tập đoàn**, cùng niên độ, không dùng LNST thuộc cổ đông mẹ hoặc lợi nhuận trước thuế. Doanh thu phải dương; lỗ được giữ âm. |
| `assets`, `liabilities`, `operating_cash_flow` | Tổng tài sản cuối niên độ dương; tổng **nợ phải trả**, không chỉ vay; lưu chuyển tiền thuần HĐKD cả năm, có thể âm. Chỉ CFO được `null`; không thay thiếu bằng 0. |
| `published_at`, `publication_evidence_url` | Ngày số liệu trong **phiên bản đang dùng** có thể được nhà đầu tư tiếp cận, có trang công bố của doanh nghiệp/sở đối chiếu. Ngày ký kiểm toán và ngày nhập lại website không tự chứng minh ngày công bố. |
| `source_url`, `source_pages`, `source_version`, `source_sha256` | HTTPS đến báo cáo; trang PDF và trang in/mã chỉ tiêu cho từng số; phiên bản gốc/điều chỉnh; SHA-256 của đúng tệp đã đối chiếu. Tệp gốc lưu riêng ngoài Git. |
| `verified`, `audited` | Cả hai phải là `true` sau khi người rà soát xác nhận phạm vi, chuẩn mực, niên độ, số và phiên bản; đây là khai báo của người nhập, không chứng nhận kiểm toán tự động. |

Nên lưu thêm `original_unit`, `conversion`, `reviewer`, `reviewed_at`, `audit_opinion` và chú thích tái cấu trúc nếu có. Pipeline giữ nguyên bản JSON đầu vào và băm tệp để tái lập; các thông tin bổ sung không trở thành đặc trưng mô hình.

## Quy tắc thời gian và cổng tối thiểu

Ghép t với t+1 cùng doanh nghiệp, ngày kết thúc cách nhau 365/366 ngày. Chỉ dùng đặc trưng công bố trước khi niên độ mục tiêu kết thúc và trước ngày nhãn mục tiêu công bố. Chia theo **năm nhãn**: train 2017–2021, validation 2022, test 2023–2025. Loại nhãn train chưa công bố ở ngày dự báo holdout sớm nhất. Ngày chỉ có độ phân giải ngày, giả định quyết định cuối ngày công bố; chưa phải backtest trong ngày.

Imputation trung vị và chuẩn hóa chỉ fit train, sau đó Ridge alpha=1 đã chốt trước. Không refit trên validation/test, không chọn ngưỡng dựa trên test. Tối thiểu 50 cặp train, 5 validation, 20 test và 5 doanh nghiệp test. Với 10 công ty và dữ liệu bắt đầu 2016, **50 train là trần lý thuyết**, không phải số chắc chắn đạt: thiếu một năm hay ngày công bố muộn có thể làm hỏng cổng. Không giảm cổng âm thầm; muốn thêm lịch sử phải phê duyệt phiên bản protocol mới.

Khi đủ mẫu, script thật sự fit mô hình và xuất tham số, miền train, metric Ridge/persistence; chỉ đánh dấu đủ điều kiện rà soát nếu MAE thấp hơn persistence trên cả hai holdout theo tiêu chí định trước. `active` vẫn `false`: duyệt độc lập và kiểm tra đầu vào ngoài miền phải hoàn thành trước khi tích hợp công khai. Công thức hệ số JSON được kiểm tra Python/Node trên fixture; đây chưa phải bằng chứng mô hình tài chính thực chạy trong UI.

Không có mô hình nào được huấn luyện trên dữ liệu thực trong bản này. Không có accuracy, MAE thật hay xác suất phá sản để công bố.
