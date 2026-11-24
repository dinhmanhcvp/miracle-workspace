# KOC Booking Workspace

Công cụ cho **agency booking KOC/KOL**: dán brief của brand, tool **tự gợi ý các KOC phù hợp** trong kho KOC của agency (có điểm và lý do), chọn shortlist vừa ngân sách, rồi đi tiếp toàn bộ quy trình booking.

Chạy hoàn toàn trên trình duyệt (HTML + JS thuần), không cần server, có thể host miễn phí trên GitHub Pages.

## Tính năng

| Nhóm | Tab | Chức năng |
|---|---|---|
| Tìm KOC | **Brief & Gợi ý KOC** | Dán brief, tool tự đọc tiêu chí (AI Gemini hoặc bộ đọc từ khóa không cần AI), chấm điểm 0–100 từng KOC kèm lý do, loại KOC trong blacklist / sai nền tảng / vượt ngân sách, tự chọn shortlist theo ngân sách, copy shortlist gửi brand (ẩn giá nhập) hoặc bản nội bộ |
| | **Kho KOC** | Thêm/sửa/xóa KOC; nhập thẳng file `.xlsx` của agency (NB LIST, PRE PNL, Quotation) hoặc dán từ Sheets/CSV, có bảng nhận diện cột để chỉnh; export CSV; **Blacklist** (tên + link + dự án + lý do) |
| Booking | Scouting & Xin Giá | Check blacklist, gợi ý theo ngành, chọn FOC, AI soạn tin xin giá (VI/EN) |
| | Proceed Internal | Internal cost theo template: X, O, E, thuế F (PIT/VAT/HKD), cost backup M theo COMMIT KPI |
| | Proceed External | Giá bán A theo margin mục tiêu (đã trừ giảm giá C, CB G, thuế CB H), hoặc markup / tự nhập; copy dòng báo giá EXT |
| | Confirm Booking | AI soạn tin ép giá; mẫu tin xác nhận |
| Quản lý | Weekly Report | Dòng báo cáo tuần |
| | Kho PNL & Báo cáo | Σ D, VAT 8%, Σ K, margin; copy hàng loạt dạng **PRE PNL (25 cột)**, **NB LIST**, **Báo giá EXT**; báo cáo tuần theo format WEEKLY REPORT |

### Tìm KOC trên TikTok (bán tự động)

- **Gợi ý từ khóa:** từ brief, tool (hoặc AI) tạo danh sách link tìm tài khoản / video / hashtag trên TikTok.
- **Bookmarklet "🪄 Phân tích KOC":** đang xem profile TikTok, bấm 1 lần, tool đọc tên, bio, follower, lượt xem, caption, hashtag các video đang hiển thị; trên trang video thì lấy thêm **phụ đề** và ER thật của video. Sau đó:
  - phân tích theo quy tắc: ngành, view trung vị (bỏ video ghim), ER ước tính, % video có dấu hiệu quảng cáo, hashtag hay dùng
  - nếu có Gemini key: AI nhận xét phong cách, khán giả, an toàn thương hiệu, brand từng quảng cáo, mức phù hợp brief
  - chấm điểm theo brief hiện tại và lưu / cập nhật vào Kho KOC

Tool chỉ đọc dữ liệu trên trang người dùng đang mở (không tự quét TikTok). Cấu trúc trang TikTok có thể thay đổi; khi đó bookmarklet dùng phương án dự phòng đọc từ giao diện.

## Cách chấm điểm KOC

| Tiêu chí | Điểm | Ghi chú |
|---|---|---|
| Ngành | 30 | KOC sai ngành bị nhân hệ số 0,6 trên tổng điểm |
| Ngân sách | 20 | So giá bán ước tính với ngân sách / số KOC |
| Khán giả | 15 | Giới tính, độ tuổi, khu vực |
| Hiệu quả | 15 | ER và tỷ lệ view TB / follower |
| Phân khúc | 10 | Nano / Micro / Mid / Macro / Mega |
| Chất lượng | 10 | Đánh giá nội bộ + khớp từ khóa |

Điều kiện loại bắt buộc: nằm trong blacklist, sai nền tảng yêu cầu, giá vượt tổng ngân sách, KOC đang tạm ngưng.
Giá bán ước tính = (Giá nhập + Thuế) cộng margin theo cài đặt ở tab Proceed External (chưa gồm phí backup).

## Công thức PRE PNL

Theo template PRE PNL của agency:

| Ký hiệu | Ý nghĩa | Công thức |
|---|---|---|
| A, B | Chi phí (đơn giá bán), Số lượng | A tự tính theo margin mục tiêu, hoặc nhập tay |
| C | Giảm giá | A × % giảm giá × B |
| D | Thành tiền | A × B − C |
| X, O, E | Đơn giá booking, Số lượng booking, Total cost | E = X × O |
| F | Thuế booking | PIT: E / 9 · VAT: 0 · HKD: E × 7% |
| G, H | Phí giới thiệu (CB), Thuế CB | G = D × % CB · H = G / 9 |
| M | Cost backup | TikTok View × 3,5 · FB View × 15 + Engagement × 35 · YT View × 35 · IG View × 15 · Threads Engagement × 700 |
| K, L | Lợi nhuận gộp, Margin | K = D − E − F − G − H − M · L = K / D |

## Sử dụng

1. Mở trang (GitHub Pages) hoặc mở `index.html` trực tiếp.
2. ⚙️ **Cài đặt**: nhập tên agency, Gemini API Key (không bắt buộc, lấy tại https://aistudio.google.com) và blacklist.
3. **Kho KOC**: dán danh sách KOC (bấm *File mẫu* để xem đúng cột) hoặc bấm *Dữ liệu mẫu* để thử.
4. **Brief & Gợi ý KOC**: dán brief ➝ *Gợi ý KOC phù hợp* ➝ *Tự chọn shortlist theo ngân sách*.

Hướng dẫn chi tiết: `miracle-guide.html`.

### Dữ liệu được lưu ở đâu?

- **Mặc định:** trong trình duyệt (`localStorage`). Tải lại trang vẫn còn; mất khi xóa dữ liệu trình duyệt, đổi máy/trình duyệt; mỗi người một kho riêng.
- **Dùng chung cả team:** kết nối một **Google Sheet** của công ty qua Google Apps Script (`apps-script/Code.gs`), xem [docs/google-sheets-setup.md](docs/google-sheets-setup.md). Kho KOC, Blacklist, Kho PNL, Báo cáo tuần được đồng bộ hai chiều (sửa trên tool hoặc trực tiếp trên Sheet đều được, bản sửa mới nhất thắng). Không cần server, miễn phí, quyền truy cập bảo vệ bằng mã bí mật.
- Sao lưu thủ công: *Sao lưu (JSON)* ở tab Kho PNL, Export CSV ở Kho KOC.

## Cấu trúc

```
index.html          giao diện
assets/matcher.js   logic thuần: đọc brief, chấm điểm, xếp hạng, shortlist, CSV (chạy được cả trong Node)
assets/app.js       quy trình booking (xin giá, PNL, báo giá, báo cáo, cài đặt, AI)
assets/koc.js       Kho KOC + giao diện Brief & Gợi ý
assets/grab.js      bookmarklet Phân tích KOC + gợi ý tìm kiếm TikTok
assets/sync.js      đồng bộ team qua Google Sheets
apps-script/Code.gs backend Google Apps Script (dán vào Google Sheet của team)
docs/               hướng dẫn cài đặt đồng bộ
miracle-guide.html  hướng dẫn sử dụng
tests/              unit test (Node) + test trình duyệt (Playwright)
```

## Kiểm thử

```bash
node --test tests/matcher.test.js tests/apps-script.test.js   # unit test: chấm điểm, công thức PNL, import, Apps Script
npm i -D playwright xlsx            # nếu chưa có
node tests/run-tests.js             # test trình duyệt: bộ test trong app, end-to-end, bookmarklet, đồng bộ 2 máy qua Sheet giả lập, nhập .xlsx
```
