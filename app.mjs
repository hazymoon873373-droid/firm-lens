import { companies, metrics, documents, ratio, change, toCsv } from './data.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const preciseRatio = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const views = new Set(['tong-quan', 'du-lieu', 'phuong-phap', 'de-xuat']);
let ticker = 'VNM';
let chartMetric = 'revenue';

function readRoute() {
  const requested = new URL(location.href).searchParams.get('company');
  ticker = Object.hasOwn(companies, requested) ? requested : 'VNM';
  const requestedView = location.hash.slice(1);
  const view = views.has(requestedView) ? requestedView : 'tong-quan';
  $$('.view').forEach(section => { section.hidden = section.id !== view; });
  $$('[data-view]').forEach(link => {
    if (link.dataset.view === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `FirmLens | ${view === 'tong-quan' ? companies[ticker].name : ({ 'du-lieu': 'Dữ liệu & nguồn', 'phuong-phap': 'Cách hoạt động', 'de-xuat': 'Đề xuất dự thi' })[view]}`;
  renderCompany();
}

function selectCompany(value) {
  const url = new URL(location.href);
  if (value === 'VNM') url.searchParams.delete('company');
  else url.searchParams.set('company', value);
  history.pushState({}, '', url);
  readRoute();
}

function movement(value, suffix = '% so với 2024') {
  if (value === null) return 'Chưa có dữ liệu đối chiếu';
  return `${value > 0 ? 'Tăng' : value < 0 ? 'Giảm' : 'Không đổi'} ${number.format(Math.abs(value))}${suffix}`;
}

function renderCompany() {
  const company = companies[ticker];
  const current = company.years[2025];
  const previous = company.years[2024];
  $$('[data-company]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.company === ticker)));
  $('#data-company').value = ticker;
  $('#company-name').textContent = company.name;
  $('#company-monogram').textContent = company.ticker;
  $('#company-meta').textContent = `${company.ticker} / ${company.sector} / ${company.scope} / ${company.standard}`;
  $('#version-note').textContent = company.sourceNote;
  $('#version-note').classList.toggle('attention', company.provisional);
  const aiSampleLink = $('#open-ai-sample');
  if (aiSampleLink) {
    aiSampleLink.href = `./experiments/browser-ai/index.html?sample=${encodeURIComponent(ticker)}`;
    aiSampleLink.textContent = `Đối chiếu ${company.ticker} bằng AI cục bộ`;
  }
  const debt = ratio(current.liabilities, current.assets);
  const previousDebt = ratio(previous.liabilities, previous.assets);
  const items = [
    ['Doanh thu', current.revenue / 1000, 'tỷ VND', change(current.revenue, previous.revenue)],
    ['Lợi nhuận sau thuế / thuần', current.profit / 1000, 'tỷ VND', change(current.profit, previous.profit)],
    ['Nợ phải trả / tài sản', debt, '%', debt === null || previousDebt === null ? null : debt - previousDebt, ' điểm % so với 2024'],
    ['Dòng tiền kinh doanh', current.cashflow === null ? null : current.cashflow / 1000, 'tỷ VND', change(current.cashflow, previous.cashflow)]
  ];
  $('#metrics').innerHTML = items.map(([label, value, unit, delta, suffix]) => `<article class="metric"><h3>${label}</h3><p class="metric-value">${value === null ? 'Chưa có' : number.format(value)} <span class="metric-unit">${value === null ? '' : unit}</span></p><span class="metric-change">${movement(delta, suffix)}</span></article>`).join('');
  $('#insight-list').innerHTML = company.observations.map((observation, index) => `<article class="insight"><span class="insight-index" aria-hidden="true">0${index + 1}</span><div><span class="insight-kind">${observation.kind}</span><h3>${observation.title}</h3><p>${observation.text}</p><button type="button" class="source-button" data-source="${observation.metric}">Xem bằng chứng</button></div></article>`).join('');
  $('#table-note').textContent = `${company.version}. ${company.sourceNote}`;
  $('#data-caption').textContent = `${company.name}, số liệu ${company.scope.toLowerCase()}, đơn vị triệu VND. ${company.provisional ? 'Dữ liệu gốc làm tròn đến tỷ đồng.' : 'Cơ sở IFRS.'}`;
  $('#data-rows').innerHTML = metrics.map(([key, label]) => `<tr><th scope="row">${label}</th>${[2024, 2025].map(year => `<td class="number${company.years[year][key] === null ? ' missing' : ''}">${company.years[year][key] === null ? 'Chưa nhập' : integer.format(company.years[year][key])}</td>`).join('')}<td>${company.locators[key] ? `<button type="button" class="source-button" data-source="${key}">Xem nguồn</button>` : 'Chưa nhập nguồn'}</td></tr>`).join('');
  const currentRatio = ratio(current.currentAssets, current.currentLiabilities);
  const cashCoverage = ratio(current.cashflow, current.profit);
  const lenses = [
    ['Biên lợi nhuận ròng', ratio(current.profit, current.revenue), '%', 'Lợi nhuận / doanh thu. Phản ánh phần lợi nhuận giữ lại trên mỗi đồng doanh thu.', 'profit'],
    ['Thanh toán hiện hành', currentRatio === null ? null : currentRatio / 100, 'lần', 'Tài sản ngắn hạn / nợ ngắn hạn. Cần đọc thêm cơ cấu tài sản và kỳ hạn nợ.', 'currentAssets'],
    ['Dòng tiền / lợi nhuận', cashCoverage === null ? null : cashCoverage / 100, 'lần', 'Dòng tiền kinh doanh / lợi nhuận. Đọc cùng thay đổi vốn lưu động và khoản phi tiền tệ.', 'cashflow']
  ];
  $('#financial-ratios').innerHTML = lenses.map(([label, value, unit, explanation, source]) => `<article class="ratio-item"><h3>${label}</h3><p class="ratio-value">${value === null ? 'Chưa có dữ liệu' : (unit === 'lần' ? preciseRatio : number).format(value)}${value === null ? '' : ` <span>${unit}</span>`}</p><p>${explanation}</p>${value === null ? '<span class="ratio-missing">Chưa nhập đủ chỉ tiêu đầu vào</span>' : `<button type="button" class="source-button" data-source="${source}">Đối chiếu số liệu gốc</button>`}</article>`).join('');
  renderChart();
}

function renderChart() {
  $$('[data-chart]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.chart === chartMetric)));
  const company = companies[ticker];
  const label = metrics.find(([key]) => key === chartMetric)[1];
  const values = [2024, 2025].map(year => company.years[year][chartMetric]);
  if (values.some(value => value === null)) {
    $('#chart').innerHTML = '<p class="chart-empty">Chưa nhập dòng tiền hợp nhất cho doanh nghiệp này. Cần bổ sung báo cáo lưu chuyển tiền tệ trước khi phân tích.</p>';
    return;
  }
  const billions = values.map(value => value / 1000);
  const ceiling = Math.ceil(Math.max(...billions) * 1.2 / 1000) * 1000;
  const ticks = [0, ceiling / 2, ceiling];
  $('#chart').innerHTML = `<svg viewBox="0 0 480 260" role="img" aria-label="${company.name}, ${label}: năm 2024 là ${number.format(billions[0])} tỷ VND, năm 2025 là ${number.format(billions[1])} tỷ VND"><title>${label} năm 2024 và 2025, trục bắt đầu từ 0</title>${ticks.map(value => {
    const y = 220 - value / ceiling * 172;
    return `<line class="axis-line" x1="66" x2="468" y1="${y}" y2="${y}"/><text x="54" y="${y + 4}" text-anchor="end">${integer.format(value)}</text>`;
  }).join('')}${billions.map((value, index) => {
    const height = value / ceiling * 172;
    const x = 134 + index * 180;
    return `<rect class="bar-${index ? 'after' : 'before'}" x="${x}" y="${220 - height}" width="72" height="${height}"/><text class="bar-label" x="${x + 36}" y="${208 - height}" text-anchor="middle">${number.format(value)}</text><text x="${x + 36}" y="246" text-anchor="middle">${2024 + index}</text>`;
  }).join('')}</svg>`;
}

function renderDocuments() {
  const query = $('#source-search').value.trim().toLocaleLowerCase('vi');
  const matches = documents.filter(doc => `${doc.title} ${doc.type} ${doc.content}`.toLocaleLowerCase('vi').includes(query));
  $('#documents').innerHTML = matches.length ? matches.map(doc => `<article class="document"><div><h3>${doc.title}</h3><p>${doc.type}</p><p>${doc.content}</p></div><span class="document-status">${doc.status}</span><a class="button button-quiet" href="${doc.url}" target="_blank" rel="noopener noreferrer">Mở nguồn<span class="visually-hidden">: ${doc.title}, mở tab mới</span></a></article>`).join('') : '<p class="notice">Không tìm thấy tài liệu phù hợp. Thử một từ khóa khác hoặc xóa bộ lọc.</p>';
}

function showSource(key) {
  const company = companies[ticker];
  const isRisk = key === 'risk';
  const metric = metrics.find(([name]) => name === key);
  if (!isRisk && !metric) return;
  $('#source-title').textContent = isRisk ? 'Thông tin rủi ro được công bố' : metric[1];
  const detail = isRisk ? company.riskExcerpt : `${company.years[2024][key] === null ? 'Chưa nhập số liệu trong bộ mẫu.' : `2024: ${integer.format(company.years[2024][key])} triệu VND. 2025: ${integer.format(company.years[2025][key])} triệu VND.`}`;
  $('#source-content').innerHTML = `<p>${detail}</p><dl><dt>Doanh nghiệp</dt><dd>${company.legalName}</dd><dt>Tài liệu gốc</dt><dd>${company.sourceFile}</dd><dt>Vị trí</dt><dd>${isRisk ? company.riskLocator : company.locators[key] ?? 'Chưa nhập nguồn'}</dd><dt>Phạm vi</dt><dd>${company.scope}; ${company.standard}</dd><dt>Phiên bản</dt><dd>${company.version}</dd></dl><p class="caption">${company.sourceNote}</p><p><a href="${company.sourceUrl}" target="_blank" rel="noopener noreferrer">Mở website công bố của doanh nghiệp</a></p>${company.updatedUrl ? `<p><a href="${company.updatedUrl}" target="_blank" rel="noopener noreferrer">Xem bản cập nhật ngày 25/06/2026</a></p>` : ''}`;
  $('#source-dialog').showModal();
}

document.addEventListener('click', event => {
  const sourceButton = event.target.closest('[data-source]');
  if (sourceButton) showSource(sourceButton.dataset.source);
});
$('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  $('#main').focus();
});
$$('[data-company]').forEach(button => button.addEventListener('click', () => selectCompany(button.dataset.company)));
$('#data-company').addEventListener('change', event => selectCompany(event.target.value));
$$('[data-chart]').forEach(button => button.addEventListener('click', () => { chartMetric = button.dataset.chart; renderChart(); }));
$('#source-search').addEventListener('input', renderDocuments);
$('#close-dialog').addEventListener('click', () => $('#source-dialog').close());
$$('.export-csv').forEach(button => button.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([toCsv(companies[ticker])], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `FirmLens_${ticker}_2024_2025.csv`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}));
$('#share-button').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('#share-status').textContent = 'Đã sao chép đường dẫn hiện tại.';
  } catch {
    $('#share-status').textContent = `Có thể sao chép đường dẫn từ thanh địa chỉ: ${location.href}`;
  }
});
window.addEventListener('hashchange', () => {
  readRoute();
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('#main').focus({ preventScroll: true });
});
window.addEventListener('popstate', readRoute);
readRoute();
renderDocuments();
