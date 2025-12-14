# VPF V-League Crawler — Mô tả dự án

Dự án thu thập và hiển thị dữ liệu lịch thi đấu, kết quả và thông tin phát sóng (kênh TV) của giải V-League theo phong cách giao diện Business, sử dụng Express + EJS + Bootstrap, lưu dữ liệu bằng Prisma.

## Tổng quan chức năng
- Hiển thị danh sách trận đấu theo từng vòng (group theo `vong`).
- Bộ lọc theo vòng, đội, trạng thái có/không kết quả, có/không VAR.
- Giao diện bảng đơn giản, đều cột, popover hiển thị chi tiết kênh TV.
- Badge VAR hiển thị dưới tỷ số với icon `public/img/var.png`.
- Logo đội nhà/đội khách hiển thị cạnh tên đội (nhà: trước tên, khách: trước tên).
- Menu sticky-top, nội dung nằm trong `container` theo đúng chuẩn Bootstrap.

## Kiến trúc & thư mục
- `src/app.js`: Khởi tạo Express, cấu hình view engine EJS, phục vụ static, đăng ký route.
- `src/routes/listing.js`: Route `GET /listing` xử lý truy vấn, lọc, gom nhóm theo vòng và render EJS.
- `src/views/partials/head.ejs`: Nhúng Bootstrap CSS/JS, script khởi tạo Popover.
- `src/views/pages/listing.ejs`: Giao diện trang listing, gồm header, bộ lọc (card), các vòng (card header + bảng responsive).
- `src/utils/html.js`: Tiện ích `escapeHtml` để an toàn XSS khi cần.
- `src/scripts/import-vpf.js`: Import dữ liệu từ file HTML (cào trước) vào DB bằng Prisma.
- `src/scripts/scrape-vpf.js`: Scraper lấy dữ liệu HTML từ URL và xuất ra JSON (phục vụ import).
- `public/styles/listing.css`: Một số tuỳ chỉnh nhỏ bổ trợ cho Bootstrap (wrapper bảng, viền, ellipsis, căn giữa ảnh).
- `public/img/*`: Tài nguyên ảnh `var.png`, `football-tv.png` (fallback `tv.svg`), logo đội bóng.

## Dữ liệu & mô hình
- Prisma schema gồm các bảng `Season`, `Match` (xem `prisma/schema.prisma`).
- Các trường chính của `Match`: `maTran`, `doiNha`, `doiKhach`, `svd`, `ketQua`, `hasVar`, `kenhTv`, `matchDateTime`, `logoDoiNha`, `logoDoiKhach`, `vong`, `seasonId`.
- Kênh TV được tách từ chuỗi gốc theo các ký tự phân cách `, ; / |` vào mảng, hiển thị tổng số và popover chi tiết.
- VAR hiển thị dưới tỷ số nếu `hasVar = true`.

## Luồng dữ liệu
1. Nhập liệu từ HTML tĩnh (ví dụ `vleague-2026.html`):
   - Chạy `node src/scripts/import-vpf.js vleague-2026.html`
   - Script parser sẽ đọc file, trích thông tin trận, chuẩn hoá dữ liệu (thời gian, kết quả, logo, kênh TV), upsert vào DB.
2. Khả năng lấy dữ liệu từ URL thông qua scraper:
   - Chạy `node src/scripts/scrape-vpf.js https://vpf.vn/...` để tải HTML từ nguồn, trích xuất và xuất JSON.
   - JSON có thể được đưa vào bước import (tuỳ chỉnh importer) để hợp nhất với DB. Dự án đã sẵn có scraper để chuẩn bị cho luồng nhập liệu trực tiếp từ URL.

## Giao diện người dùng
- Navbar: `navbar-dark bg-primary sticky-top`, logo brand “VPF”.
- Header trang: tiêu đề “Danh sách trận đấu”, hiển thị tổng số trận.
- Bộ lọc: nằm trong `card`, sử dụng `form-select`, `form-control`, nút Bootstrap `btn`.
- Vòng đấu: mỗi vòng là `card` với `card-header bg-primary text-white`, nội dung là bảng responsive.
- Bảng: `table table-striped table-hover table-sm align-middle` với `table-layout: fixed`, `colgroup` điều chỉnh độ rộng, ellipsis cho nội dung dài.
- Popover kênh TV: icon `football-tv.png` (fallback `tv.svg`), hiển thị phía trên (placement `top`) khi hover/focus.

## API & Route
- `GET /listing`
  - Query params: `seasonId`, `vong`, `team`, `result` (`has|none`), `var` (`has|none`).
  - Render trang EJS, gom nhóm trận theo `vong`, sắp xếp theo `matchDateTime`.

## Chạy dự án
- Cài đặt phụ thuộc: `npm install`
- Khởi chạy server: `npm run start` → `http://localhost:3000/listing`
- Nhập dữ liệu từ HTML: `node src/scripts/import-vpf.js vleague-2026.html`
- (Tuỳ chọn) Cào dữ liệu từ URL: `node src/scripts/scrape-vpf.js https://...` → JSON để chuẩn bị import.

## Môi trường & bảo mật
- Cấu hình DB qua `.env` (ví dụ `DATABASE_URL` cho Prisma). Không commit `.env` (đã có `.gitignore`).
- Không log hay commit secrets. Static assets phục vụ từ `public/`.

## Triển khai & mở rộng
- Có thể deploy trên bất kỳ hosting hỗ trợ Node.js.
- Mở rộng importer để nhận trực tiếp URL (gọi scraper nội bộ), hoặc đọc JSON đầu ra từ scraper.
- Bổ sung API REST cho truy vấn dữ liệu nếu cần, thêm cache cho hiệu năng.

## Ghi chú phong cách giao diện (Business Style)
- Tối giản, sạch, chuyên nghiệp, dùng Bootstrap kết hợp một chút CSS tuỳ chỉnh.
- Bảng màu chính xanh dương, tương phản tốt; sử dụng các card, table, form chuẩn Bootstrap.

---

## Nâng cấp hệ thống cào linh hoạt theo Template JSON

Mục tiêu: biến cơ chế cào dữ liệu thành một hệ thống có thể cấu hình linh hoạt theo từng website, không phụ thuộc cứng vào selector cố định. Người dùng có thể tạo task cào, nhập URL, chọn hoặc tạo Template JSON, lên lịch bằng cron, theo dõi trạng thái, quản lý phiên bản kết quả và xuất dữ liệu.

### Kiến trúc tổng quan
- Lớp cấu hình (Template JSON): định nghĩa selector, cách trích xuất và chuẩn hoá dữ liệu, có thể tái sử dụng cho nhiều website cùng cấu trúc.
- Lớp tác vụ (Crawler Task): đại diện một yêu cầu cào cụ thể (URL, Template, lịch cron, bật/tắt, quyền truy cập kết quả).
- Lớp thực thi (Crawler Runner): engine cào và parse (ưu tiên HTTP + Cheerio; fallback headless browser khi cần JS-render), tôn trọng rate-limit.
- Lớp kết quả (Crawl Result): lưu version kết quả theo từng lần chạy, đánh dấu bản mới nhất, hỗ trợ retention (giữ lại N phiên bản gần nhất).
- Lớp giám sát (Monitoring): ghi log per-run, trạng thái (queued, running, success, failed), thời lượng, số item, lỗi.

### Mô hình dữ liệu (đề xuất)
- Template
  - `id`, `name`, `description`
  - `config` (JSON chi tiết bên dưới)
  - `createdAt`, `updatedAt`, `isActive`
- CrawlerTask
  - `id`, `name`
  - `url` (hoặc danh sách URL), `templateId` (tuỳ chọn; nếu không có thì dùng `customConfig`)
  - `customConfig` (JSON template inline)
  - `cron` (chuỗi biểu thức cron), `isActive` (bật/tắt)
  - `visibility` (`public|private`), `createdBy`
  - `retainLimit` (số phiên bản kết quả giữ lại)
  - `lastRunId`, `createdAt`, `updatedAt`
- CrawlRun
  - `id`, `taskId`, `status` (`queued|running|success|failed`)
  - `startedAt`, `finishedAt`, `durationMs`
  - `log` (chuỗi hoặc JSON), `error` (nếu có)
- CrawlResult
  - `id`, `taskId`, `runId`
  - `data` (JSON theo schema của template)
  - `itemCount`, `createdAt`

### Cấu trúc Template JSON (đề xuất)
```json
{
  "fetch": {
    "headers": { "User-Agent": "Mozilla/5.0" },
    "cookies": {},
    "timeoutMs": 20000,
    "rateLimit": { "requestsPerMinute": 30 },
    "dynamic": false,
    "pagination": {
      "enabled": false,
      "nextSelector": "a.next",
      "maxPages": 5
    }
  },
  "select": {
    "list": "table.match-list > tbody > tr",
    "fields": {
      "maTran": { "selector": "td:nth-child(2)", "type": "text" },
      "svd": { "selector": "td:nth-child(3)", "type": "text" },
      "doiNha": { "selector": "td:nth-child(4)", "type": "text" },
      "logoDoiNha": { "selector": "td:nth-child(4) img", "type": "attr", "name": "src" },
      "ketQua": { "selector": "td:nth-child(5)", "type": "text" },
      "hasVar": { "selector": "td:nth-child(5) .var-badge", "type": "exists" },
      "doiKhach": { "selector": "td:nth-child(6)", "type": "text" },
      "logoDoiKhach": { "selector": "td:nth-child(6) img", "type": "attr", "name": "src" },
      "kenhTvRaw": { "selector": "td:nth-child(7)", "type": "text" },
      "thuNgay": { "selector": "td:nth-child(1)", "type": "html" },
      "gio": { "selector": "td:nth-child(1)", "type": "text", "match": "^(\\d{1,2}:\\d{2})" },
      "vong": { "selector": "closestCardHeader", "type": "text" }
    }
  },
  "transform": {
    "kenhTv": { "split": ",|;|/|\\|", "trim": true, "filterEmpty": true },
    "gio": { "replace": [[":", "h"]] },
    "ketQua": { "defaultIfEmpty": "Chưa có tỷ số" }
  },
  "output": {
    "schema": ["maTran","svd","doiNha","logoDoiNha","ketQua","hasVar","doiKhach","logoDoiKhach","kenhTv","thuNgay","gio","vong"],
    "format": "json"
  }
}
```

Ghi chú:
- `type`: `text|html|attr|exists` giúp linh hoạt trích xuất.
- `transform`: pipeline nhẹ (split/trim/replace/default) không cần code tuỳ chỉnh; có thể mở rộng thêm hook `preprocess`/`postprocess` sandbox.
- `fetch.dynamic`: khi `true` dùng headless (ví dụ Playwright) để lấy DOM đã render.

### Luồng thao tác người dùng
1. Tạo Task cào:
   - Nhập `name`, `url`, chọn `template` hoặc dán `customConfig` JSON.
   - Thiết lập `cron` (ví dụ: `0 */2 * * *` cào mỗi 2 giờ), `retainLimit`, `visibility`, bật `isActive`.
   - “Lưu và kích hoạt”.
2. Theo dõi:
   - Trang “Tác vụ cào” hiển thị trạng thái mới nhất, số item, thời lượng, lỗi.
   - Có switch bật/tắt task.
3. Lịch sử & phiên bản:
   - Mỗi lần cào tạo `CrawlRun` + `CrawlResult` mới.
   - Có thể xem lại các phiên bản cũ; tự động xoá phiên bản cũ theo `retainLimit`.
4. Xuất dữ liệu:
   - `GET /api/crawlTasks/:id/results/latest` (JSON)
   - `GET /api/crawlTasks/:id/results/:resultId` (JSON)
   - Nếu `visibility = public` cho phép truy cập không đăng nhập; ngược lại yêu cầu xác thực.

### Quản lý Template & Test
- Danh sách Template: tạo/sửa/xoá; bật/tắt.
- Màn test template: nhập `url` + chọn Template (hoặc dán JSON), chạy thử và xem preview JSON.
- Ghi log parse (selector không khớp, số item, thời gian).

### Lịch & thực thi (đề xuất kỹ thuật)
- Lên lịch:
  - Cron dựa trên biểu thức chuẩn (ví dụ `node-cron`), hoặc job queue (ví dụ `Bull` + Redis) nếu cần scale/điều phối.
- Thực thi cào:
  - Ưu tiên HTTP fetch + Cheerio (nhanh, nhẹ).
  - Khi cần JS-render, bật `dynamic` và dùng headless (Playwright) với timeout/rate-limit.
- Chống chặn/điều phối:
  - Rate limit per-domain, random UA, tuỳ chọn delay giữa requests.
  - Tuân thủ robots.txt (cấu hình được) và pháp lý.

### Bảo mật & quyền truy cập
- `visibility`: `public|private` trên task.
- Endpoint export kiểm tra quyền; private chỉ dành cho người dùng đăng nhập.
- Sanitize và giới hạn hook transform để tránh thực thi code nguy hiểm.

### Khả năng mở rộng
- Thêm nhiều Template cho các website khác nhau.
- Hỗ trợ nhiều URL trên một Task (theo danh sách, hoặc pattern phân trang).
- Cache kết quả cào gần nhất để tăng tốc hiển thị.
- Theo dõi lỗi, cảnh báo khi selector không tìm thấy, hoặc số item giảm bất thường.

### Tích hợp với hiển thị V-League
- Luồng hiện tại: lấy bản kết quả mới nhất từ Task tương ứng, map JSON sang `Match`/`Season` để hiển thị.
- Có thể giữ nguyên hiển thị EJS; bổ sung route admin cho Task/Template.

### Route chuẩn hoá (REST)
- Listing (hiển thị V-League)
  - `GET /listing` — trang giao diện, hỗ trợ `seasonId`, `vong`, `team`, `result`, `var`.

- Template
  - `GET /api/templates?page&size&search` — liệt kê, tìm kiếm theo tên/mô tả.
  - `POST /api/templates` — tạo mới Template JSON.
  - `GET /api/templates/:id` — xem chi tiết template.
  - `PATCH /api/templates/:id` — cập nhật.
  - `DELETE /api/templates/:id` — xoá mềm hoặc xoá cứng (tuỳ chính sách).
  - `POST /api/templates/:id/test` — test với `url` đầu vào, trả về JSON preview.

- Task (CrawlerTask)
  - `GET /api/tasks?page&size&status&search` — liệt kê task, filter theo trạng thái `isActive`.
  - `POST /api/tasks` — tạo task: `name`, `url(s)`, `templateId|customConfig`, `cron`, `retainLimit`, `visibility`.
  - `GET /api/tasks/:id` — xem chi tiết task.
  - `PATCH /api/tasks/:id` — cập nhật thông tin/lịch/visibility.
  - `DELETE /api/tasks/:id` — xoá mềm (giữ lịch sử) hoặc xoá cứng.
  - `POST /api/tasks/:id/toggle` — bật/tắt `isActive`.
  - `POST /api/tasks/:id/run` — chạy thủ công một lần (bỏ qua cron).

- Run & Result
  - `GET /api/tasks/:id/runs?page&size&status` — lịch sử chạy (queued, running, success, failed).
  - `GET /api/runs/:runId` — chi tiết một lần chạy (log, thời lượng, item).
  - `GET /api/tasks/:id/results?page&size` — danh sách kết quả.
  - `GET /api/tasks/:id/results/latest` — kết quả mới nhất.
  - `GET /api/results/:resultId` — chi tiết một kết quả (JSON theo schema template).
  - `DELETE /api/results/:resultId` — xoá kết quả (phục vụ retention thủ công).

- Xuất dữ liệu
  - `GET /api/public/tasks/:id/results/latest` — nếu `visibility=public`, trả JSON không cần đăng nhập.
  - `GET /api/export/tasks/:id/results/latest` — bản private (yêu cầu auth), tuỳ chọn format `json|csv`.

- Quản trị hệ thống (tuỳ chọn)
  - `GET /api/system/status` — thống kê worker, queue, rate-limit.
  - `GET /api/system/config` — xem một số cấu hình runtime (timeout, rpm, v.v.).

### Lưu ý triển khai
- Bắt đầu với HTTP + Cheerio; chỉ dùng headless khi bắt buộc.
- Logging per-run + retention để kiểm soát dung lượng.
- Thử nghiệm kỹ Template JSON cho từng website; cung cấp preset mẫu.

---

## Quickstart
- Cài đặt: `npm install`
- Chạy server: `npm run start` → `http://localhost:3000/listing`
- Import từ HTML tĩnh: `node src/scripts/import-vpf.js vleague-2026.html`
- Scrape từ URL (xuất JSON): `node src/scripts/scrape-vpf.js https://...`
- Cấu hình DB: sử dụng luôn cấu hình PostgreSQL hiện tại của dự án
  - `DATABASE_URL` đã được thiết lập trong `.env` hiện tại, không cần thay đổi
  - Nếu chạy lần đầu trên môi trường mới: `npx prisma migrate deploy` và `npx prisma generate`
  - Tuỳ chọn: `PORT=3000`, `SCRAPER_TIMEOUT_MS=20000`, `SCRAPER_RATE_RPM=30`

## Lịch cron & điều phối
- Biểu thức cron hỗ trợ: ví dụ `0 */2 * * *` (mỗi 2 giờ), `0 7 * * 1-5` (7h sáng ngày thường).
- Rate limit theo domain, độ trễ ngẫu nhiên, giới hạn đồng thời để tránh bị chặn.
- Retention: thiết lập `retainLimit` per-task (ví dụ 10 phiên bản gần nhất).

## Bảo mật & tuân thủ
- Tôn trọng `robots.txt` nếu cấu hình bật.
- Thiết lập `visibility` cho task/result: `public` hoặc `private` (yêu cầu đăng nhập).
- Sanitize output và tránh thực thi code trong transform (sandbox hoá nếu mở rộng).

## Giám sát & chất lượng
- Logging per-run: thời lượng, số item, lỗi, retry count.
- Metric đề xuất: thành công/thất bại theo thời gian, số item/URL, độ trễ trung bình.
- Lint EJS: dùng `ejs-lint` để phát hiện lỗi scriptlet.

## Roadmap (đề xuất)
- Trang quản trị Task/Template/Result (CRUD + preview JSON).
- Hỗ trợ headless (Playwright) tuỳ chọn per-template (`fetch.dynamic=true`).
- Job queue để scale (Redis + Bull), retry có backoff.
- Plugin output: JSON, CSV, webhook post, lưu kho dữ liệu thứ cấp.

## FAQ ngắn
- “Có thể cào nhiều URL trong một task?” → Có, template hỗ trợ danh sách URL hoặc phân trang.
- “Nếu website thay đổi DOM?” → Cập nhật Template JSON tương ứng; hệ thống tách selector khỏi code để dễ bảo trì.
- “Có thể xem lại kết quả cũ?” → Có, lưu phiên bản theo `CrawlRun/CrawlResult`, giữ theo `retainLimit`.

---

## Ví dụ nhanh: Template & lệnh curl

### Template JSON sample (cào từ trang listing hiện tại)
```json
{
  "fetch": { "headers": { "User-Agent": "Mozilla/5.0" }, "timeoutMs": 20000 },
  "select": {
    "list": ".card .table tbody tr",
    "fields": {
      "maTran": { "selector": "td:nth-child(2)", "type": "text" },
      "svd": { "selector": "td:nth-child(3)", "type": "text" },
      "doiNha": { "selector": "td:nth-child(4)", "type": "text" },
      "logoDoiNha": { "selector": "td:nth-child(4) img", "type": "attr", "name": "src" },
      "ketQua": { "selector": "td:nth-child(5)", "type": "text" },
      "hasVar": { "selector": "td:nth-child(5) .var-badge", "type": "exists" },
      "doiKhach": { "selector": "td:nth-child(6)", "type": "text" },
      "logoDoiKhach": { "selector": "td:nth-child(6) img", "type": "attr", "name": "src" },
      "kenhTvRaw": { "selector": "td:nth-child(7) .tv-badge", "type": "attr", "name": "data-bs-content" },
      "thuNgay": { "selector": "td:nth-child(1)", "type": "html" },
      "gio": { "selector": "td:nth-child(1)", "type": "text", "match": "^(\\d{1,2}h\\d{2})" },
      "vong": { "selector": "closestCardHeader", "type": "text" }
    }
  },
  "transform": {
    "kenhTv": { "split": "<br\\s*/?>", "trim": true, "filterEmpty": true },
    "ketQua": { "defaultIfEmpty": "Chưa có tỷ số" }
  },
  "output": {
    "schema": ["maTran","svd","doiNha","logoDoiNha","ketQua","hasVar","doiKhach","logoDoiKhach","kenhTv","thuNgay","gio","vong"],
    "format": "json"
  }
}
```

### Test Template trực tiếp
```bash
curl -X POST http://localhost:3000/api/templates/test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3000/listing",
    "template": {
      "fetch": { "headers": { "User-Agent": "Mozilla/5.0" }, "timeoutMs": 20000 },
      "select": {
        "list": ".card .table tbody tr",
        "fields": {
          "maTran": { "selector": "td:nth-child(2)", "type": "text" },
          "svd": { "selector": "td:nth-child(3)", "type": "text" },
          "doiNha": { "selector": "td:nth-child(4)", "type": "text" },
          "logoDoiNha": { "selector": "td:nth-child(4) img", "type": "attr", "name": "src" },
          "ketQua": { "selector": "td:nth-child(5)", "type": "text" },
          "hasVar": { "selector": "td:nth-child(5) .var-badge", "type": "exists" },
          "doiKhach": { "selector": "td:nth-child(6)", "type": "text" },
          "logoDoiKhach": { "selector": "td:nth-child(6) img", "type": "attr", "name": "src" },
          "kenhTvRaw": { "selector": "td:nth-child(7) .tv-badge", "type": "attr", "name": "data-bs-content" },
          "thuNgay": { "selector": "td:nth-child(1)", "type": "html" },
          "gio": { "selector": "td:nth-child(1)", "type": "text", "match": "^(\\d{1,2}h\\d{2})" },
          "vong": { "selector": "closestCardHeader", "type": "text" }
        }
      },
      "transform": {
        "kenhTv": { "split": "<br\\\\s*/?>", "trim": true, "filterEmpty": true },
        "ketQua": { "defaultIfEmpty": "Chưa có tỷ số" }
      },
      "output": {
        "schema": ["maTran","svd","doiNha","logoDoiNha","ketQua","hasVar","doiKhach","logoDoiKhach","kenhTv","thuNgay","gio","vong"],
        "format": "json"
      }
    }
  }'
```

### Tạo Task và chạy
```bash
# Tạo task (chạy mỗi 2 giờ)
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cao V-League",
    "url": "http://localhost:3000/listing",
    "template": { ... như trên ... },
    "cron": "0 */2 * * *",
    "retainLimit": 10,
    "visibility": "private",
    "isActive": true
  }'

# Chạy thủ công ngay
curl -X POST http://localhost:3000/api/tasks/<ID>/run

# Lấy kết quả mới nhất
curl http://localhost:3000/api/tasks/<ID>/results/latest
```
