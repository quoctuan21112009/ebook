# Thư Các

Mạng xã hội đọc sách và tranh luận theo đoạn văn. Người dùng tải EPUB/PDF riêng tư hoặc chia sẻ tài liệu được phép phân phối, đọc trong Zen Mode và tham gia bình luận theo ngữ cảnh ở Social Mode.

## Chạy ứng dụng

Yêu cầu Node.js 24 trở lên (dùng SQLite có sẵn trong Node).

```bash
npm ci
npm run dev
```

`npm run dev` chạy API tại cổng 3001 và Vite tại cổng 4173. Để chạy bản build: `npm run build && npm start`. Có thể đặt `DATA_DIR` để chọn thư mục dữ liệu máy chủ và `PORT` để đổi cổng khi chạy production. Thư mục dữ liệu mặc định `.data/` chứa SQLite và tệp sách; cần ổ đĩa bền vững và sao lưu định kỳ khi triển khai.

## Những gì đã có

- Tài khoản tên đăng nhập/mật khẩu trên máy chủ, phiên đăng nhập bằng cookie HTTP-only, mật khẩu băm bằng scrypt. Tài liệu công khai đọc được bởi tài khoản khác; sách riêng tư chỉ chủ sở hữu thấy.
- EPUB lấy metadata và bìa thật; PDF lấy trang đầu làm bìa. Tệp PDF có lớp chữ được tự động tạo bản EPUB để đọc linh hoạt. PDF ảnh quét vẫn đọc được trực tiếp nhưng chưa có OCR; bản chuyển đổi chữ không giữ nguyên hình ảnh/bố cục.
- Trình đọc EPUB có phông tiếng Việt đóng gói, thay cỡ chữ, nền giấy, mục lục, dấu trang, bôi đậm, ghi chú, âm thanh lật trang, hiệu ứng mở sách và đồng hồ tập trung.
- Zen Mode ẩn giao diện xã hội. Social Mode hiển thị vạch bình luận và ngăn thảo luận; bình luận chỉ được gửi sau khi chọn một đoạn văn và một nhãn: Bổ sung kiến thức, Phản biện hoặc Cảm nhận.
- Upvote/downvote, trọng số phiếu của tài khoản Học giả, tự ẩn bình luận dưới ngưỡng -5, giới hạn một bình luận/ngày khi karma âm. Trang trao đổi có Arena và bảng cống hiến.
- Tìm sách và lọc theo thể loại, thẻ, người đóng góp. Người đăng sửa metadata; mỗi người có thể chấm sao và lưu trích dẫn cá nhân. Tệp giống hệt được phát hiện bằng SHA-256.
- Trang chủ lấy cảm hứng từ thư phòng cổ điển với ba ảnh thiên nhiên lưu ngay trong mã nguồn. Bố cục thích ứng cho điện thoại; thống kê hiển thị số sách, sách hoàn tất và thời gian đọc thực tế.
- Cổng AI sao chép câu hỏi và ghi chú rồi mở ChatGPT, Gemini hoặc Claude trên website của họ. Âm thanh nền tạo bằng Web Audio và liên kết tìm nhạc bên ngoài.
- Sao lưu thư viện thành ZIP và khôi phục trong trình duyệt. Máy chủ lưu tài khoản, sách, tiến độ, ghi chú và thảo luận; IndexedDB giữ bản sách đã mở để đọc nhanh.

## Giới hạn hiện tại

Cần máy chủ và ổ đĩa bền vững để đồng bộ giữa thiết bị. Chưa có khôi phục mật khẩu bằng email, OCR PDF ảnh quét, kiểm duyệt nội dung tự động/duyệt bản hợp nhất, hoặc hệ thống quảng cáo và gói Pro. Không tải lên sách mà bạn không có quyền chia sẻ ở chế độ công khai. Cổng AI không truy cập được nội dung cuộc hội thoại trên các website AI.
