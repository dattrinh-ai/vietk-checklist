# VietK Checklist + VietK CRM

Hệ thống quản lý công việc và bán hàng cho **VietK** (giải pháp karaoke & âm thanh, phân phối BBS Prosound).
Hai app web dùng **chung một cơ sở dữ liệu Supabase và chung tài khoản đăng nhập**:

| App | Dùng để | Thư mục / repo |
|---|---|---|
| **VietK Checklist** | Việc hằng ngày, bắt đầu ngày làm việc (giờ + vị trí), báo cáo ngày/tuần, KPI, nghỉ phép, trợ lý AI | `vietk-checklist` |
| **VietK CRM** | Khách hàng & chăm sóc, sản phẩm & combo, báo giá / đơn hàng, thu tiền, lịch lắp đặt | `vietk-crm` |

Lịch lắp đặt tạo trong CRM **tự hiện thành việc** trong mục "Hôm nay" của kỹ thuật viên bên Checklist. Kỹ thuật viên bấm **Xong** → CRM tự chuyển lịch sang "Đã lắp xong" (bấm **Vướng** → lịch chuyển "Có vướng").

## Vai trò

| | Nhân viên | Quản lý bộ phận | Giám đốc / Quản trị | Chỉ xem |
|---|---|---|---|---|
| Checklist của mình, báo cáo | ✓ | ✓ | ✓ | — |
| Xem / duyệt báo cáo | — | nhóm mình | tất cả | xem tổng quan |
| CRM: khách hàng | của mình + chưa ai nhận + khách có lịch lắp giao cho mình | thêm khách của nhóm | tất cả | — |
| CRM: giá vốn, lãi | — | — | ✓ | — |
| Sửa sản phẩm, combo, giá | — | — | ✓ | — |
| Việc riêng 🔒, thói quen, trợ lý AI | — | — | ✓ | — |

Giờ làm: **thứ 2 – thứ 7, 8:30 – 17:30**, báo cáo ngày trước 17:30 (cả thứ 7), báo cáo tuần nộp thứ 7. Đổi trong Checklist → Cài đặt → Giờ làm, vị trí & quyền.

## Hướng dẫn Quản trị

**Thêm nhân viên**: Checklist → Thêm → Cài đặt → Nhân sự → **+ Thêm người**. Nhập email, mật khẩu tạm, vai trò, phòng ban, loại nhân sự.
- Kỹ thuật viên chọn loại **"Kỹ thuật làm ngoài"**: không bị kiểm tra vị trí khi bắt đầu ngày, và CRM mở thẳng lịch lắp đặt.
- Ô **"Được dùng VietK CRM"** bật sẵn. Bỏ tick nếu người đó không cần CRM.
- Nhân viên nghỉ việc: mở hồ sơ người đó → tick **Đã nghỉ việc (khoá)**. Dữ liệu cũ vẫn giữ nguyên.

**Phòng ban, việc lặp lại, KPI**: Cài đặt → Phòng ban / Routine. Trang KPI có gợi ý KPI cho từng phòng.

**Vị trí văn phòng**: làm khi đang ở văn phòng, máy bắt wifi công ty. Vào Cài đặt → Giờ làm, vị trí & quyền → tick ghi nhận vị trí → bấm "+ Thêm IP mạng tôi đang dùng" → bấm "Lấy vị trí hiện tại làm văn phòng" → Lưu.

**Sản phẩm & combo**: CRM → Sản phẩm. Thêm sản phẩm (giá lẻ, giá đại lý, 🔒 giá vốn, bảo hành, có quản lý serial hay không), rồi tạo combo.

**Sao lưu dữ liệu**: gói Supabase miễn phí **không có bản sao lưu tải về được**, nên nên tự sao lưu mỗi tuần:
- Cách 1: Supabase → Table Editor → chọn từng bảng `cl_*` và `crm_*` → Export → CSV.
- Cách 2 (người kỹ thuật): `npx supabase db dump --linked -f backup-YYYY-MM-DD.sql`.

Khi nâng lên gói Pro, Supabase tự sao lưu hằng ngày.

## Cài đặt lần đầu (người dựng làm)

1. VietK tạo **Supabase project** (region Singapore) và tài khoản **GitHub** bằng email công ty, rồi mời người dựng vào làm thành viên.
2. Supabase → SQL Editor: chạy lần lượt `vietk-checklist/supabase/schema.sql` → `vietk-crm/supabase/crm_schema.sql` → `vietk-checklist/supabase/cron.sql`.
3. Authentication → tạo **tài khoản đầu tiên** (tài khoản này tự thành Quản trị). Tắt "Allow new users to sign up", **giữ Email provider bật**.
4. Điền `SUPABASE_URL` và khoá publishable vào `js/config.js` của **cả hai** app (giống nhau).
5. Trong `supabase/config.toml`, thay `<APP_URL>` và `<CRM_URL>` bằng địa chỉ thật, rồi chạy `npx supabase config push`. Ghi project ref vào `supabase/.ref`.
6. Deploy Edge Functions: `npx supabase functions deploy cl-admin-users cl-notify cl-telegram cl-ai --use-api`.
7. Bật GitHub Pages cho cả 2 repo.
8. Khi cần thông báo và trợ lý AI:
   - Tạo bot Telegram và lấy Gemini API key của VietK.
   - Chạy `zsh tools/set-keys.sh` (khoá được nhập ẩn).
   - Điền `TELEGRAM_BOT` trong `js/config.js`.
   - Bật dòng `cl-notify-5m` trong `cron.sql`.

## Đợt tiếp theo

- **Đợt 2**: kho (nhập / xuất / tồn), serial từng thiết bị khi xuất kho, phiếu bảo hành, nhắc chăm sóc sau bán (ngày 3, ngày 30).
- **Đợt 3**: đại lý / nhà phân phối (tuyển, chiết khấu, đơn nhập, công nợ), bật thông báo và trợ lý AI.

Chạy thử không cần máy chủ: để trống `js/config.js` là app chạy ở chế độ **DEMO**, dùng dữ liệu mẫu và đổi vai trò ở thanh trên cùng.
