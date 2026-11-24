# Dữ liệu & bảo mật

Tài liệu này mô tả tool xử lý dữ liệu như thế nào, để agency và bạn trả lời khách hàng / bộ phận pháp chế.

## Dữ liệu nằm ở đâu

| Dữ liệu | Nơi lưu | Ai truy cập |
|---|---|---|
| Kho KOC, Blacklist, Kho PNL, Báo cáo tuần, Cấu hình agency | Trình duyệt của người dùng; nếu bật đồng bộ thì thêm **Google Sheet của chính agency** | Người dùng của agency; người có URL Web App + mã bí mật |
| Brief đang làm, shortlist | Chỉ trình duyệt của người dùng | Người dùng đó |
| Gemini API key, URL đồng bộ, mã bí mật | Chỉ trình duyệt của người dùng | Người dùng đó |

**Nhà cung cấp tool không có máy chủ và không nhận dữ liệu của agency.**

## Dữ liệu gửi ra ngoài

- **Google Gemini** (chỉ khi người dùng bấm các nút AI và đã nhập API key của họ): nội dung brief, thông tin brand/hạng mục, caption và phụ đề video của KOC đang phân tích. Chính sách dữ liệu do Google và loại tài khoản API của agency quyết định. Không có key thì không gửi gì.
- **Google Apps Script / Google Sheets** của agency (khi bật đồng bộ).
- Thư viện giao diện (Font Awesome, Google Fonts) tải từ CDN; không gửi dữ liệu của agency.

## Dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)

Kho KOC và Blacklist có thể chứa dữ liệu cá nhân của KOL (tên, số điện thoại, email, link kênh) và nhận xét nội bộ. Agency là bên kiểm soát dữ liệu này. Khuyến nghị cho agency:
- Chỉ lưu thông tin cần cho công việc booking; Blacklist ghi lý do khách quan, ngắn gọn.
- Giới hạn quyền xem Google Sheet trong team; không công khai Sheet.
- Đổi mã bí mật đồng bộ khi có người nghỉ việc.
- Xóa dữ liệu KOL khi không còn hợp tác / khi được yêu cầu (xóa trong tool → dòng được đánh dấu `deleted` trên Sheet; xóa hẳn dòng trên Sheet sau khi mọi máy đã đồng bộ).

## Bảo mật kỹ thuật

- Nội dung do AI hoặc file nhập vào đều được lọc trước khi hiển thị (chống chèn mã độc).
- API key gửi qua header, không nằm trên URL.
- Web App Apps Script mở "Bất kỳ ai" để trang gọi được, nhưng mọi yêu cầu phải có mã bí mật; sai mã bị từ chối.
- Bookmarklet chỉ đọc trang người dùng đang xem (và file phụ đề của video đó), không tự động quét TikTok.
