import React,{useEffect,useRef,useState} from 'react'
import { mountPageFlip } from './managed-page-flip'
import { ArrowLeft,BookOpen,ChevronLeft,ChevronRight,Highlighter,Quote,Settings2,X } from 'lucide-react'
import { ensureFile,ensureReflow } from './storage'
import { pdfToEpub,loadPdf } from './book-utils'
import { normalizeReaderDocument } from './reader-typography'
import { paginateBlocks,blockRange,textWithLineBreaks } from './flipbook-pagination'
import { readApiJson } from './api'
import './flipbook.css'

export default function FlipbookReader({bookInfo,prefs,setPrefs,progress,setProgress,annotations,setAnnotations,onClose,onClassic,onQuote,toast}){
  const stage=useRef(null),host=useRef(null),engine=useRef(null),source=useRef(null),measure=useRef(null),library=useRef(null)
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(true)
  const [chapter,setChapter]=useState(progress?.flipChapter||0),[chapters,setChapters]=useState([]),[pages,setPages]=useState([])
  const [current,setCurrent]=useState(0),[size,setSize]=useState({width:360,height:509}),[settings,setSettings]=useState(false)
  const [selecting,setSelecting]=useState(false),[selection,setSelection]=useState(null),[note,setNote]=useState(null),[noteText,setNoteText]=useState('')
  const [tag,setTag]=useState('Cảm nhận'),[posting,setPosting]=useState(false)
  const initialCfi=useRef(bookInfo.initialCfi||progress?.cfi)
  const anchorRef=useRef(null)
  const resume=useRef(progress?.flipPage||0),progressRef=useRef(setProgress);progressRef.current=setProgress
  const pdf=bookInfo.type==='pdf'
  const palette={paper:['#f5ecd9','#332b24'],white:['#fffdfa','#252522'],sepia:['#dec7a3','#3b2b1e'],night:['#232927','#e7dfce']}[prefs.theme]||['#f5ecd9','#332b24']
  useEffect(()=>{
    const observer=new ResizeObserver(([entry])=>{
      const {width,height}=entry.contentRect
      const double=width>=760
      const w=Math.floor(Math.min(520,(width-32)/(double?2:1),(height-28)/1.414))
      setSize({width:Math.max(160,w),height:Math.round(Math.max(160,w)*1.414),spread:double})
    });observer.observe(stage.current);return()=>observer.disconnect()
  },[])
  useEffect(()=>{
    let cancelled=false
    ;(async()=>{
      try{
        let buffer=await ensureFile(bookInfo.id,bookInfo.sha256)
        if(bookInfo.reflow){try{buffer=await(await pdfToEpub(buffer,bookInfo.title)).arrayBuffer()}catch{buffer=await ensureReflow(bookInfo.id)}}
        if(pdf){const doc=await loadPdf(buffer);if(cancelled){doc.destroy();return}library.current=doc;setChapters(Array.from({length:Math.ceil(doc.numPages/12)},(_,i)=>({label:`Trang ${i*12+1}–${Math.min(doc.numPages,(i+1)*12)}`,index:i})))}
        else{const {default:ePub}=await import('epubjs');const book=ePub(buffer);await book.ready;if(cancelled){book.destroy();return}library.current=book;await book.loaded.navigation;if(progress?.cfi && progress.flipChapter == null){try{const section=book.spine.get(progress.cfi);if(section)setChapter(section.index)}catch{}}setChapters(book.spine.spineItems.map((section,i)=>({label:book.navigation.get(section.href)?.label?.trim()||`Phần ${i+1}`,index:i})))}
        setReady(true)
      }catch(e){if(!cancelled){setError(e.message);setBusy(false)}}
    })()
    return()=>{cancelled=true;library.current?.destroy()}
  },[bookInfo.id])
  useEffect(()=>{
    if(!ready)return
    let cancelled=false
    const pageUrls=[]
    setBusy(true);setSelection(null)
    ;(async()=>{
      try{
        await document.fonts.ready
        let result
        if(pdf){
          result=[]
          for(let n=chapter*12+1;n<=Math.min(library.current.numPages,(chapter+1)*12);n++){
            const page=await library.current.getPage(n);if(cancelled)return
            const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,1200/base.width)})
            const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height
            await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise
            if(cancelled)return
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.92));if(cancelled)return;const url=URL.createObjectURL(blob);pageUrls.push(url)
            result.push([{image:url,pdfPage:n}])
          }
        }else{
          const section=library.current.spine.get(chapter)
          await section.load(library.current.load.bind(library.current));if(cancelled)return
          source.current=section;normalizeReaderDocument(section.document)
          const blocks=[]
          for(const el of (section.document.querySelector('body') || section.document.documentElement).querySelectorAll('h1,h2,h3,h4,p,li,pre,blockquote,img,div,td,th,figcaption')){
            if(el.tagName.toLowerCase()==='div'&&(el.querySelector('p,div,h1,h2,h3,h4,li,blockquote,pre,img')||!el.textContent.trim()))continue
            if(el.matches('td,th,figcaption')&&el.querySelector('p,li,div'))continue
            if(el.tagName.toLowerCase()!=='img'&&el.parentElement?.closest('p,li,pre,blockquote'))continue
            if(el.tagName.toLowerCase()==='img'){
              const src=el.getAttribute('src');if(!src)continue
              try{const path=new URL(src,'https://epub.local/'+section.href).pathname;const url=await library.current.archive.createUrl(path);blocks.push({image:url})}catch{}
            }else blocks.push({...textWithLineBreaks(el),tag:/^h[1-4]$/i.test(el.tagName)?el.tagName.toLowerCase():'p',pre:el.matches('pre,.poem,.poetry,.verse'),element:el})
          }
          if(!blocks.length){const body=section.document.querySelector('body');if(body?.textContent.trim())blocks.push({...textWithLineBreaks(body),tag:'p',element:body})}
          if(initialCfi.current){
            try{
              const range=await library.current.getRange(initialCfi.current)
              const block=blocks.find(b=>b.element?.contains(range.startContainer))
              if(block){const prefix=block.element.ownerDocument.createRange();prefix.selectNodeContents(block.element);prefix.setEnd(range.startContainer,range.startOffset);const at=prefix.toString().length;anchorRef.current={element:block.element,start:block.offsets?.findIndex(value=>value>=at)??at}}
            }catch{}
            initialCfi.current=null
          }
          result=paginateBlocks(blocks,measure.current,size.height-104)
        }
        if(cancelled)return
        if(!result.length)result=[[{text:'Trang này không có văn bản.',tag:'p'}]]
        if(anchorRef.current && !pdf){const anchor=anchorRef.current;const index=result.findIndex(blocks=>blocks.some(block=>block.element===anchor.element&&block.start<=anchor.start&&block.end>anchor.start));if(index>=0)resume.current=index+1}
        setPages(result);setBusy(false)
      }catch(e){if(!cancelled){setError(e.message||'Không dàn được trang sách');setBusy(false)}}
    })()
    return()=>{cancelled=true;pageUrls.forEach(URL.revokeObjectURL)}
  },[ready,chapter,size.width,size.height,prefs.font,prefs.fontSize,prefs.lineHeight,prefs.paragraphGap,prefs.paragraphIndent])
  useEffect(()=>{
    if(busy||!pages.length)return
    const root=document.createElement('div');root.style.width=`${size.width*(size.spread?2:1)}px`;root.style.height=`${size.height}px`;host.current.replaceChildren(root)
    const flipSettings={width:size.width,height:size.height,size:'fixed',showCover:true,usePortrait:true,autoSize:false,drawShadow:true,maxShadowOpacity:.45,flippingTime:window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:850,startPage:Math.min(resume.current,pages.length),useMouseEvents:!selecting,mobileScrollSupport:true,showPageCorners:!selecting,disableFlipByClick:true,swipeDistance:35}
    const elements=[]
    const cover=document.createElement('div');cover.className='flip-leaf flip-cover';cover.dataset.density='hard';const coverInner=document.createElement('div');coverInner.className='flip-cover-inner';cover.appendChild(coverInner)
    if(bookInfo.coverUrl){const image=document.createElement('img');image.src=bookInfo.coverUrl;image.alt=`Bìa ${bookInfo.title}`;coverInner.appendChild(image)}
    else{const imprint=document.createElement('small');imprint.textContent='THƯ CÁC · TỦ SÁCH CỦA BẠN';coverInner.appendChild(imprint);const title=document.createElement('h1');title.textContent=bookInfo.title;coverInner.appendChild(title);const author=document.createElement('p');author.textContent=bookInfo.author||'';coverInner.appendChild(author)}
    const peel=document.createElement('span');peel.className='flip-cover-peel';peel.textContent='↗';cover.appendChild(peel);elements.push(cover)
    pages.forEach((blocks,index)=>{
      const leaf=document.createElement('div');leaf.className='flip-leaf';leaf.dataset.page=String(index)
      const title=document.createElement('div');title.className='flip-running-title';title.textContent=bookInfo.title;leaf.appendChild(title)
      const content=document.createElement('div');content.className='flip-page-content'
      blocks.forEach((block,i)=>{
        if(block.image){const img=document.createElement('img');img.src=block.image;img.alt=block.pdfPage?`Trang PDF ${block.pdfPage}`:'Minh họa trong sách';content.appendChild(img);return}
        const el=document.createElement(block.tag||'p');el.textContent=block.text;el.dataset.block=String(i);if(block.start>0)el.style.textIndent='0';if(block.pre)el.style.whiteSpace='pre-wrap';content.appendChild(el)
      })
      leaf.appendChild(content);const ribbon=document.createElement('span');ribbon.className='flip-ribbon';leaf.appendChild(ribbon);const number=document.createElement('div');number.className='flip-page-number';number.textContent=String(blocks[0]?.pdfPage||index+1);leaf.appendChild(number);elements.push(leaf)
    })
    const back=document.createElement('div');back.className='flip-leaf flip-cover flip-back';back.dataset.density='hard';back.textContent='❧ THƯ CÁC';elements.push(back)
    // Keep an even final spread; the back cover remains a hard single page.
    if(elements.length%2!==0){const blank=document.createElement('div');blank.className='flip-leaf';elements.splice(elements.length-1,0,blank)}
    root.replaceChildren(...elements)
    const managed=mountPageFlip(root,flipSettings,elements)
    const flip=managed.flip;engine.current=flip
    flip.on('flip',event=>{
      const index=event.data;resume.current=index;setCurrent(index);setSelection(null)
      const pageIndex=Math.max(0,Math.min(pages.length-1,index-1));const block=pages[pageIndex]?.find(x=>x.element)
      if(block)anchorRef.current={element:block.element,start:block.start}
      let cfi
      try{if(block)cfi=source.current.cfiFromRange(blockRange(block,block.start,block.end))}catch{}
      progressRef.current({flipChapter:chapter,flipPage:index,...(cfi?{cfi}:{}),...(pdf?{page:pages[pageIndex]?.[0]?.pdfPage}:{}),percent:chapter===chapters.length-1&&index>=pages.length?100:Math.round((chapter+pageIndex/pages.length)/chapters.length*100),updated:Date.now()})
    })
    setCurrent(flip.getCurrentPageIndex())
    return()=>{engine.current=null;managed.destroy()}
  },[pages,busy,selecting])
  function turn(direction){setSelection(null);if(!engine.current)return;const index=engine.current.getCurrentPageIndex();if(direction>0&&index>=pages.length){if(chapter<chapters.length-1){anchorRef.current=null;resume.current=0;setChapter(chapter+1)}return}if(direction<0&&index===0){if(chapter>0){anchorRef.current=null;resume.current=0;setChapter(chapter-1)}return}direction>0?engine.current.flipNext('bottom'):engine.current.flipPrev('bottom')}
  useEffect(()=>{
    const key=event=>{
      if(event.target.closest('input,textarea,select')||note||settings)return
      if(event.key==='ArrowRight')turn(1)
      if(event.key==='ArrowLeft')turn(-1)
    }
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
  },[pages,chapter,note,settings])
  function capture(){
    if(!selecting||pdf)return
    const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.toString().trim())return
    const range=selection.getRangeAt(0),startEl=range.startContainer.parentElement?.closest('[data-block]'),endEl=range.endContainer.parentElement?.closest('[data-block]')
    if(!startEl||!endEl||!host.current.contains(startEl)||!host.current.contains(endEl))return
    const first=pages[Number(startEl.closest('[data-page]').dataset.page)][Number(startEl.dataset.block)]
    const last=pages[Number(endEl.closest('[data-page]').dataset.page)][Number(endEl.dataset.block)]
    const offset=(el,node,index)=>{const r=document.createRange();r.selectNodeContents(el);r.setEnd(node,index);return r.toString().length}
    try{const begin=blockRange(first,first.start+offset(startEl,range.startContainer,range.startOffset),first.end);const end=blockRange(last,last.start,last.start+offset(endEl,range.endContainer,range.endOffset));begin.setEnd(end.endContainer,end.endOffset);setSelection({text:selection.toString().trim(),cfi:source.current.cfiFromRange(begin)})}catch{}
  }
  useEffect(()=>{const listener=()=>capture();document.addEventListener('selectionchange',listener);return()=>document.removeEventListener('selectionchange',listener)},[selecting,pages])
  function saveNote(){setAnnotations([...annotations,{id:crypto.randomUUID(),type:'highlight',cfi:note.cfi,text:note.text,note:noteText,date:Date.now()}]);setNote(null);setNoteText('');toast('Đã lưu đoạn trích vào sổ tay.')}
  async function comment(){setPosting(true);try{const response=await fetch('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookId:bookInfo.id,cfi:note.cfi,quote:note.text,body:noteText,tag})});const data=await readApiJson(response);if(!response.ok)throw new Error(data.error);setNote(null);setNoteText('');toast('Đã đăng bình luận theo đoạn.')}catch(e){toast(e.message)}finally{setPosting(false)}}
  return <div className="flip-reader" data-paper={prefs.theme} style={{'--leaf-paper':palette[0],'--leaf-ink':palette[1],'--leaf-font':prefs.font==='sans'?'"Be Vietnam Pro",sans-serif':'"Noto Serif",serif','--leaf-size':`${prefs.fontSize}px`,'--leaf-leading':prefs.lineHeight,'--leaf-gap':`${prefs.paragraphGap??.55}em`,'--leaf-indent':`${prefs.paragraphIndent??1.2}em`}}><header><button onClick={onClose} aria-label="Về tủ sách"><ArrowLeft size={19}/></button><strong>{bookInfo.title}<small>SÁCH LẬT 3D</small></strong><button onClick={onClassic}><BookOpen size={17}/><span>Đọc chữ / công cụ</span></button>{!pdf&&<button className={selecting?'on':''} onClick={()=>{setSelecting(!selecting);setSelection(null)}} aria-label="Bật chọn chữ"><Highlighter size={17}/><span>{selecting?'Đang chọn chữ':'Chọn chữ'}</span></button>}<button onClick={()=>setSettings(!settings)} aria-label="Tùy chỉnh sách 3D"><Settings2 size={19}/></button></header>
    {settings&&<div className="flip-settings">{!pdf&&<><label>Cỡ chữ <input aria-label="Cỡ chữ sách 3D" type="range" min="14" max="30" value={prefs.fontSize} onChange={e=>setPrefs(p=>({...p,fontSize:+e.target.value}))}/>{prefs.fontSize}px</label><select aria-label="Kiểu chữ sách 3D" value={prefs.font} onChange={e=>setPrefs(p=>({...p,font:e.target.value}))}><option value="serif">Có chân · cổ điển</option><option value="sans">Không chân · hiện đại</option></select></>}<select aria-label="Nền giấy sách 3D" value={prefs.theme} onChange={e=>setPrefs(p=>({...p,theme:e.target.value}))}><option value="paper">Giấy ngà</option><option value="white">Trắng ấm</option><option value="sepia">Nâu cổ</option><option value="night">Đêm</option></select><button onClick={()=>setSettings(false)}><X size={17}/></button></div>}
    <div className="flip-stage" ref={stage}><div className={`flip-book-host ${selecting?'text-selection':''}`} ref={host} style={{width:size.width*(size.spread?2:1),height:size.height,transform:current===0&&size.spread?`translateX(${-size.width/2}px)`:undefined}} onPointerUp={capture}/>{busy&&<div className="flip-status">Đang dàn trang sách…</div>}{error&&<div className="flip-status">{error}<button onClick={onClassic}>Mở trình đọc thường</button></div>}</div>
    <div className="flip-measure flip-page-content" ref={measure} style={{width:size.width-64,height:'auto'}}/>
    <footer><button onClick={()=>turn(-1)} aria-label="Lật trang trước"><ChevronLeft size={20}/></button><select aria-label="Chọn chương sách 3D" value={chapter} onChange={e=>{anchorRef.current=null;resume.current=0;setChapter(+e.target.value)}}>{chapters.map(c=><option key={c.index} value={c.index}>{c.label}</option>)}</select><span>{current===0?'Bìa sách':`Trang ${Math.min(current,pages.length)} / ${pages.length}`}</span><button onClick={()=>turn(1)} aria-label="Lật trang tiếp"><ChevronRight size={20}/></button></footer><p className="flip-hint">{selecting?'Nhấn giữ và kéo tay nắm để chọn chữ, rồi chọn ghi chú hoặc ảnh.':'Kéo góc trang hoặc vuốt để lật · Bấm mũi tên để mở bìa'}</p>
    {selection&&!note&&<div className="flip-selection"><button onPointerDown={e=>e.preventDefault()} onClick={()=>{setNote(selection);setSelection(null)}}>Ghi chú / bình luận</button><button onPointerDown={e=>e.preventDefault()} onClick={()=>onQuote(selection.text)}><Quote size={16}/> Tạo ảnh</button></div>}
    {note&&<div className="flip-note"><button onClick={()=>setNote(null)} aria-label="Đóng ghi chú"><X size={18}/></button><blockquote>{note.text}</blockquote><textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Ghi suy nghĩ về đoạn đã chọn…"/><button onClick={saveNote}>Lưu ghi chú riêng</button>{bookInfo.visibility==='public'&&<><select value={tag} onChange={e=>setTag(e.target.value)}>{['Cảm nhận','Phản biện','Bổ sung kiến thức'].map(t=><option key={t}>{t}</option>)}</select><button disabled={posting||!noteText.trim()} onClick={comment}>Đăng bình luận</button></>}</div>}
  </div>
}
