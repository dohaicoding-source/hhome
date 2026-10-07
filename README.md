# Quản lý chung cư mini

Ứng dụng web hỗ trợ chủ nhà quản lý nhà cho thuê, phòng, khách thuê, hợp đồng, hóa đơn, chi phí và cộng tác viên trong một không gian làm việc riêng tư.

## Mục lục

- [Tính năng](#tính-năng)
- [Công nghệ](#công-nghệ)
- [Yêu cầu](#yêu-cầu)
- [Chạy ứng dụng trên Windows](#chạy-ứng-dụng-trên-windows)
- [Biến môi trường](#biến-môi-trường)
- [Cơ sở dữ liệu và migration](#cơ-sở-dữ-liệu-và-migration)
- [Lưu trữ ảnh](#lưu-trữ-ảnh)
- [Kiểm tra và build](#kiểm-tra-và-build)
- [Deploy lên Vercel](#deploy-lên-vercel)
- [Chuyển dữ liệu từ Cloudflare D1/R2](#chuyển-dữ-liệu-từ-cloudflare-d1r2)
- [Xử lý sự cố](#xử-lý-sự-cố)
- [Bảo mật dữ liệu](#bảo-mật-dữ-liệu)

## Tính năng

- Quản lý nhiều cơ sở và các phòng thuộc từng cơ sở.
- Theo dõi khách thuê, thông tin liên hệ, giấy tờ và phương tiện.
- Tạo hợp đồng, quản lý thời hạn, tiền thuê và tiền đặt cọc.
- Lập hóa đơn theo kỳ, ghi nhận tiền đã thu và theo dõi công nợ.
- Ghi nhận chi phí vận hành và xem báo cáo.
- Quản lý thiết bị trong phòng và tình trạng sử dụng.
- Phân quyền thành viên theo vai trò và phạm vi cơ sở được giao; người thuê chỉ xem thông tin của mình.
- Lưu ảnh hợp đồng và ảnh hồ sơ trong kho riêng tư.

## Công nghệ

- **Giao diện và ứng dụng:** Next.js App Router, React, TypeScript.
- **Cơ sở dữ liệu:** PostgreSQL, khuyến nghị Neon.
- **Truy cập dữ liệu và migration:** `postgres` và Drizzle ORM / Drizzle Kit.
- **Tệp riêng tư:** Vercel Blob ở chế độ Private.
- **Triển khai:** Vercel.

## Yêu cầu

- Node.js `>=22.13.0` và npm.
- Cơ sở dữ liệu PostgreSQL có thể truy cập từ máy local (ví dụ Neon).
- Git để clone mã nguồn.
- Vercel Blob Private nếu cần tải hoặc xem ảnh hồ sơ/hợp đồng.

Kiểm tra Node/npm trong PowerShell:

```powershell
node -v
npm.cmd -v
```

Nếu `node`, `npm` hoặc `npm.cmd` không được nhận diện, hãy cài Node.js bản LTS từ trang chính thức, thêm thư mục cài đặt Node.js (thông thường là `C:\Program Files\nodejs`) vào biến môi trường `Path`, sau đó đóng và mở lại VS Code.

## Chạy ứng dụng trên Windows

Mở terminal PowerShell tại thư mục chứa `package.json`. Khi clone repository lần đầu:

```powershell
git clone https://github.com/dohaicoding-source/hhome.git
cd hhome
```

Nếu đã tải project về máy, chuyển đến thư mục gốc thực tế. Thư mục đúng phải có các file `package.json`, `README.md` và `drizzle.config.ts`:

```powershell
cd "C:\Users\Admin\Downloads\quan-ly-chung-cu-mini-main\quan-ly-chung-cu-mini-main"
Get-ChildItem package.json
```

Cài dependencies:

```powershell
npm.cmd ci
```

Tạo file môi trường local từ mẫu và mở file để thêm URL PostgreSQL thật:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Ví dụ cấu trúc `.env.local` (thay bằng thông tin lấy từ Neon; không dùng chuỗi mẫu này):

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

Áp dụng schema lần đầu và chạy ứng dụng:

```powershell
npm.cmd run db:migrate
npm.cmd run dev
```

Mở địa chỉ được Next.js in ra trong terminal, thường là <http://localhost:3000>.

Để dừng server, nhấn `Ctrl+C` trong terminal đang chạy `npm.cmd run dev`.

### Nếu `npm.cmd` vẫn không được nhận diện

Đóng và mở lại VS Code sau khi cài Node.js. Có thể gọi trực tiếp shim của npm bằng đường dẫn mặc định:

```powershell
& "C:\Program Files\nodejs\npm.cmd" -v
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Nếu Node.js được cài ở vị trí khác, thay đường dẫn trên bằng vị trí thực tế. Nếu PowerShell báo không tìm thấy `package.json`, dùng `cd` để vào đúng thư mục gốc của project trước khi chạy lệnh.

## Biến môi trường

| Tên | Bắt buộc | Dùng ở đâu | Mô tả |
|---|---|---|---|
| `DATABASE_URL` | Có | Local, Preview, Production | PostgreSQL connection string. Giữ bí mật; lấy từ Neon. |
| `BLOB_READ_WRITE_TOKEN` | Khi thao tác với ảnh ở local | Local | Token do Vercel Blob cung cấp. Khi deploy trên Vercel, kết nối Blob Store để cấu hình credential cho ứng dụng. |

`.env.example` chỉ chứa giá trị mẫu. `.env.local` chứa thông tin thật và đã được loại khỏi Git; không commit hoặc gửi file này. Không thêm tiền tố `NEXT_PUBLIC_` vào các biến trên vì chúng chỉ được dùng phía server.

## Cơ sở dữ liệu và migration

`DATABASE_URL` phải trỏ đến database PostgreSQL của môi trường đang thao tác. Có thể dùng pooled connection string của Neon cho ứng dụng. Khi database provider cung cấp connection string với SSL, giữ nguyên tham số SSL mà provider đưa ra.

Các bảng cần thiết được định nghĩa trong `db/schema.ts`; migration PostgreSQL nằm trong `drizzle-postgres/`.

Áp dụng migration chưa chạy:

```powershell
npm.cmd run db:migrate
```

Lệnh này an toàn để chạy lại: Drizzle chỉ áp dụng các migration chưa được ghi nhận. Các thông báo PostgreSQL `NOTICE` cho biết schema/bảng migration đã tồn tại không nhất thiết là lỗi; cần kiểm tra kết quả cuối lệnh. Khi thành công, Drizzle báo migration đã được áp dụng.

Khi thay đổi schema:

1. Cập nhật `db/schema.ts`.
2. Tạo migration mới:

   ```powershell
   npm.cmd run db:generate
   ```

3. Kiểm tra SQL mới sinh trong `drizzle-postgres/`.
4. Thử migration trên database development/staging trước khi áp dụng vào production:

   ```powershell
   npm.cmd run db:migrate
   ```

Không xóa các migration đã áp dụng và không chỉnh sửa connection string production để dùng thử migration.

## Lưu trữ ảnh

Ứng dụng lưu ảnh hợp đồng và hồ sơ bằng Vercel Blob với `access: "private"`. Không chuyển kho này sang Public: tệp có thể chứa dữ liệu nhận dạng và thông tin nhạy cảm.

### Local

1. Tạo Vercel Blob Store ở chế độ **Private** và kết nối với Vercel project.
2. Cài/đăng nhập Vercel CLI nếu chưa dùng:

   ```powershell
   npx.cmd vercel login
   npx.cmd vercel link
   ```

3. Kéo các biến môi trường Development về `.env.local`:

   ```powershell
   npx.cmd vercel env pull .env.local --environment=development
   ```

4. Xác nhận `.env.local` có `DATABASE_URL` và credential Blob cần thiết; lệnh pull có thể cập nhật file môi trường local.
5. Chạy lại `npm.cmd run dev`.

Không chia sẻ token Blob hoặc nội dung `.env.local`.

## Kiểm tra và build

Chạy ESLint:

```powershell
npm.cmd run lint
```

Chạy bộ kiểm tra quyền, tài khoản, dữ liệu và ảnh:

```powershell
node tests/accounts.mjs
```

Tạo production build:

```powershell
npm.cmd run build
```

Chạy production build ở local sau khi build:

```powershell
npm.cmd start
```

Không chạy `npm.cmd start` thay cho `npm.cmd run dev` khi đang phát triển. `start` phục vụ bản build production đã được tạo trước đó.

## Deploy lên Vercel

### Chuẩn bị dịch vụ

1. Tạo PostgreSQL database trên Neon.
2. Tạo Vercel project và kết nối repository `dohaicoding-source/hhome`.
3. Tạo Vercel Blob Store ở chế độ **Private**, sau đó kết nối store với Vercel project.
4. Cấu hình biến môi trường cho các môi trường cần dùng:
   - `DATABASE_URL` cho **Production**, **Preview** và **Development**. Mỗi môi trường nên trỏ đúng database tương ứng; tránh để Preview ghi vào database Production.
   - Cấu hình Blob Store/credentials cho project theo hướng dẫn của Vercel.
5. Đảm bảo database Production đã được tạo và migration đã áp dụng trước khi chuyển traffic.

### Áp dụng migration Production

Chọn một trong hai cách:

- **Từ máy local:** tạm thời cấu hình `.env.local` trỏ đúng `DATABASE_URL` Production, chạy:

  ```powershell
  npm.cmd run db:migrate
  ```

  Sau đó khôi phục `.env.local` về database Development. Không commit file môi trường.

- **Từ CI/CD:** cấu hình bước migration riêng với quyền truy cập database Production, chỉ chạy theo quy trình triển khai có kiểm soát.

Không chạy migration production tự động từ nhiều build song song. Kiểm tra migration và backup database trước khi thay đổi schema quan trọng.

### Deploy ứng dụng

Vercel nhận diện Next.js tự động. Cấu hình mặc định:

- Build command: `npm run build`
- Output: Next.js mặc định
- Install command: tự nhận diện theo lockfile `package-lock.json`

Sau deployment, kiểm tra:

- Trang chủ và đăng nhập/đăng ký.
- Tạo cơ sở, phòng, khách thuê, hợp đồng, hóa đơn và chi phí.
- Quyền của owner/staff/tenant và phạm vi cơ sở được giao.
- Upload, đọc và xóa ảnh riêng tư.
- Logs của Vercel và kết nối database khi có lỗi.

Các thay đổi trên GitHub không đồng nghĩa dữ liệu Cloudflare đã được chuyển. Nếu cần giữ dữ liệu cũ, hoàn thành quy trình chuyển dữ liệu bên dưới trước khi đưa deployment mới vào sử dụng.

## Chuyển dữ liệu từ Cloudflare D1/R2

Đổi code sang PostgreSQL/Vercel không tự chuyển dữ liệu từ Cloudflare. Quy trình này dùng Wrangler để xuất D1/R2 và script importer để nạp snapshot vào PostgreSQL/Blob.

### Trước khi bắt đầu

- Có quyền truy cập Cloudflare account, D1 database và R2 bucket nguồn.
- Có `.env.local` trỏ đến Neon database đích và credential của private Blob Store.
- Database Neon đích dành riêng cho lần import này, chưa chứa dữ liệu ứng dụng.
- Đã sao lưu database và bucket nguồn.
- Lên lịch tạm dừng ghi vào hệ thống cũ trong thời gian chụp snapshot để hạn chế mất các thay đổi mới.

### 1. Export D1 và R2

Trong PowerShell, tại thư mục project:

```powershell
npx.cmd wrangler login
$env:CLOUDFLARE_D1_DATABASE = "<ten-database-d1>"
$env:CLOUDFLARE_R2_BUCKET = "<ten-bucket-r2>"
npm.cmd run data:export:d1
```

Script xuất snapshot và các tệp đính kèm vào thư mục `.migration/`:

- `.migration/d1-snapshot.json`
- `.migration/r2/`

Thư mục này có thể chứa dữ liệu cá nhân và tệp nhạy cảm. Giữ riêng tư, không commit, không tải lên repository hoặc gửi qua chat.

### 2. Tạo schema PostgreSQL

Đảm bảo `DATABASE_URL` trong `.env.local` trỏ đến đúng Neon database đích. Tạo các bảng bằng migration:

```powershell
npm.cmd run db:migrate
```

### 3. Import snapshot và tệp

Đăng nhập/cấu hình Vercel Blob Private cho môi trường local như phần [Lưu trữ ảnh](#lưu-trữ-ảnh), sau đó chạy:

```powershell
npm.cmd run data:import:d1
```

Importer:

- Dừng lại nếu bất kỳ bảng đích nào không trống. Đây là kiểm tra bảo vệ; không tìm cách bỏ qua bằng cách xóa dữ liệu tùy tiện.
- Giữ nguyên ID và các quan hệ trong snapshot.
- Nạp các bảng vào PostgreSQL và chép attachment sang private Blob với object key tương ứng.
- Có thể xóa các object Blob vừa tải lên nếu import thất bại giữa chừng; luôn kiểm tra log trước khi thử lại.

Chỉ import một lần trên database đích sạch. Nếu import lỗi sau khi một số bước đã chạy hoặc trạng thái không rõ, dừng lại và kiểm tra database/Blob trước khi quyết định cách khôi phục. Không tự ý chạy lại trên dữ liệu đã nhập.

### 4. Xác minh và chuyển traffic

- So sánh số hàng theo từng bảng giữa snapshot và database đích.
- So sánh số ảnh/tệp và mở thử một số ảnh hợp đồng, hồ sơ.
- Thử đăng nhập các vai trò và xác nhận quyền truy cập.
- Đối chiếu một số hợp đồng, hóa đơn, công nợ và báo cáo thực tế.
- Chỉ chuyển traffic sau khi xác minh xong; giữ Cloudflare D1/R2 và bản sao lưu đến khi xác nhận migration hoàn chỉnh.

Repo không chứa dữ liệu production của Cloudflare. Chỉ chủ tài khoản có thể xuất dữ liệu thật từ D1/R2.

## Xử lý sự cố

### `npm` hoặc `npm.cmd` không được nhận diện

Kiểm tra cài Node.js:

```powershell
node -v
where.exe node
where.exe npm
```

Nếu Node đã được cài tại đường dẫn mặc định nhưng chưa có trong `PATH`, thử gọi trực tiếp:

```powershell
& "C:\Program Files\nodejs\npm.cmd" -v
```

Sau khi thêm `C:\Program Files\nodejs` vào `Path`, đóng toàn bộ VS Code rồi mở lại. Mở terminal mới và kiểm tra lại.

### Không tìm thấy `package.json`

Terminal đang đứng sai thư mục. Chuyển vào thư mục gốc của repository (thư mục chứa `package.json`), ví dụ:

```powershell
cd "C:\Users\Admin\Downloads\quan-ly-chung-cu-mini-main\quan-ly-chung-cu-mini-main"
Get-ChildItem package.json
```

### `DATABASE_URL is required`

Kiểm tra `.env.local` tồn tại ở thư mục gốc project, có dòng `DATABASE_URL=...`, URL đúng định dạng PostgreSQL và không có dấu nháy/placeholder chưa thay. Không gửi URL thật lên chat hoặc issue công khai.

### Auth trả `AUTH_UNAVAILABLE` hoặc database connection thất bại

- Xem terminal đang chạy Next.js và logs của Vercel để biết lỗi server cụ thể.
- Kiểm tra `DATABASE_URL` trỏ đúng database và Neon cho phép kết nối.
- Chạy `npm.cmd run db:migrate` trên đúng database.
- Xác nhận các bảng ứng dụng (ví dụ `accounts`, `sessions`, `workspaces`, `memberships`, `records`) đã được tạo.
- Nếu database mới chưa có account, đăng ký tài khoản chủ nhà từ giao diện. Migration chỉ tạo schema; không tạo user mặc định và cũng không nhập dữ liệu cũ.

### Upload ảnh lỗi

- Xác nhận Vercel Blob Store ở chế độ **Private** và đã kết nối với đúng project.
- Local cần credential Blob trong `.env.local`; Vercel cần Blob Store/credential được cấu hình cho project và môi trường tương ứng.
- Không thay đổi quyền của bucket sang Public để khắc phục tạm thời.

### Migration báo `NOTICE` schema hoặc bảng đã tồn tại

`NOTICE` như “schema already exists, skipping” thường chỉ thông báo đối tượng đã tồn tại. Đợi lệnh chạy hoàn tất và kiểm tra mã thoát/kết quả cuối. Nếu migration kết thúc bằng `ERROR`, hãy xử lý dựa trên thông báo lỗi cuối cùng; không xóa schema hoặc bảng migration theo phỏng đoán.

## Bảo mật dữ liệu

- Không commit `.env.local`, database URL, Blob token, snapshot D1/R2 hoặc file dữ liệu production.
- Không đặt thông tin bí mật trong `NEXT_PUBLIC_*`.
- Không lưu ảnh hợp đồng/giấy tờ ở kho public.
- Hạn chế quyền truy cập database, Blob Store, GitHub repository và Vercel project theo nguyên tắc cần biết.
- Dùng database riêng cho Development, Preview và Production khi có thể.
- Trước migration production hoặc chuyển dữ liệu, tạo backup và xác minh khả năng khôi phục.

## Scripts

| Lệnh | Mục đích |
|---|---|
| `npm.cmd run dev` | Chạy ứng dụng Next.js ở chế độ phát triển. |
| `npm.cmd run build` | Tạo production build. |
| `npm.cmd start` | Chạy production build đã tạo. |
| `npm.cmd run lint` | Kiểm tra mã nguồn bằng ESLint. |
| `node tests/accounts.mjs` | Chạy kiểm tra tài khoản, phân quyền và các luồng API liên quan. |
| `npm.cmd run db:generate` | Sinh Drizzle migration từ thay đổi schema. |
| `npm.cmd run db:migrate` | Áp dụng migration PostgreSQL chưa chạy. |
| `npm.cmd run data:export:d1` | Xuất dữ liệu Cloudflare D1 và tệp R2 vào `.migration/`. |
| `npm.cmd run data:import:d1` | Nạp snapshot vào PostgreSQL và private Blob; chỉ dùng trên đích trống. |
