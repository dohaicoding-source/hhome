# Một phòng có nhiều khách thuê

Mỗi khách thuê được quản lý bằng một hồ sơ và một hợp đồng riêng. Nhiều hợp đồng đang hiệu lực có thể cùng tham chiếu một phòng; mỗi cặp phòng–khách chỉ có tối đa một hợp đồng đang hiệu lực.

## Tiền thuê và hóa đơn

- Tiền thuê lưu theo từng hợp đồng. Khi chọn phòng, biểu mẫu gợi ý phần tiền còn lại sau các hợp đồng đang hiệu lực; người quản lý có thể sửa theo thỏa thuận thực tế.
- Hóa đơn tiếp tục gắn với hợp đồng, do đó mỗi khách có hóa đơn và công nợ riêng.
- Điện, nước và phí dùng chung cần được phân bổ vào từng hóa đơn theo thỏa thuận. Hệ thống không tự chia các chỉ số công tơ chung.

## Triển khai dữ liệu

Slot của hợp đồng đang hiệu lực dùng `roomId:tenantId`; slot trống của hợp đồng đã kết thúc không thay đổi. Migration `drizzle-postgres/0001_multi_tenant_contracts.sql` chuyển các hợp đồng hiện có sang định dạng mới. Áp dụng migration bằng `npm.cmd run db:migrate` theo quy trình môi trường của dự án. Bản migration SQLite tương ứng nằm tại `drizzle/0004_multi_tenant_contracts.sql`.
