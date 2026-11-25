# KOC Booking Workspace

Công cụ cho **agency booking KOC/KOL**: từ brief của brand đến shortlist KOC, PRE PNL, báo giá, chốt booking và báo cáo, cả team dùng chung qua Google Sheets của agency.

Chạy hoàn toàn trên trình duyệt (HTML/CSS/JS tĩnh), không cần máy chủ; host trên Cloudflare Pages / Netlify / GitHub Pages.

## Tính năng

| Nhóm | Tab | Chức năng |
|---|---|---|
| Tìm KOC | **Brief & Gợi ý KOC** | Dán brief → tool đọc tiêu chí (Gemini hoặc bộ đọc từ khóa), chấm điểm 0–100 từng KOC kèm lý do, loại KOC blacklist / sai nền tảng / vượt ngân sách, tự chọn shortlist vừa ngân sách, copy gửi brand (ẩn giá nhập); gợi ý từ khóa & hashtag tìm KOC trên TikTok |
| | **Kho KOC** | Nhập thẳng file `.xlsx` của agency (NB LIST, PRE PNL, Quotation) hoặc dán từ Sheets / CSV, có bảng chỉnh nhận diện cột; **Blacklist** (tên, link, dự án, lý do; khớp theo tên hoặc link) |
| | **Săn KOC mới trên TikTok** (máy tính) | Tool lập kế hoạch tìm kiếm theo brief (từ khóa video, hashtag, tài khoản); trên trang kết quả TikTok web bấm bookmarklet 1 lần → tự cuộn, gom **tất cả KOC trên trang**, nhận diện video gắn giỏ hàng, chấm điểm theo brief → danh sách Ứng viên; AI chấm hàng loạt; **AI tìm KOC trên web** (Gemini + Google Search, đánh dấu chưa xác minh) |
| | Bookmarklet **🪄 Phân tích KOC** | Trên kênh/video TikTok: đọc follower, view, caption, hashtag, phụ đề, tỷ lệ video bán hàng; AI nhận xét; chấm theo brief; lưu Kho KOC. Video không xem được trên web (thường là video gắn giỏ) được nhận biết và hướng dẫn dùng trang profile |
| Booking | Scouting & Xin giá | Check blacklist, chọn FOC, AI soạn tin xin giá (VI/EN) |
| | Proceed Internal / External | PRE PNL đúng template: A B C D · X O E F G H M · K L; giá bán tự tính theo margin mục tiêu; copy PRE PNL / báo giá |
| | Confirm Booking | AI soạn tin ép giá; mẫu tin xác nhận |
| Quản lý | Weekly Report, Kho PNL | Tổng hợp, VAT, agency fee, copy hàng loạt theo format của agency |
| | **Cấu hình agency** | Tên agency, % thuế, % CB, thuế CB, hệ số cost backup, margin mặc định, VAT / agency fee, **thứ tự cột** từng format copy, mẫu tin nhắn, FOC, bản quyền |

Đồng bộ team: Kho KOC, Blacklist, Kho PNL, Báo cáo, Cấu hình qua **Google Sheet của agency** (Apps Script, bản sửa mới nhất thắng, sửa trực tiếp trên Sheet được).

## Công thức PRE PNL (mặc định, chỉnh được trong Cấu hình agency)

| Ký hiệu | Ý nghĩa | Công thức |
|---|---|---|
| A, B | Chi phí (đơn giá bán), Số lượng | A tự tính theo margin mục tiêu, hoặc nhập tay |
| C, D | Giảm giá, Thành tiền | C = A × % giảm giá × B · D = A × B − C |
| X, O, E | Đơn giá booking, Số lượng booking, Total cost | E = X × O |
| F | Thuế booking | PIT 11,1111% (= E / 9) · VAT 0 · HKD 7% |
| G, H | Phí giới thiệu (CB), Thuế CB | G = D × % CB · H = G × 11,1111% |
| M | Cost backup | TikTok View × 3,5 · FB View × 15 + Engagement × 35 · YT View × 35 · IG View × 15 · Threads Engagement × 700 |
| K, L | Lợi nhuận gộp, Margin | K = D − E − F − G − H − M · L = K / D |

## Mô hình sử dụng: trưởng nhóm thiết lập, cả team dùng

1. Trưởng nhóm thiết lập một lần (~30 phút): bản quyền, cấu hình agency, Google Sheet của team, nhập dữ liệu, API key chung (tùy chọn), mã trưởng nhóm.
2. Trưởng nhóm gửi **link mời**; thành viên mở link, nhập tên là dùng chung dữ liệu.
3. Trưởng nhóm theo dõi **Hiệu quả team** (KOC mới, PNL, thành tiền, lợi nhuận, margin, báo cáo theo từng người).

Chi tiết: [docs/huong-dan-truong-nhom.md](docs/huong-dan-truong-nhom.md).

## Dành cho agency

1. Mở địa chỉ web nhà cung cấp gửi, làm theo thẻ **Bắt đầu sử dụng** ở tab đầu tiên.
2. Hướng dẫn chi tiết: `guide.html` (nút *Hướng dẫn sử dụng* trong tool).
3. Đồng bộ team: [docs/google-sheets-setup.md](docs/google-sheets-setup.md). Dữ liệu & bảo mật: [docs/du-lieu-va-bao-mat.md](docs/du-lieu-va-bao-mat.md).

## Dành cho người bán / quản trị

- Triển khai, cấp bản quyền, onboarding, cập nhật: [docs/ban-giao.md](docs/ban-giao.md)
- Bản quyền: `node tools/license.js keygen` (một lần) rồi `node tools/license.js issue --agency "..." --days 365 --domains ...`. Khi `assets/license-key.js` chưa có public key, tool chạy tự do (không dùng thử, không khóa).

```bash
npm install            # công cụ build + thư viện
npm run build          # src/styles.css -> assets/app.css (Tailwind)
npm run vendor         # copy marked, DOMPurify, SheetJS -> assets/vendor
npm test               # unit test + test trình duyệt (cần Playwright)
```

## Cấu trúc

```
index.html, guide.html   giao diện, hướng dẫn
assets/matcher.js        logic thuần: công thức PNL, chấm điểm, đọc brief, import bảng (chạy được trong Node)
assets/app.js            quy trình booking, PNL, báo cáo, cài đặt, AI
assets/config.js         cấu hình agency, format copy, onboarding
assets/koc.js            Kho KOC, Blacklist, import, Brief & gợi ý
assets/grab.js           bookmarklet Phân tích KOC, gợi ý tìm kiếm TikTok
assets/sync.js           đồng bộ Google Sheets
assets/license.js        kiểm tra bản quyền (license-key.js: public key)
assets/app.css           CSS đã build; assets/vendor/: thư viện bên thứ ba
apps-script/Code.gs      backend Apps Script (dán vào Google Sheet của agency)
src/styles.css           nguồn CSS · tools/: license.js, vendor.js · tests/ · docs/
```

## Kiểm thử

```bash
node --test tests/matcher.test.js tests/apps-script.test.js   # công thức PNL, chấm điểm, import, Apps Script (SpreadsheetApp giả lập)
node tests/run-tests.js                                       # trình duyệt: bộ test trong app, E2E gợi ý KOC, bookmarklet trên TikTok giả lập,
                                                              # đồng bộ 2 máy qua Sheet giả lập, nhập .xlsx, cấu hình agency, bản quyền
```
Dữ liệu dùng trong test đều là dữ liệu giả.
