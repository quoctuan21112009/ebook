import test from 'node:test'
import assert from 'node:assert/strict'
import { continuesProse } from '../src/paragraph-flow.js'

const first = 'Đây chính là con đường chọn lựa những ngôi sao tương lai ở hầu hết các môn thể thao. Cách thức này cũng không nhiều khác biệt lắm so với cách mà nghệ thuật âm https://thuviensach.vn'
const middle = 'nhạc cổ điển lựa chọn những nghệ sĩ bậc thầy trong tương lai, nghệ thuật vũ'
const end = 'ba lê tuyển chọn những nghệ sĩ múa tương lai, hay các hệ thống giáo dục tinh hoa lựa chọn ra các nhà khoa học và trí thức kế tiếp của mình.'

test('reconnects the broken Vietnamese prose shown in the reader screenshot', () => {
  assert.equal(continuesProse(first, middle), true)
  assert.equal(continuesProse(middle, end, true), true)
  assert.equal(continuesProse(end, 'Bạn không thể nào mua tấm vé tham dự giải khúc côn cầu Major Junior A.'), false)
})
test('keeps sentence endings, dialogue, lists and short verse boundaries', () => {
  assert.equal(continuesProse('Đoạn trước đã hoàn tất. '.repeat(5), 'một đoạn khác bắt đầu.'), false)
  assert.equal(continuesProse(first, '— Một lời thoại mới'), false)
  assert.equal(continuesProse(first, '2. Một mục mới'), false)
  assert.equal(continuesProse('mùa thu lá bay', 'trong chiều gió nhẹ'), false)
  assert.equal(continuesProse(first, 'Một tiêu đề riêng'), false)
})
