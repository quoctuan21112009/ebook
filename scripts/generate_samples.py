"""Build three original, short EPUB samples for the reading room."""
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'books'
ROOT.mkdir(parents=True, exist_ok=True)

BOOKS = [
    ('nhung-ngay-cham-lai', 'Những ngày chậm lại', 'Tản văn', [
        ('Một buổi sáng không vội', [
            'Có những buổi sáng thành phố thức dậy trước chúng ta. Qua khung cửa, nắng đã đặt một vệt vàng lên bàn, nơi cuốn sách còn mở từ đêm qua. Tôi pha trà, ngồi xuống và quyết định rằng hôm nay mình sẽ không vội.',
            'Chúng ta quen đo ngày bằng những việc đã hoàn thành. Nhưng đôi khi, một ngày đáng nhớ bắt đầu bằng việc chịu ngồi yên: nghe tiếng nước sôi, nhìn một chiếc lá rơi, đọc lại một câu văn mà hôm qua ta đã lướt qua.',
            'Sự chậm rãi không lấy đi thời gian. Nó trả lại cho thời gian hình dáng của nó. Một buổi sáng có thể rộng như cả khu vườn, nếu ta thật sự có mặt ở đó.'
        ]),
        ('Chiếc ghế bên cửa sổ', [
            'Chiếc ghế gỗ kê bên cửa sổ không đẹp theo cách người ta thường gọi là đẹp. Sơn đã bong ở tay vịn, một chân ghế hơi ngắn. Vậy mà mỗi lần trở về, tôi đều tìm đến nó trước tiên.',
            'Ở đó, tôi đọc được vài trang sách mà không nghĩ đến trang cuối. Có lúc chỉ đọc một đoạn, rồi ngẩng lên nhìn mây. Câu chữ cứ thế đi vào trí nhớ như mưa thấm xuống đất.',
            'Một nơi để đọc không cần hoàn hảo. Nó chỉ cần đủ yên để ta nghe thấy suy nghĩ của mình.'
        ]),
        ('Mang theo một khoảng lặng', [
            'Khi đóng sách lại, tôi đặt vào giữa hai trang một mảnh giấy nhỏ. Không phải để đánh dấu nơi mình dừng, mà để nhắc rằng mình có thể quay lại bất cứ lúc nào.',
            'Sách cho ta mượn những cuộc đời khác. Rồi khi trở về cuộc đời mình, ta mang theo một chút dịu dàng, một câu hỏi mới, hoặc can đảm để nhìn mọi thứ rõ hơn.',
            'Ngày mai có thể vẫn rất bận. Nhưng một khoảng lặng vừa đủ cho vài trang sách thì luôn có thể bắt đầu từ bây giờ.'
        ])
    ]),
    ('loi-cua-khu-vuon', 'Lời của khu vườn', 'Truyện ngắn', [
        ('Cánh cổng màu xanh', [
            'Ở cuối con hẻm có một cánh cổng sơn xanh. Mỗi chiều, bà An mở cổng để lũ trẻ trong xóm vào xem khu vườn nhỏ của bà. Khu vườn không có hoa quý, chỉ có húng quế, mấy khóm cúc và một cây khế già.',
            'Một hôm, Minh hỏi bà tại sao bà không bán mảnh đất ấy. Bà An cười: “Vì có vài thứ lớn lên tốt hơn khi được chia sẻ.” Minh chưa hiểu, nhưng cậu thích cách bà nói, như thể từng chiếc lá cũng đang lắng nghe.'
        ]),
        ('Hạt giống trong túi áo', [
            'Trước khi đi, bà An đặt vào tay Minh một hạt giống bé xíu. “Con thử trồng xem. Không cần biết trước nó sẽ thành gì.” Cậu mang hạt giống về, tìm một chiếc cốc cũ và đặt bên cửa sổ.',
            'Mỗi sáng Minh tưới một ít nước. Có những ngày chiếc cốc chỉ toàn đất đen. Cậu suýt bỏ cuộc. Rồi vào một sáng mưa, một chấm xanh đã nhô lên, nhỏ đến mức cậu phải cúi sát mới thấy.',
            'Minh chạy sang báo bà An. Bà chỉ gật đầu, đôi mắt sáng lên như đã chờ tin ấy từ lâu.'
        ]),
        ('Ngày khu vườn mở cửa', [
            'Nhiều tháng sau, trên bệ cửa sổ nhà Minh là một chậu hoa vàng. Cậu mang chậu hoa sang khu vườn cuối hẻm. Bà An đặt nó cạnh cổng, nơi ai đi ngang cũng có thể nhìn thấy.',
            'Minh chợt hiểu điều bà từng nói. Hạt giống bé nhỏ đã làm căn phòng của cậu vui hơn, và bây giờ nó làm cả con hẻm sáng lên.',
            'Chiều ấy, cánh cổng màu xanh mở lâu hơn mọi ngày. Không ai vội về.'
        ])
    ]),
    ('nghe-thuat-hoc-sau', 'Nghệ thuật học sâu', 'Ghi chép học tập', [
        ('Đọc với một câu hỏi', [
            'Trước khi mở một cuốn sách, hãy viết ra một câu hỏi bạn thật sự muốn trả lời. Câu hỏi không cần lớn. “Tại sao nhân vật này đổi ý?” hay “Mình có thể áp dụng điều này vào ngày mai không?” đều đủ tốt.',
            'Khi có câu hỏi, việc đọc trở thành một cuộc trò chuyện. Bạn chú ý đến những chi tiết liên quan, dừng lại ở những câu làm mình ngạc nhiên và ghi chú bằng lời của chính mình.',
            'Thử ngay: chọn một chương ngắn. Đọc xong, đóng sách và viết ba câu về điều bạn nhớ. Sau đó mở lại để xem phần nào bạn muốn hiểu sâu hơn.'
        ]),
        ('Ghi chú để nghĩ tiếp', [
            'Một ghi chú hữu ích không chỉ chép lại nguyên văn. Nó ghi được lý do câu văn ấy quan trọng với bạn. Hãy bôi đậm ít hơn, nhưng đặt nhiều câu hỏi hơn.',
            'Bạn có thể dùng ba dòng: ý chính là gì, nó gợi nhớ điều gì, và bước tiếp theo là gì. Cách này biến một đoạn đọc thành một hạt giống cho suy nghĩ mới.',
            'Nếu sau một tuần ghi chú vẫn có ý nghĩa, hãy đưa nó vào một trang tổng hợp theo chủ đề. Kiến thức cần những đường nối giữa các cuốn sách.'
        ]),
        ('Nhớ bằng cách kể lại', [
            'Sau mỗi buổi đọc, thử kể lại nội dung như đang giải thích cho một người bạn. Khi phải chọn từ ngữ của mình, bạn sẽ phát hiện chỗ nào còn mơ hồ.',
            'Không cần nhớ mọi chi tiết. Hãy giữ lấy cấu trúc, câu hỏi và một ví dụ sống động. Trí nhớ bền hơn khi điều đã đọc có chỗ đứng trong cuộc sống thường ngày.',
            'Một thói quen nhỏ có thể bắt đầu hôm nay: đọc mười lăm phút, viết ba câu, rồi thử kể lại vào ngày mai.'
        ])
    ])
]

STYLE = '''body{font-family:Georgia,serif;line-height:1.75;color:#352e25;margin:5%;}h1{font-size:1.7em;line-height:1.3;margin:1.5em 0 1em;color:#3e5846;}p{text-align:justify;margin:0 0 1.15em;text-indent:1.3em;}p:first-of-type{text-indent:0;} .chapter-no{font-size:.65em;letter-spacing:.2em;color:#a98654;text-transform:uppercase;}'''

for slug, title, category, chapters in BOOKS:
    path = ROOT / f'{slug}.epub'
    with ZipFile(path, 'w') as z:
        z.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
        z.writestr('META-INF/container.xml', '''<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>''', compress_type=ZIP_DEFLATED)
        z.writestr('OEBPS/style.css', STYLE, compress_type=ZIP_DEFLATED)
        manifest = ['<item id="style" href="style.css" media-type="text/css"/>', '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>']
        spine = []
        nav = []
        for i, (chapter_title, paragraphs) in enumerate(chapters, 1):
            name = f'chapter{i}.xhtml'
            content = ''.join(f'<p>{escape(p)}</p>' for p in paragraphs)
            page = f'''<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi"><head><title>{escape(chapter_title)}</title><link rel="stylesheet" href="style.css" type="text/css"/></head><body><div class="chapter-no">Chương {i:02}</div><h1>{escape(chapter_title)}</h1>{content}</body></html>'''
            z.writestr(f'OEBPS/{name}', page, compress_type=ZIP_DEFLATED)
            manifest.append(f'<item id="chapter{i}" href="{name}" media-type="application/xhtml+xml"/>')
            spine.append(f'<itemref idref="chapter{i}"/>')
            nav.append(f'<li><a href="{name}">{escape(chapter_title)}</a></li>')
        z.writestr('OEBPS/nav.xhtml', f'''<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Mục lục</title></head><body><nav epub:type="toc" id="toc"><h1>Mục lục</h1><ol>{''.join(nav)}</ol></nav></body></html>''', compress_type=ZIP_DEFLATED)
        z.writestr('OEBPS/content.opf', f'''<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="vi"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:thu-cac:{slug}</dc:identifier><dc:title>{escape(title)}</dc:title><dc:creator>Thư Các Studio</dc:creator><dc:language>vi</dc:language><dc:subject>{escape(category)}</dc:subject><meta property="dcterms:modified">2026-11-24T00:00:00Z</meta></metadata><manifest>{''.join(manifest)}</manifest><spine>{''.join(spine)}</spine></package>''', compress_type=ZIP_DEFLATED)
    print(path.name, path.stat().st_size)
