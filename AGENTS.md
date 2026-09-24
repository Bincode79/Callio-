# Callio — Ghi chú về ứng dụng sản phẩm

## Tổng quan repository

Ứng dụng single-page dùng React 18 + TypeScript + Vite + Tailwind. Gồm hai phần:

1. **Trang giới thiệu (landing page)** — `src/pages/LandingPage.tsx`, hiển thị khi
   URL không có hash `#/app`.
2. **Ứng dụng sản phẩm** (`#/app/*`) — bản demo tương tác của bộ sản phẩm Callio
   với giao diện tiếng Việt, bao gồm: ACRM, hộp thư đa kênh, tổng đài, Callbot AI,
   telesales, chiến dịch nhắn tin và Ulead/Uflow.

## Câu lệnh

```bash
npm install
npm run dev      # vite --host 0.0.0.0 (cổng 12000 trong môi trường sandbox)
npm run build    # tsc -b && vite build --outDir dist
npm run lint     # tsc --noEmit && biome lint --write
```

Kiểm tra nhanh mà không ghi đè file: `npx tsc --noEmit` và `npx biome lint src`.

## Kiến trúc

- `src/App.tsx` — chuyển đổi giữa `LandingPage` và `ProductApp` dựa theo route.
- `src/lib/router.tsx` — router hash gọn nhẹ. **Các route của ứng dụng được đặt
  trong namespace `#/app`** để các anchor trong trang giới thiệu (`#products`,
  `#pricing`, …) vẫn hoạt động. Dùng `appHref(path)` cho thẻ liên kết và
  `navigate(path)` cho các hành động điều hướng.
- `src/lib/store.tsx` — `AppProvider` dùng `useReducer`. Mọi trang đọc state qua
  `useApp()` và cập nhật qua `dispatch`. `useDashboardMetrics()` tính các chỉ số
  tổng quan bằng `useMemo`.
- `src/lib/data.ts` — dữ liệu giả lập tất định (PRNG có seed): khoảng 24 khách
  hàng, 26 hội thoại, 46 cuộc gọi, chiến dịch Callbot, việc telesales, lead và
  workflow. Mốc thời gian neo theo `Date.now()` nên thời gian tương đối luôn mới.
- `src/lib/format.ts` — nhãn tiếng Việt và bảng màu cho từng enum nghiệp vụ, kèm
  các hàm định dạng. **Ngày giờ luôn hiển thị theo múi giờ `Asia/Ho_Chi_Minh`**
  bằng `Intl.DateTimeFormat`, bất kể người xem ở múi giờ nào.
- `src/components/ui.tsx` — các component dùng chung (Card, DataTable, Modal,
  Donut, BarChart, LineChart, StatCard, Tabs, …). Nên tái sử dụng thay vì tạo mới.
- `src/lib/callbot.ts` — engine mô phỏng cuộc gọi AI: `simulateCall` dựng hội thoại
  tất định từ kịch bản, `fillVariables` điền biến động bằng dữ liệu khách hàng,
  `resultFromSimulation` chuyển thành bản ghi lưu vào chiến dịch.
- `src/pages/*` — mỗi file là một module sản phẩm.

### Chức năng gọi AI (Callbot)

- Trợ lý ảo đọc lần lượt các bước trong `CallbotCampaign.script`; mỗi bước có
  `branch` quyết định cách xử lý. Khách từ chối giữa cuộc gọi thì dừng ngay, không
  đọc tiếp các bước sau.
- Lời thoại hỗ trợ biến động `{ten_khach}`, `{ma_don}`, `{san_pham}`, `{ngay_giao}`,
  `{gio_hen}`, `{ten_sale}`. Dùng `variablesInScript` để liệt kê biến thực dùng,
  không hardcode danh sách.
- Kịch bản chỉnh sửa được ngay trên giao diện (thêm/sửa/xoá/đổi thứ tự bước) qua
  các action `addScriptStep`, `updateScriptStep`, `deleteScriptStep`,
  `moveScriptStep`. Không cần thêm màn hình riêng.
- `scriptIssues` chặn chạy mô phỏng khi kịch bản trống, thiếu bước kết thúc hoặc có
  bước chưa nhập lời thoại.
- Lời thoại mẫu của khách viết trung tính về giới tính (`anh/chị`) vì không thể suy
  ra cách xưng hô từ tên trong danh sách.
- `recordCallResult` cập nhật số liệu chiến dịch theo kết quả cuộc gọi, nên chạy mô
  phỏng sẽ thấy ngay "Đã kết nối", "Xác nhận" tăng và kết quả xuất hiện trong tab.
- Chiến dịch mới tạo hoặc nhân bản được chèn lên đầu danh sách và tự chọn sẵn.

### Quy tắc vận hành

`CallbotCampaign.rules` là `CallbotRules` — các cờ bật/tắt được, không phải văn bản
trang trí. Nhãn hiển thị nằm ở `CALLBOT_RULE_LABELS` (store) để toast và giao diện
dùng chung một nguồn.

- Bật/tắt qua action `toggleCampaignRule`, sửa tham số qua `updateCampaignConfig`.
- **`syncToCrm` là quy tắc duy nhất có hiệu lực thật hiện tại:** khi bật,
  `recordCallResult` ghi một `TimelineEvent` vào `customer.timeline` và cập nhật
  `lastContactAt`; khi tắt thì chỉ lưu kết quả vào chiến dịch, không đụng hồ sơ
  khách hàng. Chiến dịch khảo sát mẫu cố ý đặt `syncToCrm: false` để có sẵn ca đối
  chứng.
- Các cờ còn lại (`quietHours`, `autoStopOptOut`, `escalateNegative`,
  `sendConfirmSms`) mới chỉ có trạng thái và giao diện, **chưa được engine mô phỏng
  đọc tới**. Cần nối vào `simulateCall` nếu muốn chúng thay đổi hành vi cuộc gọi.
- Chiến dịch tạo mới mặc định bật các quy tắc an toàn nhưng để `syncToCrm: false`,
  vì ghi vào hồ sơ khách hàng nên do người dùng chủ động bật.

Một lượt nói trong cuộc gọi là `CallbotTurn`. `CallbotResult` giữ thêm `turns`,
`qualityScore`, `stepReached`, `recordingUrl` để xem lại hội thoại đầy đủ.

### Một màn hình, một nguồn sự thật

Màn hình đa kênh chỉ có **một** lối vào là `OmnichannelPage` (hộp thư 3 cột).
Không tạo thêm trang chi tiết hội thoại riêng: click vào danh sách chỉ cập nhật
`selectedId` tại chỗ, giữ nguyên ô trả lời, phân công và SLA. Nếu cần URL chia sẻ
được, dùng `history.replaceState` thay vì đổi route — đổi route sẽ thay thế cả
hộp thư và làm mất các chức năng xử lý.

### Lead và khách hàng

`Lead` và `Customer` là hai tập dữ liệu tách biệt; `Lead` không có `customerId`.
Khi chia lead cho sales, reducer khớp theo số điện thoại (`digitsOnly`) để tìm hồ
sơ ACRM sẵn có; nếu chưa có thì tạo hồ sơ mới từ dữ liệu lead
(`customerFromLead`). Không gán task cho một khách hàng bất kỳ.

## Quy ước

- Toàn bộ nội dung hiển thị cho người dùng là tiếng Việt. Slug route dùng dạng
  kebab-case tiếng Việt (`/tong-dai`, `/da-kenh`, `/nhan-tin`, `/ulead-uflow`).
- Biome bật `useExhaustiveDependencies` và `noArrayIndexKey`. Cần tham chiếu biến
  phụ thuộc ngay trong thân effect thay vì chỉ truyền vào để kích hoạt, và đưa các
  danh sách render tĩnh `Array.from(...)` ra phạm vi module để có key ổn định.
- Không dùng chỉ số mảng làm key của React.

## Lưu ý

- `vite.config.ts` có cấu hình `server.allowedHosts` cho host proxy của sandbox.
  Giữ nguyên cấu hình này khi sửa file, nếu không trang dev sẽ báo
  "Blocked request".
- Phải chạy dev server với `--host 0.0.0.0` để truy cập được từ URL của work host.
- Ảnh từ xa lấy từ `ext.same-assets.com` và đã được allowlist trong `netlify.toml`.
