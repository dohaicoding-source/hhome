# Quản lý chung cư mini

Ứng dụng quản lý cơ sở, phòng, khách thuê, hợp đồng, hóa đơn, chi phí và phân quyền cộng tác.

## Công nghệ

- Next.js App Router và React
- PostgreSQL trên Neon, truy cập qua `postgres` và Drizzle ORM
- Ảnh riêng tư trên Vercel Blob
- Triển khai bằng Vercel

## Chạy local

Cần Node.js `>=22.13.0` và một cơ sở dữ liệu PostgreSQL.

1. Tạo `.env.local` từ `.env.example` và điền `DATABASE_URL` của Neon.
2. Cài dependencies bằng `npm ci`.
3. Tạo/cập nhật migration khi schema thay đổi: `npm run db:generate`.
4. Áp dụng migration: `npm run db:migrate`.
5. Chạy `npm run dev`.

Để tải ảnh khi chạy local, kết nối Vercel Blob store với project và lấy biến môi trường bằng Vercel CLI (`vercel env pull .env.local`). Dùng private Blob store vì ảnh hợp đồng và giấy tờ tùy thân là dữ liệu riêng tư.

## Deploy lên Vercel

1. Tạo project PostgreSQL trên Neon.
2. Kết nối Neon với project Vercel và đặt `DATABASE_URL` cho Production, Preview và Development.
3. Tạo một Vercel Blob store ở chế độ **Private**, kết nối với project và các môi trường cần dùng.
4. Chạy migration trên database đích bằng `npm run db:migrate`.
5. Import source vào Vercel; cấu hình mặc định dùng `npm run build` và Next.js.

Không commit `.env.local`, connection string, Blob token hoặc bản export dữ liệu. Vercel Blob dùng OIDC khi ứng dụng chạy trên Vercel; local development có thể dùng credentials do Vercel CLI cấp.

## Chuyển dữ liệu từ Cloudflare

Việc đổi ứng dụng sang Neon/Vercel **không tự chuyển dữ liệu** trong D1 hoặc tệp trong R2. Trước khi chuyển production:

1. Sao lưu D1 và R2; giữ dịch vụ cũ hoạt động và tạm dừng ghi dữ liệu trong thời gian export/import.
2. Đăng nhập Wrangler bằng `npx wrangler login`, rồi export snapshot và các object R2. Trong PowerShell:

   ```powershell
   $env:CLOUDFLARE_D1_DATABASE = "<D1 database name>"
   $env:CLOUDFLARE_R2_BUCKET = "<R2 bucket name>"
   npm run data:export:d1
   ```

3. Trỏ `.env.local` đến Neon database mới, kết nối private Blob store qua Vercel CLI, rồi chạy `npm run db:migrate`.
4. Chạy `npm run data:import:d1`. Importer chỉ chạy khi các bảng đích còn trống; nó giữ nguyên ID, mật khẩu đã băm, session hash, quan hệ và timestamp, đồng thời chuyển attachment từ `.migration/r2/` sang private Blob với object key cũ.
5. So sánh số bản ghi và số tệp, thử đăng nhập, phân quyền và đọc ảnh trước khi chuyển traffic. Chỉ chạy import một lần trên database đích trống; đừng đưa snapshot vào Git.

Không đưa dữ liệu, mật khẩu, connection string hoặc token vào chat hay commit. Không xóa D1/R2 trước khi xác nhận bản sao Neon/Blob đã đầy đủ. Dữ liệu D1/R2 thực tế phải được xuất từ tài khoản Cloudflare của chủ project; repo không chứa bản sao dữ liệu production.

## Scripts

- `npm run dev`: chạy Next.js local.
- `npm run build`: build cho production.
- `npm start`: chạy build local.
- `npm run lint`: chạy ESLint.
- `npm run db:generate`: tạo Drizzle migration PostgreSQL.
- `npm run db:migrate`: áp dụng các migration PostgreSQL chưa chạy.
