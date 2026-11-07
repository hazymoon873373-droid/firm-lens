// Values are millions of VND. DGC's source rounds to billions; preserve that precision in provenance.
export const companies = {
  VNM: {
    ticker: 'VNM', name: 'Vinamilk', legalName: 'Công ty Cổ phần Sữa Việt Nam',
    sector: 'Sữa và thực phẩm', standard: 'IFRS', scope: 'Hợp nhất', unit: 'triệu VND',
    provisional: false, version: 'Báo cáo thường niên 2025, phần IFRS',
    sourceFile: '2025.pdf', sourceUrl: 'https://www.vinamilk.com.vn/investor/reports/financial?year=2025',
    sourceNote: 'Mẫu trích từ phần IFRS, không trộn với số liệu VAS trong cùng báo cáo. Chỉ có hai năm; chưa đủ dữ liệu dự báo.',
    locators: { revenue: 'Trang in 216, trang PDF 109', profit: 'Trang in 216, trang PDF 109', assets: 'Trang in 214, trang PDF 108', equity: 'Trang in 215, trang PDF 108', liabilities: 'Trang in 215, trang PDF 108', cashflow: 'Trang in 218, trang PDF 110', currentAssets: 'Trang in 214, trang PDF 108', currentLiabilities: 'Trang in 215, trang PDF 108', inventory: 'Trang in 214, trang PDF 108' },
    years: {
      2024: { revenue: 52576991, profit: 8686245, assets: 56993245, equity: 37165930, liabilities: 19827315, cashflow: 9770587, currentAssets: 37501520, currentLiabilities: 18500425, inventory: 5634710 },
      2025: { revenue: 54248830, profit: 8505216, assets: 56091826, equity: 35569652, liabilities: 20522174, cashflow: 8948878, currentAssets: 36207454, currentLiabilities: 18603319, inventory: 6555827 }
    },
    observations: [
      { title: 'Doanh thu và lợi nhuận đi khác chiều', text: 'Doanh thu tăng trong khi lợi nhuận thuần giảm so với năm 2024. Cần đọc thêm cơ cấu chi phí và các khoản thu nhập.', metric: 'profit', kind: 'Tín hiệu từ số liệu' },
      { title: 'Dòng tiền kinh doanh cần theo dõi', text: 'Dòng tiền kinh doanh vẫn dương nhưng thấp hơn năm trước. Hai năm dữ liệu chưa đủ kết luận xu hướng dài hạn.', metric: 'cashflow', kind: 'Tín hiệu từ số liệu' },
      { title: 'Bối cảnh chuỗi cung ứng', text: 'Báo cáo đề cập rủi ro thuế quan, vận chuyển và thời tiết cực đoan. Đây là rủi ro được công bố, chưa chứng minh đã gây thiệt hại.', metric: 'risk', kind: 'Thông tin định tính' }
    ],
    riskLocator: 'Báo cáo quản trị rủi ro, trang in 189, trang PDF 95',
    riskExcerpt: 'Báo cáo mô tả biến động thương mại, chi phí logistics và tác động của thời tiết lên chuỗi cung ứng.'
  },
  DGC: {
    ticker: 'DGC', name: 'Hóa chất Đức Giang', legalName: 'Công ty Cổ phần Tập đoàn Hóa chất Đức Giang',
    sector: 'Hóa chất', standard: 'Theo bảng tổng hợp của doanh nghiệp', scope: 'Hợp nhất', unit: 'triệu VND',
    provisional: true, version: 'Bản công bố 07/04/2026, số liệu công ty lập',
    sourceFile: 'DGC_2025.docx', sourceUrl: 'https://ducgiangchem.vn/category/quan-he-co-dong/bao-cao-thuong-nien/',
    updatedUrl: 'https://ducgiangchem.vn/cbtt-bao-cao-thuong-nien-nam-2025-cap-nhat-theo-bctc-kiem-toan-2025/',
    sourceNote: 'Bản lịch sử tháng 4/2026, chưa thay bằng bản cập nhật kiểm toán ngày 25/06/2026. Bảng gốc làm tròn theo tỷ đồng, đã quy đổi sang triệu VND. Không dùng làm dữ liệu mới nhất.',
    locators: { revenue: 'Mục III.1.2, trang in 19, nhãn Trang PDF 21 trong bản Word', profit: 'Mục III.1.2, trang in 19, nhãn Trang PDF 21 trong bản Word', assets: 'Mục III.1.2, trang in 19, nhãn Trang PDF 21 trong bản Word', equity: 'Mục III.1.2, trang in 19, nhãn Trang PDF 21 trong bản Word', liabilities: 'Mục III.1.2, trang in 20, nhãn Trang PDF 22 trong bản Word' },
    years: {
      2024: { revenue: 9864000, profit: 3107000, assets: 15821000, equity: 13701000, liabilities: 2120000, cashflow: null, currentAssets: null, currentLiabilities: null, inventory: null },
      2025: { revenue: 11262000, profit: 3188000, assets: 19550000, equity: 15406000, liabilities: 4144000, cashflow: null, currentAssets: null, currentLiabilities: null, inventory: null }
    },
    observations: [
      { title: 'Doanh thu tăng nhanh hơn lợi nhuận', text: 'Trong bản số liệu công ty lập, tăng trưởng lợi nhuận sau thuế thấp hơn tăng trưởng doanh thu. Cần đối chiếu với bản kiểm toán cập nhật.', metric: 'profit', kind: 'Tín hiệu từ số liệu' },
      { title: 'Nợ phải trả tăng so với nền năm trước', text: 'Nợ phải trả tăng từ 2.120 lên 4.144 tỷ đồng trong bảng mẫu. Đây là tổng nợ phải trả, không phải riêng nợ vay.', metric: 'liabilities', kind: 'Tín hiệu từ số liệu' },
      { title: 'Chưa đủ dữ liệu dòng tiền', text: 'Mẫu hiện chưa nhập dòng tiền hợp nhất. Hệ thống giữ trạng thái thiếu dữ liệu, không thay bằng số 0.', metric: 'cashflow', kind: 'Giới hạn dữ liệu' }
    ],
    riskLocator: 'Mục Các rủi ro, trang in 8, nhãn Trang PDF 10 trong bản Word',
    riskExcerpt: 'Báo cáo nêu rủi ro môi trường, thiên tai, dịch bệnh và thay đổi chính sách có thể ảnh hưởng hoạt động.'
  }
};

export const metrics = [
  ['revenue', 'Doanh thu'], ['profit', 'Lợi nhuận sau thuế / thuần'],
  ['assets', 'Tổng tài sản'], ['equity', 'Vốn chủ sở hữu'],
  ['liabilities', 'Nợ phải trả'], ['cashflow', 'Dòng tiền kinh doanh'],
  ['currentAssets', 'Tài sản ngắn hạn'], ['currentLiabilities', 'Nợ ngắn hạn'],
  ['inventory', 'Hàng tồn kho']
];
export const documents = [
  { title: 'Báo cáo thường niên Vinamilk 2025', type: 'Báo cáo doanh nghiệp', content: 'Số liệu IFRS hợp nhất 2024, 2025; thông tin quản trị rủi ro.', url: companies.VNM.sourceUrl, status: 'Có số liệu mẫu' },
  { title: 'Báo cáo thường niên Đức Giang 2025', type: 'Bản trích xuất OCR', content: 'Bản tháng 4/2026; số liệu công ty lập, cần đối chiếu bản cập nhật kiểm toán.', url: companies.DGC.updatedUrl, status: 'Bản lịch sử' },
  { title: 'Measuring firm-level supply chain risk using a generative large language model', type: 'Finance Research Letters, 2025', content: 'Tham khảo cách nhận diện rủi ro trong văn bản; dữ liệu hỏi đáp doanh nghiệp Trung Quốc.', url: 'https://doi.org/10.1016/j.frl.2025.107111', status: 'Cơ sở phương pháp' },
  { title: 'Digital innovation and supply chain risk: A large language model-based analysis', type: 'Pacific-Basin Finance Journal, 2025', content: 'Tham khảo cách kiểm chứng chỉ báo rủi ro; không phải mô hình dự báo sức khỏe doanh nghiệp Việt Nam.', url: 'https://doi.org/10.1016/j.pacfin.2025.102799', status: 'Cơ sở phương pháp' }
];

export function ratio(numerator, denominator) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0 ? numerator / denominator * 100 : null;
}
export function change(current, previous) {
  return Number.isFinite(current) && Number.isFinite(previous) && previous !== 0 ? (current - previous) / Math.abs(previous) * 100 : null;
}
export function toCsv(company) {
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const rows = [['Mã chỉ tiêu', 'Chỉ tiêu', '2024', '2025', 'Đơn vị', 'Doanh nghiệp', 'Phạm vi', 'Chuẩn / cơ sở', 'Phiên bản', 'Vị trí nguồn', 'URL nguồn'], ...metrics.map(([key, label]) => [key, label, company.years[2024][key], company.years[2025][key], company.unit, company.ticker, company.scope, company.standard, company.version, company.locators[key] ?? 'Chưa nhập', company.sourceUrl])];
  return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
}
