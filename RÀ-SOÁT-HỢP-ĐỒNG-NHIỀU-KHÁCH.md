# Một phòng có nhiều khách thuê

Một phòng có một hợp đồng đang hiệu lực. Hợp đồng chứa danh sách tất cả khách ở chung; lập một hóa đơn theo hợp đồng cho mỗi kỳ. Khi chọn hợp đồng trên hóa đơn, giao diện hiển thị phòng và toàn bộ người thuê trong hợp đồng.

Số phòng của khách được suy ra từ hợp đồng đang hiệu lực và hiển thị trong danh sách/hồ sơ khách thuê. Không lưu số phòng lặp trong hồ sơ khách, tránh thông tin phòng lệch với hợp đồng. Mỗi hóa đơn lưu ảnh chụp danh sách người thuê tại thời điểm lập để lịch sử công nợ không đổi khi danh sách khách trong hợp đồng được cập nhật.

## Hợp đồng và hóa đơn cũ

Migration `0005_shared_contract_tenants` thêm `tenantIds` từ `tenantId` hiện có, giữ lại hợp đồng và hóa đơn lịch sử. Nếu dữ liệu cũ có nhiều hợp đồng đang hiệu lực cùng phòng, migration không tự gộp hay thay đổi tiền/thời hạn. Hãy chuyển hợp đồng thừa sang “Đã kết thúc”, rồi cập nhật hợp đồng còn hiệu lực để chọn tất cả khách ở chung. Từ đó tạo hóa đơn chung cho hợp đồng. Các hóa đơn cũ vẫn gắn với hợp đồng lịch sử ban đầu.

Migration PostgreSQL: `drizzle-postgres/0002_shared_contract_tenants.sql`. Migration SQLite/D1: `drizzle/0005_shared_contract_tenants.sql`.
