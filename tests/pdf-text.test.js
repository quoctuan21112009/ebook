import test from 'node:test'
import assert from 'node:assert/strict'
import { extractPdfParagraphs } from '../src/book-utils.js'

function item(str, x, y, width, hasEOL = false) {
  return { str, transform: [20, 0, 0, 20, x, y], width, height: 20, hasEOL }
}

test('joins fragments inside Vietnamese words without adding spaces', () => {
  const paragraphs = extractPdfParagraphs([
    item('Thanh', 0, 100, 52), item(' tẩy', 52, 100, 41), item('tiế', 101, 100, 30),
    item('n', 131, 100, 10), item('hành', 148, 100, 42, true),
    item('vào', 0, 76, 32), item('buổi sáng.', 39, 76, 90, true),
  ])
  assert.deepEqual(paragraphs, ['Thanh tẩy tiến hành vào buổi sáng.'])
})

test('keeps a new paragraph after a blank line and normalizes accents', () => {
  const paragraphs = extractPdfParagraphs([
    item('Một', 0, 100, 40, true),
    item('đoạn đầu.', 0, 76, 85, true),
    item('Đoạn mới.', 30, 38, 90, true),
  ])
  assert.deepEqual(paragraphs, ['Một đoạn đầu.', 'Đoạn mới.'])
})
