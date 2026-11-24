# Thư Các

Mạng xã hội đọc sách và tranh luận theo đoạn văn. Người dùng tải EPUB/PDF riêng tư hoặc chia sẻ tài liệu được phép phân phối, đọc trong Zen Mode và tham gia bình luận theo ngữ cảnh ở Social Mode.

## Chạy ứng dụng

Yêu cầu Node.js 24 trở lên (dùng SQLite có sẵn trong Node).

```bash
npm ci
npm run dev
```

`npm run dev` chạy API tại cổng 3001 và Vite tại cổng 4173. Để xem bản build đầy đủ: `npm run build && npm run preview`; khi triển khai trên máy chủ Node.js dùng `npm start`. Có thể đặt `DATA_DIR` để chọn thư mục dữ liệu máy chủ và `PORT` để đổi cổng. Thư mục dữ liệu mặc định `.data/` chứa SQLite và tệp sách; cần ổ đĩa bền vững và sao lưu định kỳ khi triển khai.

Trên Vercel chưa có cơ sở dữ liệu và kho tệp, ứng dụng tự chuyển sang **chế độ thiết bị**: hồ sơ, sách, ghi chú, bài viết và fanpage lưu trong trình duyệt, không đồng bộ với người khác. Để bật bảng tin chung trên Vercel cần triển khai API cùng cơ sở dữ liệu và kho tệp bền vững; chỉ chạy bản build Vite sẽ không tạo ra API.

## Những gì đã có

- Vào thư viện bằng tên hiển thị, không có bước đăng ký hoặc mật khẩu. Trên máy chủ, hồ sơ khách có cookie HTTP-only; người khác không thể nhập trùng tên để lấy sách riêng tư. Tài khoản có mật khẩu cũ vẫn được bảo vệ. Nếu mất cookie, hồ sơ khách không thể khôi phục bằng cách nhập lại tên; hãy giữ bản sao lưu sách.
- EPUB lấy metadata và bìa thật; PDF lấy trang đầu làm bìa. Tệp PDF có lớp chữ được tự động tạo bản EPUB để đọc linh hoạt. Bộ chuyển đổi ghép chữ theo vị trí để tránh khoảng trắng chen vào giữa từ tiếng Việt và tạo lại bản EPUB cũ khi mở. PDF ảnh quét vẫn đọc được trực tiếp nhưng chưa có OCR; bản chuyển đổi chữ không giữ nguyên hình ảnh/bố cục.
- Trình đọc EPUB có phông tiếng Việt đóng gói với nét chữ rõ, thay cỡ chữ, độ dài dòng, thụt đầu đoạn, khoảng cách đoạn, nền giấy, mục lục, dấu trang, bôi đậm, ghi chú, âm thanh lật trang, hiệu ứng mở sách và đồng hồ tập trung. Trang đọc chừa mép dưới và giữ ít nhất hai dòng của đoạn khi ngắt trang để tránh chữ bị cắt/chèn tại ranh giới trang.
- Zen Mode ẩn giao diện xã hội. Social Mode hiển thị vạch bình luận và ngăn thảo luận; bình luận chỉ được gửi sau khi chọn một đoạn văn và một nhãn: Bổ sung kiến thức, Phản biện hoặc Cảm nhận.
- Upvote/downvote, trọng số phiếu của tài khoản Học giả, tự ẩn bình luận dưới ngưỡng -5, giới hạn một bình luận/ngày khi karma âm. Trang trao đổi có Arena và bảng cống hiến.
- Bảng tin, diễn đàn và fanpage: tạo trang, theo dõi, đăng bài, gắn sách công khai, tìm kiếm, lọc bài đã lưu hoặc từ trang theo dõi, bình luận, thích, lưu và báo cáo bài viết. Chủ bài có thể xóa bài. API máy chủ lưu dữ liệu SQLite; chế độ thiết bị lưu riêng trong trình duyệt.
- Tìm sách và lọc theo thể loại, thẻ, người đóng góp. Người đăng sửa metadata; mỗi người có thể chấm sao và lưu trích dẫn cá nhân. Tệp giống hệt được phát hiện bằng SHA-256.
- Trang chủ lấy cảm hứng từ thư phòng cổ điển với ba ảnh thiên nhiên lưu ngay trong mã nguồn. Bố cục thích ứng cho điện thoại; thống kê hiển thị số sách, sách hoàn tất và thời gian đọc thực tế.
- Thư viện có các hàng sách cuộn ngang cho sách mới, sách đang đọc và sách cộng đồng; có lọc thể loại và liên kết mở Waka, Dilib tại trang gốc. Phần đọc cho chỉnh giới hạn độ dài dòng khoảng 45–75 ký tự.
- EPUB và PDF có bộ điều khiển mở cửa sổ ChatGPT, Gemini hoặc Claude bên cạnh sách trên desktop, dùng tài khoản và lịch sử chat có sẵn. Có thể dán link cuộc trò chuyện hiện có và sao chép đoạn sách sang AI. Trên điện thoại, trang AI mở trong thẻ mới.
- Cổng AI sao chép câu hỏi và ghi chú rồi mở ChatGPT, Gemini hoặc Claude trên website của họ. Âm thanh nền tạo bằng Web Audio và liên kết tìm nhạc bên ngoài.
- Sao lưu thư viện thành ZIP và khôi phục trong trình duyệt. Máy chủ lưu tài khoản, sách, tiến độ, ghi chú và thảo luận; IndexedDB giữ bản sách đã mở để đọc nhanh.

## Giới hạn hiện tại

Cần máy chủ và ổ đĩa bền vững để đồng bộ giữa thiết bị và có cộng đồng chung. Hồ sơ khách phụ thuộc vào cookie của trình duyệt, không có cách khôi phục sau khi mất cookie; cần thêm một phương thức khôi phục trước khi dùng cho dữ liệu quan trọng. Chưa có OCR PDF ảnh quét, kiểm duyệt báo cáo tự động, duyệt bản hợp nhất, hoặc hệ thống quảng cáo và gói Pro. Không tải lên sách mà bạn không có quyền chia sẻ ở chế độ công khai. Waka và Dilib hiện chỉ là đường dẫn đến nguồn; chưa nhập sách tự động vì chưa có tài liệu API công khai và quyền tái phân phối được xác nhận. Các trang AI không có cách nhúng được hỗ trợ trong Thư Các; cửa sổ AI mở trang gốc của nhà cung cấp, không phải chat nhúng trong HTML.
