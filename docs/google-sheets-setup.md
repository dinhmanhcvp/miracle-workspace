# Đồng bộ dữ liệu team qua Google Sheets

Mặc định tool lưu dữ liệu trong trình duyệt của từng người. Làm theo các bước dưới đây (khoảng 5 phút, chỉ cần làm **1 lần cho cả team**) để mọi người dùng chung **Kho KOC, Blacklist, Kho PNL và Báo cáo tuần** qua một Google Sheet của công ty.

## 1. Tạo Google Sheet và gắn script

1. Tạo một Google Sheet mới trong Drive công ty, đặt tên, ví dụ `KOC Database`.
2. Menu **Tiện ích mở rộng › Apps Script**.
3. Xóa đoạn code mẫu, dán toàn bộ nội dung file [`apps-script/Code.gs`](../apps-script/Code.gs) (trong tool: Hướng dẫn › mục Đồng bộ › nút *Copy mã Apps Script*). Bấm **Lưu**.
4. Ở thanh trên, chọn hàm **`setup`** › bấm **Chạy**. Google sẽ hỏi cấp quyền:
   - Chọn tài khoản công ty › nếu thấy "Google chưa xác minh ứng dụng này": **Nâng cao › Đi tới … (không an toàn)**. Đây là script của chính bạn, chỉ truy cập Sheet này.
5. Mở **Nhật ký thực thi** (Execution log): copy dòng **Mã bí mật (token)**.

## 2. Triển khai thành Web App

1. **Triển khai › Tùy chọn triển khai mới** (Deploy › New deployment).
2. Bánh răng › chọn loại **Ứng dụng web** (Web app).
3. *Thực thi với tư cách*: **Tôi**. *Người có quyền truy cập*: **Bất kỳ ai** (Anyone).
4. **Triển khai** › copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).

> "Bất kỳ ai" là cần thiết để trang tool gọi được script. Dữ liệu vẫn được bảo vệ bằng **mã bí mật**: không có mã thì không đọc/ghi được.

## 3. Kết nối từng máy

Trong tool: **⚙️ Cài đặt › Đồng bộ Google Sheets**
- Dán **Web App URL** và **Mã bí mật**, nhập tên của bạn.
- **Kiểm tra kết nối** › **Lưu**.

Lần kết nối đầu, dữ liệu sẵn có trên máy sẽ được đẩy lên Sheet (dữ liệu mẫu `[Mẫu]` không được đẩy). Gửi URL + mã bí mật cho thành viên khác qua kênh nội bộ (không đăng công khai).

Góc dưới menu trái hiển thị trạng thái: *Đã đồng bộ hh:mm*, *Có thay đổi chưa đồng bộ*, hoặc lỗi. Bấm vào để đồng bộ ngay.

## Cách hoạt động

- Tool đồng bộ khi mở trang, vài giây sau mỗi thay đổi, khi quay lại tab và mỗi phút một lần.
- Mỗi dòng có `id` và `updatedAt`; **bản sửa mới nhất thắng** nếu hai người sửa cùng một dòng.
- **Sửa trực tiếp trên Sheet** được: sửa ô nào, cột `updatedAt` tự cập nhật và thay đổi về tool ở lần đồng bộ sau. **Thêm dòng mới** trên Sheet (chỉ cần cột Tên) cũng được.
- **Xóa**: xóa trong tool, hoặc đặt cột `deleted` = `TRUE` trên Sheet. Đừng xóa hẳn dòng trên Sheet nếu còn máy chưa đồng bộ.
- Các số ở sheet *Kho PNL* do tool tính theo công thức PRE PNL; sửa số trên Sheet sẽ không được tính lại. Các cột chữ (Tên, Contact, Link, Hạng mục, Payment term) sửa được.
- Không đồng bộ: brief đang làm, shortlist, Gemini API key (riêng từng máy).

## Bảo mật & bảo trì

- Đổi mã bí mật: Apps Script › **Cài đặt dự án › Thuộc tính tập lệnh** › sửa `SYNC_TOKEN`, rồi gửi mã mới cho team.
- Cập nhật script khi tool có phiên bản mới: dán `Code.gs` mới › **Triển khai › Quản lý triển khai** › sửa › *Phiên bản mới* (URL giữ nguyên).
- Ngắt đồng bộ trên một máy: Cài đặt › **Ngắt kết nối** (dữ liệu trên máy và Sheet giữ nguyên).
