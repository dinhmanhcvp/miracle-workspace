# Triển khai & bàn giao cho một agency

Checklist dành cho bạn (người bán) khi bàn giao tool cho một agency khách hàng. Mỗi agency nên có **bản triển khai riêng** (địa chỉ web riêng) và **Google Sheet riêng** của họ.

## 0. Chuẩn bị một lần (chỉ bạn làm)

1. Cài Node.js 18+ và chạy `npm install` trong thư mục dự án.
2. Tạo cặp khóa ký bản quyền (làm **một lần duy nhất**):
   ```bash
   node tools/license.js keygen --vendor "Tên công ty / tên bạn" --contact "email hoặc Zalo"
   ```
   - Private key nằm ở `~/.koc-license/private.pem`: **giữ bí mật, sao lưu cẩn thận**. Mất file này thì không cấp mã mới được; lộ file này thì ai cũng tự cấp mã được.
   - Public key được ghi vào `assets/license-key.js`: commit file này. Từ lúc này tool bật chế độ bản quyền (dùng thử 14 ngày, sau đó cần mã).
3. Sau khi sửa giao diện: `npm run build` (tạo `assets/app.css`). Sau khi nâng cấp thư viện: `npm run vendor`.
4. Kiểm thử trước mỗi lần giao bản mới: `npm test` (cần Playwright: `npm i -g playwright && npx playwright install chromium`).

## 1. Triển khai bản web cho agency

Tool là trang tĩnh (HTML/CSS/JS), host ở đâu cũng được. Khuyên dùng **Cloudflare Pages** hoặc **Netlify** (miễn phí, https, repo private được):

- Kết nối repo (private) › Build command: *(để trống)* › Output directory: `/` (thư mục gốc).
- Đặt tên dự án theo agency, ví dụ `abc-media-koc.pages.dev`, hoặc gắn tên miền riêng của agency.
- Bắt buộc **https** (cần cho kiểm tra bản quyền và đồng bộ).

Các file cần có trên bản triển khai: `index.html`, `guide.html`, `assets/`, `apps-script/Code.gs`. Không cần `node_modules/`, `src/`, `tests/`, `tools/`.

## 2. Cấp bản quyền

```bash
node tools/license.js issue --agency "ABC Media" --days 365 --plan "Pro" --domains abc-media-koc.pages.dev
```
- `--domains`: mã chỉ chạy trên địa chỉ đó (chống đem mã sang bản triển khai khác). Có thể ghi nhiều tên miền, cách nhau dấu phẩy.
- Tên agency trong mã sẽ là tên hiển thị trong tool và trong tin nhắn gửi KOC (agency không tự đổi được).
- Gửi mã cho agency; họ dán vào **Cấu hình agency › Mã bản quyền › Kích hoạt** (một người kích hoạt, cả team nhận qua Google Sheet).
- Gia hạn: cấp mã mới với `--days` mới, agency dán đè mã cũ. Kiểm tra một mã: `node tools/license.js verify <mã>`.

> Giới hạn: tool chạy hoàn toàn trên trình duyệt nên bản quyền là **rào cản**, không phải chống bẻ khóa tuyệt đối. Người biết sửa code có thể gỡ. Muốn kiểm soát chặt (khóa theo tài khoản, thu hồi tức thì) cần phiên bản có máy chủ riêng.

## 3. Thiết lập cho agency (buổi onboarding ~1 giờ)

Mô hình khuyên dùng: bán cho **trưởng nhóm booking**. Trưởng nhóm làm theo [huong-dan-truong-nhom.md](huong-dan-truong-nhom.md) (có thể bạn ngồi cùng 30 phút), sau đó gửi **link mời** cho thành viên; thành viên chỉ cần mở link, nhập tên.


Thẻ **"Bắt đầu sử dụng"** trong tab Brief liệt kê đủ các bước:

1. **Cấu hình agency**: tên, % thuế, % CB, thuế CB, hệ số cost backup theo COMMIT KPI của họ, margin mặc định, VAT / agency fee, **thứ tự cột** khớp file Excel của họ (PRE PNL, NB LIST, báo giá), mẫu tin nhắn, danh sách FOC. Xuất cấu hình ra JSON để lưu hồ sơ.
2. **Google Sheet** của agency (Drive công ty họ): làm theo [google-sheets-setup.md](google-sheets-setup.md). Sheet thuộc sở hữu của agency; bạn không cần quyền truy cập.
3. **Nhập dữ liệu**: file NB LIST / PRE PNL cũ vào Kho KOC, sheet BLACKLIST vào Blacklist.
4. **Gemini API key**: mỗi người tự tạo tại aistudio.google.com (hoặc agency dùng key công ty). Không có key, tool vẫn chạy bằng văn mẫu.
5. **Bookmarklet "Phân tích KOC"**: từng người cài từ địa chỉ web của agency.
6. Đối chiếu 2–3 dòng PNL do tool tính với file Excel của họ trước khi dùng thật.

## 4. Cập nhật phiên bản

- Đẩy code mới lên repo → Cloudflare/Netlify tự triển khai lại; dữ liệu của agency không bị ảnh hưởng (nằm trong Google Sheet / trình duyệt của họ).
- Nếu `apps-script/Code.gs` thay đổi: hướng dẫn agency dán bản mới và **Quản lý triển khai › Phiên bản mới** (URL giữ nguyên).

## 5. Hỗ trợ

- Lỗi tính toán: xin agency file **Xuất cấu hình** + 1 dòng PNL mẫu.
- Lỗi đồng bộ: trạng thái ở góc trái dưới cho biết nguyên nhân (sai mã bí mật, URL chưa mở quyền "Bất kỳ ai"...).
- Bookmarklet không đọc được: TikTok có thể đổi giao diện; xin ảnh chụp trang và báo lỗi để cập nhật `assets/grab.js`.
