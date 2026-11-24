# The Miracle Workspace

Công cụ nội bộ (1 file HTML, không cần server) hỗ trợ quy trình **Booking KOC/KOL** từ A–Z:

| Bước | Tính năng |
|---|---|
| 1. Scouting & Xin Giá | Check blacklist (có thể bổ sung trong Cài đặt), gợi ý theo ngành, chọn FOC, AI soạn tin nhắn xin giá (VI/EN) |
| 2. Proceed Internal | Tính thuế (PIT/VAT/HKD), phí backup theo nền tảng, tổng giá vốn; copy dòng PRE PNL 22 cột; lưu vào kho |
| 3. Proceed External | Tính giá bán theo **Margin mục tiêu** hoặc **Markup**; copy dòng báo giá cho khách |
| 4. Confirm Booking | AI soạn tin nhắn ép giá (VI/EN); mẫu tin nhắn xác nhận |
| 5. Weekly Report | Tạo/lưu dòng báo cáo tuần |
| 6. Kho dữ liệu | Dashboard doanh thu/lợi nhuận, copy hàng loạt ra Excel, xóa từng dòng, sao lưu/khôi phục JSON |

Thêm: **Magic Bookmarklet** lấy Tên/Link/Follower từ TikTok/YouTube/Facebook và điền sẵn vào Bước 2.

## Sử dụng

Mở `index.html` bằng trình duyệt (double-click hoặc host trên GitHub Pages). Hướng dẫn chi tiết: `miracle-guide.html`.

- **AI:** vào ⚙️ Cài đặt, dán Gemini API Key (lấy tại https://aistudio.google.com). Model mặc định `gemini-2.5-flash`, đổi được trong Cài đặt. Không có key hoặc AI lỗi thì tool tự dùng văn mẫu.
- **Dữ liệu** lưu trong `localStorage` của trình duyệt đang dùng. Hãy dùng nút **Sao lưu (JSON)** ở Bước 6 để không mất dữ liệu.

## Công thức tính

- Thuế: PIT = Lương / 9 · VAT = 0 · HKD = Lương × 7%
- Backup = KPI × hệ số (TikTok 3,5 · FB 35 · YT 35 · Threads 700)
- Tổng giá vốn = Lương + Thuế + Backup
- Giá bán: Margin → `Giá vốn / (1 − m%)`; Markup → `Giá vốn × (1 + m%)`
- Lợi nhuận gộp = Giá bán − Tổng giá vốn

## Kiểm thử

```bash
npm i -D playwright   # nếu chưa có
node tests/run-tests.js
```

Hoặc trong app: ⚙️ Cài đặt → **Chạy test**. Bộ test chạy trên bản sao trạng thái và **không** thay đổi dữ liệu thật.
