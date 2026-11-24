import { mkdir,copyFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname,join,resolve } from 'node:path'
const require=createRequire(import.meta.url)
const output=resolve('public/ocr')
await mkdir(output,{recursive:true})
const worker=dirname(require.resolve('tesseract.js/package.json'))
const core=dirname(require.resolve('tesseract.js-core/package.json'))
const language=dirname(require.resolve('@tesseract.js-data/vie/package.json'))
await Promise.all([
  copyFile(join(worker,'dist/worker.min.js'),join(output,'worker.min.js')),
  copyFile(join(core,'tesseract-core-lstm.wasm.js'),join(output,'tesseract-core-lstm.wasm.js')),
  copyFile(join(language,'4.0.0_best_int/vie.traineddata.gz'),join(output,'vie.traineddata.gz')),
])
