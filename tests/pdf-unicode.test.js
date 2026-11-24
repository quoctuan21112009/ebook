import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanPdfText, pdfItemSeparator, needsPdfOcr } from '../src/pdf-text.js'
const item=(str,x,width,y=100)=>({str,width,height:20,transform:[20,0,0,20,x,y]})
test('PDF selection does not insert a space after every glyph',()=>{
  const items=[item('nh',0,20),item('ữ',20,10),item('ng',30,20),item('trang',57,45)]
  assert.equal(items.map((glyph,i)=>pdfItemSeparator(items[i-1],glyph)+glyph.str).join(''),'những trang')
})
test('normalizes detached combining accents and removes invisible PDF artifacts',()=>{
  assert.equal(cleanPdfText('Tie\u0302 \u0301ng Vie\u0323\u0302t\u00ad\u200b'),'Tiếng Việt')
})
test('uses OCR for broken font maps instead of inventing Vietnamese replacements',()=>{
  assert.equal(needsPdfOcr('h î n so v ę i nh ĕ ng'),true)
  assert.equal(needsPdfOcr('Hơn so với những trang sách cũ.'),false)
  assert.equal(needsPdfOcr('Noël est arrivé.'),false)
  assert.equal(cleanPdfText('î ę ĕ'),'î ę ĕ')
  assert.equal(needsPdfOcr(''),true)
  assert.equal(needsPdfOcr('Chữ \ufffd sai mã'),true)
})
