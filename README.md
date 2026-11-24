# Thư Các

Trang đọc sách EPUB với tủ sách cá nhân, hiệu ứng sách giấy, ghi chú và tùy chỉnh không gian đọc.

## Chạy trên máy phát triển

Yêu cầu Node.js 20 trở lên.

```bash
npm ci
npm run dev
```

Mở địa chỉ Vite in ra trong terminal. Để tạo bản production: `npm run build`.

## Sử dụng

- Nhấn **Thêm sách EPUB** hoặc kéo tệp `.epub` vào vùng tải lên. Có thể chọn nhiều tệp.
- Nhấn bìa sách để đọc. Dùng nút hai bên trang hoặc phím mũi tên để chuyển trang.
- Chọn một đoạn văn để bôi đậm và viết ghi chú. Nút đánh dấu trên thanh công cụ lưu vị trí hiện tại.
- Trong trình đọc có mục lục, sổ tay, chế độ tập trung, đồng hồ đọc và tùy chọn kiểu chữ, cỡ chữ, giãn dòng, nền giấy.
- Sách nhập được lưu trong IndexedDB của trình duyệt. Tiến độ đọc, ghi chú và cài đặt được lưu cục bộ trong cùng trình duyệt. Xóa dữ liệu trình duyệt sẽ xóa các mục này; hiện chưa có tài khoản hoặc đồng bộ đám mây.

Ba EPUB mẫu là nội dung ngắn do dự án tạo để thử giao diện. Có thể tạo lại bằng `python3 scripts/generate_samples.py`.
