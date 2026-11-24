# Hướng dẫn cho trưởng nhóm booking

Bạn thiết lập **một lần (~30 phút)**, sau đó gửi **một link** cho cả team. Thành viên mở link, nhập tên là dùng được ngay với dữ liệu chung.

## Phần 1. Thiết lập (trưởng nhóm, một lần)

1. **Mở tool** theo địa chỉ nhà cung cấp gửi. Ở tab *Brief & Gợi ý KOC* có thẻ **Bắt đầu sử dụng** dẫn từng bước.
2. **Kích hoạt bản quyền**: *Cấu hình agency › Mã bản quyền › Kích hoạt*.
3. **Cấu hình agency** (tab *Cấu hình agency*):
   - Công thức theo cách team bạn tính PNL: % thuế PIT / HKD, thuế CB, hệ số cost backup (COMMIT KPI), margin / giảm giá / CB mặc định, VAT, agency fee.
   - **Format copy**: thứ tự cột khớp file PRE PNL, NB LIST, báo giá của team.
   - Mẫu tin nhắn, danh sách FOC.
   - Bấm **Lưu cấu hình**. Nên **Xuất cấu hình** để lưu hồ sơ.
4. **Google Sheet của team** (để mọi người dùng chung): làm theo [google-sheets-setup.md](google-sheets-setup.md) (~5 phút), sau đó *Cài đặt › Đồng bộ Google Sheets*: dán URL + mã bí mật + tên của bạn.
5. **Nạp dữ liệu cũ**: *Kho KOC › Nhập từ Excel / Sheets / CSV*: chọn file NB LIST / PRE PNL (tool tự nhận cột, tự chọn sheet); nhập sheet BLACKLIST vào *Blacklist*.
6. **AI (tùy chọn)**: tạo Gemini API key tại aistudio.google.com, dán vào *Cấu hình agency › API key dùng chung cho team* (nên đặt giới hạn chi phí). Thành viên không cần tự tạo key.
7. **Mã trưởng nhóm**: *Cấu hình agency › Team & phân quyền › Đặt mã*. Từ đó chỉ bạn sửa được cấu hình và xóa toàn bộ kho; thành viên vẫn thêm / sửa KOC, PNL, báo cáo bình thường.
8. **Tạo link mời**: *Cấu hình agency › Team & phân quyền › Tạo link mời* → copy, gửi vào nhóm chat nội bộ của team.

## Phần 2. Thành viên (mỗi người ~2 phút)

1. Mở link mời trên máy làm việc (Chrome / Edge / Cốc Cốc).
2. Nhập tên → **Tham gia**. Kho KOC, Blacklist, cấu hình, PNL của team tự tải về.
3. Bấm **Magic Bookmarklet** (menu trái) → kéo nút **🪄 Phân tích KOC** lên thanh dấu trang.
4. Đọc nhanh *Hướng dẫn sử dụng*. Xong.

## Phần 3. Quản lý hằng tuần

- **Kho PNL & Báo cáo › Hiệu quả team**: theo tuần / tháng, xem mỗi người thêm bao nhiêu KOC, lập bao nhiêu dòng PNL, tổng thành tiền, lợi nhuận, margin, số báo cáo, lần hoạt động gần nhất.
- **Copy PRE PNL / NB LIST / báo giá** của cả team ra Excel theo đúng format đã cấu hình.
- Google Sheet của team luôn có bản sao toàn bộ dữ liệu; có thể lọc, xem lịch sử phiên bản của Google Sheets.

## Khi có người nghỉ việc

1. Apps Script › *Cài đặt dự án › Thuộc tính tập lệnh* › đổi `SYNC_TOKEN`.
2. *Cài đặt* trên máy bạn: dán mã mới › Lưu.
3. *Cấu hình agency › Tạo link mời* mới, gửi lại cho các thành viên còn lại (mỗi người mở link, nhập tên).

## Câu hỏi thường gặp

- **Mất mạng thì sao?** Vẫn làm việc bình thường; khi có mạng tool tự đồng bộ.
- **Hai người sửa cùng một KOC?** Bản sửa sau cùng được giữ.
- **Thành viên xóa nhầm 1 KOC?** Dòng trên Google Sheet được đánh dấu `deleted`; đặt lại thành trống (FALSE) trên Sheet để khôi phục.
- **Đổi máy?** Mở lại link mời trên máy mới.
