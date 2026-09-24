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
npm test         # chạy test engine gọi AI
npm run lint     # tsc --noEmit && biome lint --write
```

Kiểm tra nhanh mà không ghi đè file: `npx tsc --noEmit` và `npx biome lint src`.

## Test

Hạ tầng test dùng `node:test` có sẵn trong Node, không thêm runner nào.

- Bộ test nằm cạnh mã nguồn:
  - `src/lib/callbot.test.ts` — engine gọi AI.
  - `src/lib/store.test.tsx` — reducer của store.
- `scripts/run-tests.mjs` bundle từng bộ test bằng **esbuild đã có sẵn trong
  `node_modules`** (qua Vite) rồi chạy `node --test`. Cần bundle vì `src/lib` import
  theo kiểu bundler (không có đuôi file) và Node ESM không resolve được trực tiếp.
  Danh sách bộ test được liệt kê tường minh trong script — thêm bộ mới thì thêm vào đó.
- File test nằm trong `src/` nên được `tsc` và Biome kiểm tra như mã sản phẩm, nhưng
  **không lọt vào bundle** vì chỉ có entry point được Vite đóng gói từ `index.html`.
- `@types/node` là devDependency duy nhất thêm vào cho việc này, chỉ để có type của
  `node:test`.
- CI ở `.github/workflows/verify.yml` chạy kiểm tra kiểu, lint, test và build.

Reducer được export (`reducer`, `initialState`, `Action`) để test gọi trực tiếp mà
không cần render React. `initialState` là hằng dùng chung, nên test phải
`structuredClone` nó ra trước mỗi ca — nếu không, các ca sẽ ảnh hưởng lẫn nhau.

Viết test cần lưu ý vài điểm đã từng gây lỗi:

- `hasOptedOut` chuẩn hoá **cả** từ khoá lẫn chuỗi đầu vào. Chỉ chuẩn hoá một phía thì
  cụm còn dấu sẽ không bao giờ khớp.
- `quietHours` mặc định bật, nên test engine chạy ngoài giờ làm việc sẽ bị chặn hết.
  Dùng `withRules()` để tắt cờ này cho các ca không kiểm tra khung giờ.
- Không khẳng định dựa vào việc một giá trị mới **tình cờ khác** giá trị sẵn có của
  đối tượng khác. Ví dụ đổi giọng chiến dịch: phải so với chính giá trị trước đó của
  chiến dịch kia, vì giọng mới có thể trùng giọng nó đang dùng.

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
- **Cả 5 quy tắc đều được `simulateCall` đọc tới:**
  - `quietHours` — chặn trước khi bấm số nếu ngoài khung giờ; trả về `blocked.reason`,
    kết quả `hen-goi-lai`, không sinh hội thoại. Giao diện cũng cảnh báo trước bằng
    `isWithinWindow` để người dùng không bấm rồi mới biết.
  - `autoStopOptOut` — khách nói câu như "đừng gọi" thì ghi nhận `optedOut`, thêm
    lời xin lỗi và dừng ngay; kết quả `tu-choi`.
  - `escalateNegative` — khách từ chối thì nối máy chuyên viên thay vì kết thúc,
    `escalated = true`, kết quả đổi thành `hen-goi-lai` (cần người thật gọi lại).
  - `sendConfirmSms` — `smsSent` chỉ bật khi kết quả là `xac-nhan`.
  - `syncToCrm` — ghi `TimelineEvent` vào `customer.timeline` và cập nhật
    `lastContactAt`; tắt thì chỉ lưu kết quả vào chiến dịch.
- Chiến dịch khảo sát mẫu cố ý đặt `syncToCrm: false` và `escalateNegative: false`
  để có sẵn ca đối chứng trong dữ liệu.
- Chiến dịch tạo mới mặc định bật các quy tắc an toàn nhưng để `syncToCrm: false`,
  vì ghi vào hồ sơ khách hàng nên do người dùng chủ động bật.
- Cờ can thiệp được lưu vào `CallbotResult` (`blockedReason`, `escalated`,
  `optedOut`, `smsSent`) nên xem lại kết quả vẫn biết quy tắc nào đã tác động.

**Lưu ý khi viết test cho engine:** `hasOptedOut` chuẩn hoá cả từ khoá lẫn chuỗi
đầu vào — chỉ chuẩn hoá một phía thì cụm còn dấu sẽ không bao giờ khớp. Và
`quietHours` mặc định bật, nên test chạy ngoài giờ làm việc sẽ bị chặn hết; cần tắt
cờ này cho các ca không kiểm tra khung giờ.

Một lượt nói trong cuộc gọi là `CallbotTurn`. `CallbotResult` giữ thêm `turns`,
`qualityScore`, `stepReached`, `recordingUrl` để xem lại hội thoại đầy đủ.

### Một màn hình, một nguồn sự thật

Màn hình đa kênh chỉ có **một** lối vào là `OmnichannelPage` (hộp thư 3 cột).
Không tạo thêm trang chi tiết hội thoại riêng: click vào danh sách chỉ cập nhật
`selectedId` tại chỗ, giữ nguyên ô trả lời, phân công và SLA. Nếu cần URL chia sẻ
được, dùng `history.replaceState` thay vì đổi route — đổi route sẽ thay thế cả
hộp thư và làm mất các chức năng xử lý.

### Vòng đời chiến dịch nhắn tin

Màn hình Nhắn tin có ba thao tác ghi dữ liệu thật, không còn nút giả:

- Tạo chiến dịch: nội dung soạn tay được lưu **thành mẫu tin** dùng lại và chiến
  dịch trỏ tới mẫu đó qua `templateId`. Lưu nháp để `status: "nhap"`, lên lịch gửi
  để `status: "dang-chay"`; cả hai đều bắt đầu với 0 tin gửi.
- Nhân bản chiến dịch: bản sao luôn ở `nhap` và **không mang theo số liệu** của bản
  gốc (sent/delivered/opened/replied/failed đều 0), vì tái sử dụng số liệu cũ sẽ
  làm sai báo cáo.
- Sửa mẫu tin: cập nhật tên, nhóm và nội dung; chỉ đụng đúng mẫu được chọn và tự
  làm mới `updatedAt`.

Chi tiết chiến dịch đọc thẳng từ `state` theo mã (`detailId`) thay vì giữ bản sao,
nên tạm dừng hoặc nhân bản xong là số liệu và trạng thái trong modal khớp ngay.

### Lead và khách hàng

`Lead` và `Customer` là hai tập dữ liệu tách biệt; `Lead` không có `customerId`.
Khi chia lead cho sales, reducer khớp theo số điện thoại (`digitsOnly`) để tìm hồ
sơ ACRM sẵn có; nếu chưa có thì tạo hồ sơ mới từ dữ liệu lead
(`customerFromLead`). Không gán task cho một khách hàng bất kỳ.

Tạo hồ sơ thủ công trên ACRM cũng qua reducer (`createCustomer`): cấp mã mới bằng
`nextCustomerCode` (không trùng mã sẵn có), gắn chủ sở hữu là người đang đăng nhập,
và ghi một `TimelineEvent` "Tạo hồ sơ khách hàng" để hồ sơ mới có sẵn hành trình.

### Tổng đài, telesales và workflow

Các tác vụ thao tác cũng đi qua reducer thay vì chỉ báo toast:

- **Tổng đài**: `createCall` mở cuộc gọi ra đang đàm thoại; `transferCall` đổi hàng
  đợi; `saveCallNote` ghi chú và **thêm một `TimelineEvent` "Ghi chú cuộc gọi"** vào
  hồ sơ khách hàng (kèm cập nhật `lastContactAt`) vì ghi chú thuộc về hồ sơ, không
  chỉ nằm ở nhật ký tổng đài.
- **Telesales**: `sendQuote` và `scheduleDemo` đổi `lastResult` của task **và** ghi
  sự kiện tương ứng vào hành trình khách hàng.
- **Workflow**: `createWorkflow` tạo bản nháp có sẵn một bước kích hoạt;
  `updateWorkflowNode` sửa tên/mô tả một bước; `runWorkflow` **chỉ chạy khi workflow
  đang hoạt động** — bản nháp hoặc tạm dừng sẽ báo lỗi thay vì giả vờ thành công —
  và ghi thêm một `WorkflowRun` vào nhật ký (nhật ký đọc từ `workflow.runs`, không
  sinh giả trong lúc render).
- **Tệp lead**: `syncLeads` chỉ phân loại lead đang chờ, không kéo lại lead đã chia
  hay đã loại; `mergeDuplicateLeads` bỏ cờ trùng và đánh dấu đã gộp.

Workflow mới tạo được chèn lên đầu và tự chọn sẵn, cùng cách với chiến dịch Callbot.

### Nghe thử giọng đọc (Web Speech API)

Nút "Nghe thử" của từng bước và "Nghe thử toàn bộ" đọc thật bằng tổng hợp giọng nói
của trình duyệt, không còn là toast giả.

- `src/lib/speech.ts` là lớp thuần tách khỏi API để test được: `parseVoiceLabel` suy
  giới tính/miền từ nhãn, `pickVoice` chọn giọng trình duyệt hợp nhất (ưu tiên tuyệt
  đối giọng tiếng Việt; không có thì dùng giọng gần nhất), `buildSpeechSegments` điền
  biến động theo khách đang xem trước.
- Nhận diện giới tính phải kiểm tra **"nữ" trước "nam"**: "nam" vừa là giới tính vừa
  nằm trong "miền Nam", nên đảo thứ tự sẽ đọc sai giọng nữ miền Nam.
- Ưu tiên tiếng Việt chỉ nằm ở một chỗ (`pickVoice` lọc trước), không cộng điểm ở
  `scoreVoice`, để không có hai nguồn cùng quyết định.
- Hook `useSpeech` nạp giọng qua cả `getVoices()` lẫn sự kiện `voiceschanged` (Chrome
  nạp bất đồng bộ), đọc tuần tự từng đoạn và huỷ khi rời trang.
- Thiết bị/trình duyệt không hỗ trợ thì giao diện báo rõ và vẫn cho chọn giọng để lưu
  vào chiến dịch, thay vì im lặng hoặc lỗi.

### Khách trả lời thật bằng micro (Speech Recognition)

Nút "Khách nói" cho phép đọc câu trả lời của khách; engine phân loại câu nói và chạy
mô phỏng với câu thật thay cho lời mẫu ở bước tương ứng.

- `classifyCustomerReply` (callbot) suy ý định từ câu nói: xác nhận / từ chối / xin gặp
  nhân viên / trung tính. **Thứ tự kiểm tra quan trọng**: yêu cầu không làm phiền xét
  trước tiên, vì câu "Dạ, đừng gọi cho tôi nữa" cũng chứa "dạ" nghe như đồng ý.
- `simulateCall(campaign, customer, variant, spokenReplies)` nhận mảng câu nói thật
  theo chỉ số bước; bước không có câu nói thì dùng lời mẫu. Ý định từ câu thật được
  ưu tiên quyết định kết quả (không suy từ nhánh bước cuối), và khách chủ động xin gặp
  nhân viên thì chuyển máy bất kể quy tắc `escalateNegative`.
- Hook `useSpeechRecognition` tạo instance mới mỗi phiên (tái dùng sau `end` có thể
  không nhận kết quả trên vài bản Chrome), gộp kết quả cuối và báo mã lỗi (ví dụ
  `not-allowed` khi chưa cấp quyền micro).
- Trình duyệt không hỗ trợ nhận diện (Safari/Firefox thường không) thì nút bị vô hiệu
  và giao diện nói rõ; vẫn mô phỏng được bằng lời mẫu.

### Backend giọng nói thật (`backend/voice`)

Giao diện ưu tiên dùng backend khi có, để giọng đọc/nhận diện tiếng Việt tốt hơn và
giống nhau trên mọi thiết bị. Backend là FastAPI nhỏ, **miễn phí, không cần API key**:

- `POST /api/tts` — `edge-tts`; `POST /api/stt` — `faster-whisper` chạy cục bộ.
- Test backend dùng `unittest` có sẵn (không thêm runner) và **tiêm engine giả**, nên
  chạy được khi máy chưa cài model; CI có job riêng chỉ cài `fastapi`/`httpx`… để nhanh.
- `src/lib/voiceApi.ts` dò backend qua `/api/health`; `useSpeech`/`useSpeechRecognition`
  tự lùi về Web Speech API khi backend không chạy, và lùi tiếp sang trình duyệt nếu
  backend lỗi giữa chừng.
- Ánh xạ nhãn giọng sản phẩm → mã giọng edge-tts nằm ở `app/voices.py`; phải xét **"nữ"
  trước "nam"** vì "nam" nằm trong "miền Nam".
- Vite dev chuyển tiếp `/api` sang `http://localhost:8000` (đổi bằng
  `CALLIO_VOICE_API_TARGET`). Khi deploy, đặt `VITE_VOICE_API` nếu backend ở cổng khác.

Lưu ý: `edge-tts` dùng dịch vụ **không chính thức** của Microsoft (miễn phí nhưng
không có SLA). Chi tiết và cảnh báo đầy đủ ở `backend/voice/README.md`.

**Đổi engine không cần sửa mã:** backend nói giao thức OpenAI-compatible, chọn bằng
`CALLIO_TTS_PROVIDER`/`CALLIO_STT_PROVIDER` = `local` hoặc `openai` (+ `_BASE_URL`,
`_MODEL`, `_VOICE`, `CALLIO_PROVIDER_API_KEY`). Nhờ vậy cắm được VieNeu-TTS,
Kokoro-FastAPI, speaches, PhoWhisper… mà không đụng vào `app/main.py`. Chọn `openai`
mà thiếu `BASE_URL` thì **báo lỗi ngay lúc khởi động**.

**Xác thực:** đặt `CALLIO_AUTH_TOKEN` thì `/api/tts`, `/api/tts/stream` và `/api/stt`
đòi `Authorization: Bearer <token>`; so sánh bằng `hmac.compare_digest` để không rò rỉ
token qua thời gian phản hồi. Giao diện gửi token qua `authHeaders()` trong
`src/lib/voiceApi.ts`; người dùng dán token ở **Callbot → Đổi giọng** (lưu
`localStorage`), hoặc đặt `VITE_VOICE_TOKEN`. Chưa đặt thì để mở (tiện cho dev nội bộ).

**Giới hạn tần suất:** `app/ratelimit.py` là token bucket, TTS/STT hạn mức riêng
(`CALLIO_RATE_LIMIT_TTS` mặc định 60, `CALLIO_RATE_LIMIT_STT` mặc định 20 mỗi
`CALLIO_RATE_LIMIT_WINDOW` giây). Vượt hạn mức trả **429** kèm `Retry-After`. Đồng hồ
tiêm được (`clock`) nên test kiểm soát thời gian, không cần `sleep`. Đặt 0 để tắt.

Hai điểm phải nhớ khi sửa phần này:

- **Khoá theo IP thật, không tin header bừa.** `app/clientid.py` chỉ đọc
  `X-Forwarded-For` khi kết nối đến từ `CALLIO_TRUSTED_PROXIES`; nếu tin vô điều kiện
  thì ai cũng giả header để né hạn mức. Không cấu hình proxy thì mọi request dùng IP
  kết nối — đúng khi chạy trực tiếp, **sai** khi chạy sau proxy (mọi người dùng chung
  một hạn mức).
- **Bộ nhớ có trần.** Mỗi IP là một bucket nên phải chặn rò rỉ:
  `CALLIO_RATE_LIMIT_MAX_KEYS` (mặc định 10.000). Vượt trần thì dọn bucket đã nạp đầy
  trước; nếu vẫn vượt (mọi bucket đang bị tiêu) thì xoá LRU — đánh đổi có ghi rõ trong
  docstring, không phải bug.

**Streaming:** `/api/tts/stream` phát dần từng đoạn audio (edge-tts hỗ trợ sẵn). Đo
thực tế với edge-tts: byte đầu tới sau ~0,16s so với ~0,42s khi đợi cả tệp. Giao diện
hiện **chưa** dùng đường này vì `fetch` vẫn gom hết vào Blob trước khi phát — muốn ăn
lợi thế thật thì cần phát qua `MediaSource`/thẻ audio streaming.

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
