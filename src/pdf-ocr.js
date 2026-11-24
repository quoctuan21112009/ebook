import { cleanPdfText } from './pdf-text.js'

const documents = new WeakMap()
let queue = Promise.resolve()

export function cachedPdfOcr(doc, page) { return documents.get(doc)?.get(page)?.result }

export function recognizePdfPage(doc, pageNumber, image, progress = () => {}) {
  let pages=documents.get(doc)
  if(!pages){pages=new Map();documents.set(doc,pages)}
  if(pages.has(pageNumber))return pages.get(pageNumber).promise
  const entry={}
  const run=async()=>{
    const { createWorker }=await import('tesseract.js')
    const local=file=>new URL(`/ocr/${file}`,window.location.href).href
    let worker
    try{
      worker=await createWorker('vie',1,{
        workerPath:local('worker.min.js'),corePath:local('tesseract-core-lstm.wasm.js'),
        langPath:local(''),gzip:true,logger:message=>progress(message.status==='recognizing text'?Math.round(message.progress*100):0),
        errorHandler:()=>{},
      })
      const {data}=await worker.recognize(image.data||image.url,{}, {text:true,blocks:true})
      const words=[]
      for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(let i=0;i<(line.words||[]).length;i++){
        const word=line.words[i],box=word.bbox
        words.push({text:cleanPdfText(word.text),separator:words.length?(i===0?'\n':' '):'',
          left:box.x0/image.width*100,top:box.y0/image.height*100,
          width:(box.x1-box.x0)/image.width*100,height:(box.y1-box.y0)/image.height*100})
      }
      const text=cleanPdfText(data.text).trim()
      if(!text)throw new Error('Chưa nhận dạng được chữ ở trang này. Hãy thử trang rõ nét hơn.')
      entry.result={text,items:words,confidence:data.confidence}
      return entry.result
    }finally{await worker?.terminate()}
  }
  entry.promise=queue.then(run).catch(error=>{pages.delete(pageNumber);throw error})
  pages.set(pageNumber,entry)
  queue=entry.promise.catch(()=>{})
  return entry.promise
}
