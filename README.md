# Callio

Ứng dụng demo bộ sản phẩm quản lý kinh doanh và chăm sóc khách hàng của Callio,
gồm trang giới thiệu và ứng dụng vận hành dùng được thật (dữ liệu giả lập).

## Công nghệ

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 3
- Biome (lint + format)

## Chạy dự án

```bash
npm install
npm run dev
```

Dev server chạy tại `http://localhost:12000`.

Các câu lệnh khác:

```bash
npm run build    # kiểm tra kiểu và build ra thư mục dist
npm run preview  # xem thử bản build
npm run lint     # kiểm tra kiểu + lint và tự sửa
npm run format   # định dạng mã nguồn
```

## Cấu trúc màn hình

Trang giới thiệu hiển thị ở địa chỉ gốc. Ứng dụng vận hành nằm dưới tiền tố
`#/app`:

| Màn hình | Đường dẫn | Nội dung |
| --- | --- | --- |
| Tổng quan | `#/app/tong-quan` | Chỉ số KPI, lưu lượng cuộc gọi theo giờ, cơ cấu kênh, phễu chuyển đổi, dòng hoạt động hợp nhất |
| ACRM | `#/app/crm` | Danh sách khách hàng, bộ lọc, hồ sơ Customer 360 kèm hành trình tương tác đa kênh |
| Đa kênh | `#/app/da-kenh` | Hộp thư tập trung Zalo, Facebook, Email, SMS, Website và cuộc gọi; trả lời, phân công, xử lý theo SLA |
| Tổng đài | `#/app/tong-dai` | Softphone trực tiếp, hiệu suất hàng đợi, trạng thái nhân viên, nhật ký cuộc gọi và bản ghi âm |
| Callbot AI | `#/app/callbot` | Quản lý chiến dịch gọi tự động, trình thiết kế kịch bản, kết quả cuộc gọi và phiên âm |
| Telesales | `#/app/telesales` | Hàng đợi cuộc gọi ưu tiên, dialer trên màn hình, kịch bản gợi ý, ghi nhận kết quả và pipeline |
| Nhắn tin | `#/app/nhan-tin` | Hiệu quả chiến dịch, thư viện mẫu tin, trình soạn tin kèm xem trước trên điện thoại |
| Ulead & Uflow | `#/app/ulead-uflow` | Kho lead với chấm điểm AI và luật chia tự động, trình thiết kế quy trình dạng sơ đồ |

## Ghi chú

Dữ liệu trong ứng dụng là dữ liệu giả lập sinh tất định, không lưu lại sau khi
tải lại trang và chưa kết nối backend. Tham khảo `AGENTS.md` để biết thêm về
kiến trúc và quy ước mã nguồn.
