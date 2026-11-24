# KOC Booking Workspace

Công cụ cho **agency booking KOC/KOL**: dán brief của brand, tool **tự gợi ý các KOC phù hợp** trong kho KOC của agency (có điểm và lý do), chọn shortlist vừa ngân sách, rồi đi tiếp toàn bộ quy trình booking.

Chạy hoàn toàn trên trình duyệt (HTML + JS thuần), không cần server, có thể host miễn phí trên GitHub Pages.

## Tính năng

| Nhóm | Tab | Chức năng |
|---|---|---|
| Tìm KOC | **Brief & Gợi ý KOC** | Dán brief, tool tự đọc tiêu chí (AI Gemini hoặc bộ đọc từ khóa không cần AI), chấm điểm 0–100 từng KOC kèm lý do, loại KOC trong blacklist / sai nền tảng / vượt ngân sách, tự chọn shortlist theo ngân sách, copy shortlist gửi brand (ẩn giá nhập) hoặc bản nội bộ |
| | **Kho KOC** | Thêm/sửa/xóa KOC; dán thẳng từ Excel/Google Sheets; import/export CSV; file mẫu; dữ liệu mẫu để dùng thử |
| Booking | Scouting & Xin Giá | Check blacklist, gợi ý theo ngành, chọn FOC, AI soạn tin xin giá (VI/EN) |
| | Proceed Internal | Thuế (PIT/VAT/HKD), phí backup theo nền tảng, tổng giá vốn; copy dòng PRE PNL 22 cột |
| | Proceed External | Giá bán theo Margin mục tiêu hoặc Markup; copy dòng báo giá |
| | Confirm Booking | AI soạn tin ép giá; mẫu tin xác nhận |
| Quản lý | Weekly Report | Dòng báo cáo tuần |
| | Kho PNL & Báo cáo | Dashboard doanh thu/lợi nhuận, copy hàng loạt, sao lưu/khôi phục JSON |

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

## Sử dụng

1. Mở trang (GitHub Pages) hoặc mở `index.html` trực tiếp.
2. ⚙️ **Cài đặt**: nhập tên agency, Gemini API Key (không bắt buộc, lấy tại https://aistudio.google.com) và blacklist.
3. **Kho KOC**: dán danh sách KOC (bấm *File mẫu* để xem đúng cột) hoặc bấm *Dữ liệu mẫu* để thử.
4. **Brief & Gợi ý KOC**: dán brief ➝ *Gợi ý KOC phù hợp* ➝ *Tự chọn shortlist theo ngân sách*.

Hướng dẫn chi tiết: `miracle-guide.html`.

**Dữ liệu** lưu trong `localStorage` của trình duyệt đang dùng, mỗi người một kho riêng. Chia sẻ kho KOC qua Export/Import CSV; sao lưu PNL bằng nút *Sao lưu (JSON)*.

## Cấu trúc

```
index.html          giao diện
assets/matcher.js   logic thuần: đọc brief, chấm điểm, xếp hạng, shortlist, CSV (chạy được cả trong Node)
assets/app.js       quy trình booking (xin giá, PNL, báo giá, báo cáo, cài đặt, AI)
assets/koc.js       Kho KOC + giao diện Brief & Gợi ý
assets/grab.js      bookmarklet Phân tích KOC + gợi ý tìm kiếm TikTok
miracle-guide.html  hướng dẫn sử dụng
tests/              unit test (Node) + test trình duyệt (Playwright)
```

## Kiểm thử

```bash
node --test tests/matcher.test.js   # unit test bộ chấm điểm
npm i -D playwright                 # nếu chưa có
node tests/run-tests.js             # test trình duyệt: bộ test trong app, end-to-end, bookmarklet trên trang TikTok giả lập
```
