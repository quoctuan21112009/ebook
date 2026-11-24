# Thư Các

Mạng xã hội đọc sách và tranh luận theo đoạn văn. Người dùng tải EPUB/PDF riêng tư hoặc chia sẻ tài liệu được phép phân phối, đọc trong Zen Mode và tham gia bình luận theo ngữ cảnh ở Social Mode.

## Chạy ứng dụng

Yêu cầu Node.js 24 trở lên (dùng SQLite có sẵn trong Node).

```bash
npm ci
npm run dev
```

`npm run dev` chạy API tại cổng 3001 và Vite tại cổng 4173. Để xem bản build đầy đủ: `npm run build && npm run preview`; khi triển khai trên máy chủ Node.js dùng `npm start`. Có thể đặt `DATA_DIR` để chọn thư mục dữ liệu máy chủ và `PORT` để đổi cổng. Nếu chưa đặt `DATABASE_URL`, dữ liệu được lưu trong `.data/` bằng SQLite và tệp trên ổ đĩa. Khi đặt `DATABASE_URL`, trạng thái thư viện và tệp được lưu trong PostgreSQL; máy chủ có thể nhập dữ liệu `.data/` cũ một lần.

Trên Vercel chưa có cơ sở dữ liệu và kho tệp, ứng dụng tự chuyển sang **chế độ thiết bị**: hồ sơ, sách, ghi chú, bài viết và fanpage lưu trong trình duyệt, không đồng bộ với người khác. Để bật bảng tin chung trên Vercel cần triển khai API cùng cơ sở dữ liệu và kho tệp bền vững; chỉ chạy bản build Vite sẽ không tạo ra API.

## Triển khai trên Render

Repository có [`render.yaml`](render.yaml) để chạy giao diện và API chung trong một **Web Service**. Trên Render, chọn **New → Blueprint**, kết nối repository này rồi tạo dịch vụ từ Blueprint. Render dùng Node.js 24, chạy `npm ci --include=dev && npm run build`, sau đó `node server/index.js` với `NODE_ENV=production`. Cờ `--include=dev` bảo đảm Vite có mặt trong bước build. Kiểm tra `https://<tên-dịch-vụ>.onrender.com/api/health` trả về `ok: true` và `storage: postgresql`.

Blueprint yêu cầu biến bí mật `DATABASE_URL`: dán URI kết nối PostgreSQL của dự án Supabase vào phần Environment của Render, thay phần mật khẩu mẫu bằng mật khẩu thật. Không đưa URI này hoặc khóa Supabase vào mã nguồn. Server tạo hai bảng `thu_cac_state` (trạng thái thư viện SQLite đã nén) và `thu_cac_files` (EPUB/PDF, bìa) trong PostgreSQL. Dữ liệu của người dùng dùng chung qua API Render; dung lượng sách tính vào giới hạn cơ sở dữ liệu Supabase. Khóa publishable không cần thiết cho kết nối máy chủ này.

Blueprint vẫn giữ gói **Starter** và ổ đĩa 1 GB tại `/var/data` để nhập dữ liệu SQLite/tệp từ bản Render cũ nếu đã chạy trước đó. Lần đầu kết nối Supabase, server tự nhập dữ liệu này rồi ghi tiếp vào PostgreSQL. Giữ ổ đĩa cho đến khi kiểm tra đủ sách, hồ sơ và bài viết trên bản mới; sau đó mới cân nhắc bỏ ổ đĩa và đổi gói Render. Gói Starter và ổ đĩa có tính phí. `PORT` do Render cấp tự động. Nếu URI trực tiếp của Supabase không kết nối được từ Render, dùng URI **Session Pooler** trong Supabase Dashboard làm `DATABASE_URL`. Dữ liệu đã lưu cục bộ tại Vercel không tự chuyển sang Render.

## Những gì đã có

- Không gian đọc có ảnh nền thư phòng nhìn ra núi rừng được tạo riêng, lưu trong `public/landscapes/reading-sanctuary*.webp`. Có bản cho điện thoại, màn hình thường và màn hình mật độ cao; chế độ đêm phủ tối nền để trang chữ rõ.
- Sách lật 3D dùng StPageFlip 2.0.7: mở từ bìa cứng, cùng tỷ lệ trang 1:1,414, hai trang trên màn hình rộng và một trang trên điện thoại; kéo góc, vuốt hoặc dùng mũi tên để lật giấy có bóng động. EPUB được chia trang theo kích thước chữ đo trong trình duyệt, theo từng chương; PDF giữ hình trang gốc và dựng từng nhóm tối đa 12 trang. Chuyển chương bằng bộ chọn ở chân sách hoặc mũi tên sau trang cuối.
- Trong sách 3D, bật **Chọn chữ** để tạm tắt kéo lật và dùng lựa chọn văn bản gốc; có ghi chú riêng, bình luận theo đoạn ở sách công khai và tạo ảnh trích dẫn. Nút **Đọc chữ / công cụ** chuyển về trình đọc có đầy đủ công cụ đọc và AI. Bố cục EPUB 3D dùng dàn chữ đơn giản; tài liệu nhiều bảng, công thức hoặc bố cục đặc biệt nên dùng PDF hoặc trình đọc chữ. Vuốt đã được kiểm tra bằng mô phỏng cảm ứng Chromium, chưa kiểm tra trên thiết bị iOS thật.

- Vào thư viện bằng tên hiển thị, không có bước đăng ký hoặc mật khẩu. Trên máy chủ, hồ sơ khách có cookie HTTP-only; người khác không thể nhập trùng tên để lấy sách riêng tư. Tài khoản có mật khẩu cũ vẫn được bảo vệ. Nếu mất cookie, hồ sơ khách không thể khôi phục bằng cách nhập lại tên; hãy giữ bản sao lưu sách.
- EPUB lấy metadata và bìa thật; PDF lấy trang đầu làm bìa. Tệp PDF có lớp chữ được tự động tạo bản EPUB để đọc linh hoạt. Bộ chuyển đổi ghép chữ theo vị trí để tránh khoảng trắng chen vào giữa từ tiếng Việt và tạo lại bản EPUB cũ khi mở. PDF ảnh quét vẫn đọc được trực tiếp nhưng chưa có OCR; bản chuyển đổi chữ không giữ nguyên hình ảnh/bố cục.
- Trình đọc EPUB áp dụng cỡ chữ và phông của người đọc cả khi sách có CSS cố định hoặc `!important`, nạp phông trước khi dàn trang và giữ thiết lập khi mở lại. Có nút khôi phục kiểu chữ mặc định. Đoạn văn dài được gỡ ngắt dòng cứng khi có đủ dấu hiệu văn xuôi; các khối thơ, mã và bảng giữ xuống dòng. Trình đọc có phông tiếng Việt đóng gói với nét chữ rõ, thay cỡ chữ, độ dài dòng, thụt đầu đoạn, khoảng cách đoạn, nền giấy, mục lục, dấu trang, bôi đậm, ghi chú, âm thanh lật trang, hiệu ứng mở sách và đồng hồ tập trung. Trang đọc chừa mép dưới và giữ ít nhất hai dòng của đoạn khi ngắt trang để tránh chữ bị cắt/chèn tại ranh giới trang.
- Zen Mode ẩn giao diện xã hội. Social Mode hiển thị vạch bình luận và ngăn thảo luận; bình luận chỉ được gửi sau khi chọn một đoạn văn và một nhãn: Bổ sung kiến thức, Phản biện hoặc Cảm nhận.
- Upvote/downvote, trọng số phiếu của tài khoản Học giả, tự ẩn bình luận dưới ngưỡng -5, giới hạn một bình luận/ngày khi karma âm. Trang trao đổi có Arena và bảng cống hiến.
- Bảng tin, diễn đàn và fanpage: tạo trang, theo dõi, đăng bài và ảnh WebP nén, gắn sách công khai, tìm kiếm, lọc bài đã lưu hoặc từ trang theo dõi, bình luận, thích, lưu và báo cáo bài viết. Chủ bài có thể xóa bài. API máy chủ lưu dữ liệu SQLite; chế độ thiết bị lưu riêng trong trình duyệt.
- Tìm sách và lọc theo thể loại, thẻ, người đóng góp. Người đăng sửa metadata; mỗi người có thể chấm sao và lưu trích dẫn cá nhân. Tệp giống hệt được phát hiện bằng SHA-256.
- Trang chủ lấy cảm hứng từ thư phòng cổ điển với ba ảnh thiên nhiên lưu ngay trong mã nguồn. Bố cục thích ứng cho điện thoại; thống kê hiển thị số sách, sách hoàn tất và thời gian đọc thực tế.
- Tủ sách cá nhân chỉ hiển thị sách do username hiện tại tải lên; mục đang đọc dùng tiến độ riêng của username. Các hàng khám phá vẫn có sách cộng đồng. Chạm chữ không tự mở ghi chú. Nhấn giữ và kéo tay nắm chọn văn bản EPUB, rồi chọn Ghi chú / bình luận hoặc Tạo ảnh. Có nút lấy toàn trang đang đọc; người đọc tạo ảnh trích dẫn 2160×2880 có caption, 20 mẫu nền đồ họa và bốn dạng khung sách, đăng bảng tin hoặc fanpage và tải ảnh WebP sạch để chia sẻ. Ảnh trên máy chủ lưu thành tệp riêng; chế độ thiết bị dùng IndexedDB. Phần đọc cho chỉnh giới hạn độ dài dòng khoảng 45–75 ký tự.
- EPUB và PDF có khung thử hiển thị ChatGPT, Gemini hoặc Claude trong trang đọc; các nhà cung cấp có thể chặn iframe bằng chính sách của họ, khi đó dùng nút mở website gốc cạnh sách. Có thể dán link cuộc trò chuyện hiện có và sao chép đoạn sách sang AI. Trên điện thoại, trang AI mở trong thẻ mới.
- Cổng AI sao chép câu hỏi và ghi chú rồi mở ChatGPT, Gemini hoặc Claude trên website của họ. Âm thanh nền tạo bằng Web Audio; có tìm theo tên trên YouTube và phát tệp MP3 từ thiết bị trong phiên duyệt (không tải lên máy chủ).
- Sao lưu thư viện thành ZIP và khôi phục trong trình duyệt. Máy chủ lưu tài khoản, sách, tiến độ, ghi chú và thảo luận; IndexedDB giữ bản sách đã mở để đọc nhanh.

## Giới hạn hiện tại

Cần API máy chủ và nơi lưu trữ bền vững như PostgreSQL để đồng bộ giữa thiết bị và có cộng đồng chung. Cách lưu PostgreSQL hiện dùng một bản SQLite nén cho trạng thái và bảng riêng cho tệp, phù hợp một máy chủ Render; chưa hỗ trợ nhiều máy chủ cùng ghi hoặc truy vấn từng hoạt động trực tiếp qua Supabase Dashboard. Hồ sơ khách phụ thuộc vào cookie của trình duyệt, không có cách khôi phục sau khi mất cookie; cần thêm một phương thức khôi phục trước khi dùng cho dữ liệu quan trọng. Chưa có OCR PDF ảnh quét, kiểm duyệt báo cáo tự động, duyệt bản hợp nhất, hoặc hệ thống quảng cáo và gói Pro. Không tải lên sách mà bạn không có quyền chia sẻ ở chế độ công khai. Không lấy sách hoặc nhạc tự động từ Waka, Dilib, YouTube khi chưa có API và quyền sử dụng phù hợp. Thư Các không tải MP3 từ YouTube. ChatGPT, Gemini và Claude có thể từ chối hiển thị trong iframe; website không thể vượt qua giới hạn này.
