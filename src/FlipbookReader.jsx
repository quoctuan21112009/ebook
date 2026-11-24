import React,{useEffect,useRef,useState} from 'react'
import { mountPageFlip } from './managed-page-flip'
import { ArrowLeft,BookOpen,Bookmark,ChevronLeft,ChevronRight,Highlighter,Quote,Settings2,X,StickyNote,MessageCircle,Sparkles,Search,Clock3,Download } from 'lucide-react'
import { ensureFile,getFile } from './storage'
import { pdfToEpub,loadPdf,extractEpubCover,extractPdfParagraphs } from './book-utils'
import { markParagraphFlow } from './paragraph-flow'
import { normalizeReaderDocument } from './reader-typography'
import { paginateBlocks,blockRange,textWithLineBreaks } from './flipbook-pagination'
import { readApiJson } from './api'
import ReaderAssistant from './ReaderAssistant'
import ReaderTools from './ReaderTools'
import { renderPdfLeaf,addPdfTextLayer } from './pdf-leaf'
import './flipbook.css'

export default function FlipbookReader({bookInfo,prefs,setPrefs,progress,setProgress,annotations,setAnnotations,onClose,onQuote,toast}){
  const stage=useRef(null),host=useRef(null),engine=useRef(null),source=useRef(null),measure=useRef(null),library=useRef(null)
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(true)
  const requestedPdfPage=bookInfo.type==='pdf'?(Number((bookInfo.initialCfi||'').replace(/^pdf:/,''))||progress?.page||1):null
  const [chapter,setChapter]=useState(requestedPdfPage?Math.floor((requestedPdfPage-1)/12):progress?.flipChapter||0),[chapters,setChapters]=useState([]),[pages,setPages]=useState([])
  const [current,setCurrent]=useState(0),[size,setSize]=useState({width:360,height:509}),[settings,setSettings]=useState(false)
  const [selecting,setSelecting]=useState(false),[selection,setSelection]=useState(null),[note,setNote]=useState(null),[noteText,setNoteText]=useState('')
  const [tag,setTag]=useState('Cảm nhận'),[posting,setPosting]=useState(false)
  const [cover,setCover]=useState(''),[panel,setPanel]=useState(''),[comments,setComments]=useState([]),[assistantOpen,setAssistantOpen]=useState(!!bookInfo.openAssistant)
  const readingSeconds=useRef(progress?.readingSeconds||0),bufferRef=useRef(null),coverLeaf=useRef(null),conversionBusy=useRef(false)
  const initialCfi=useRef(bookInfo.initialCfi||progress?.cfi)
  const anchorRef=useRef(null)
  const resume=useRef(requestedPdfPage?(requestedPdfPage<=12?requestedPdfPage-1:(requestedPdfPage-1)%12):progress?.flipPage||0),progressRef=useRef(setProgress);progressRef.current=setProgress
  const pdf=bookInfo.type==='pdf'
  const palette={paper:['#f5ecd9','#332b24'],white:['#fffdfa','#252522'],sepia:['#dec7a3','#3b2b1e'],night:['#232927','#e7dfce']}[prefs.theme]||['#f5ecd9','#332b24']
  useEffect(()=>{
    const observer=new ResizeObserver(([entry])=>{
      const {width,height}=entry.contentRect
      const double=width>=760
      const w=Math.floor(Math.min(760,(width-8)/(double?2:1),(height-8)/1.414))
      setSize({width:Math.max(160,w),height:Math.round(Math.max(160,w)*1.414),spread:double})
    });observer.observe(stage.current);return()=>observer.disconnect()
  },[])
  useEffect(()=>{
    let cancelled=false
    const coverUrls=[]
    ;(async()=>{
      try{
        let buffer=await ensureFile(bookInfo.id,bookInfo.sha256)
        bufferRef.current=buffer
        if(pdf){const doc=await loadPdf(buffer);if(cancelled){doc.destroy();return}library.current=doc;const first=await renderPdfLeaf(doc,1,1600);if(cancelled)return;const url=URL.createObjectURL(first.blob);coverUrls.push(url);coverLeaf.current={...first,image:url,pdfPage:1};setCover(url);setChapters(Array.from({length:Math.ceil(doc.numPages/12)},(_,i)=>({label:`Trang ${i*12+1}–${Math.min(doc.numPages,(i+1)*12)}`,index:i})))}
        else{const image=await getFile(`${bookInfo.id}:cover`)||await extractEpubCover(buffer).catch(()=>null);if(image){const url=URL.createObjectURL(image);coverUrls.push(url);if(!cancelled)setCover(url)}else if(bookInfo.coverUrl)setCover(bookInfo.coverUrl);const {default:ePub}=await import('epubjs');const book=ePub(buffer);await book.ready;if(cancelled){book.destroy();return}library.current=book;await book.loaded.navigation;if(bookInfo.initialCfi||(progress?.cfi && progress.flipChapter == null)){try{const section=book.spine.get(bookInfo.initialCfi||progress.cfi);if(section)setChapter(section.index)}catch{}}setChapters(book.spine.spineItems.map((section,i)=>({label:book.navigation.get(section.href)?.label?.trim()||`Phần ${i+1}`,index:i})))}
        setReady(true)
      }catch(e){if(!cancelled){setError(e.message);setBusy(false)}}
    })()
    return()=>{cancelled=true;library.current?.destroy();coverUrls.forEach(URL.revokeObjectURL)}
  },[bookInfo.id])
  useEffect(()=>{
    if(!ready)return
    let cancelled=false
    const pageUrls=[]
    setBusy(true);setSelection(null)
    ;(async()=>{
      try{
        const family=prefs.font==='sans'?'Be Vietnam Pro':'Noto Serif'
        await Promise.all([400,700].map(weight=>document.fonts.load(`${weight} ${prefs.fontSize}px "${family}"`,'Tiếng Việt rõ ràng ABC')))
        await document.fonts.ready
        let result
        if(pdf){
          result=[]
          for(let n=Math.max(2,chapter*12+1);n<=Math.min(library.current.numPages,(chapter+1)*12);n++){
            const leaf=await renderPdfLeaf(library.current,n)
            if(cancelled)return
            const url=URL.createObjectURL(leaf.blob);pageUrls.push(url)
            result.push([{...leaf,image:url,pdfPage:n}])
          }
        }else{
          const section=library.current.spine.get(chapter)
          await section.load(library.current.load.bind(library.current));if(cancelled)return
          source.current=section;normalizeReaderDocument(section.document);markParagraphFlow(section.document,prefs.repairFlow!==false)
          const blocks=[]
          for(const el of (section.document.querySelector('body') || section.document.documentElement).querySelectorAll('h1,h2,h3,h4,p,li,pre,blockquote,img,div,td,th,figcaption')){
            if(el.tagName.toLowerCase()==='div'&&(el.querySelector('p,div,h1,h2,h3,h4,li,blockquote,pre,img')||!el.textContent.trim()))continue
            if(el.matches('td,th,figcaption')&&el.querySelector('p,li,div'))continue
            if(el.tagName.toLowerCase()!=='img'&&el.parentElement?.closest('p,li,pre,blockquote'))continue
            if(el.tagName.toLowerCase()==='img'){
              const src=el.getAttribute('src');if(!src)continue
              try{const path=new URL(src,'https://epub.local/'+section.href).pathname;const url=await library.current.archive.createUrl(path);blocks.push({image:url})}catch{}
            }else blocks.push({...textWithLineBreaks(el),tag:/^h[1-4]$/i.test(el.tagName)?el.tagName.toLowerCase():'p',pre:el.matches('pre,.poem,.poetry,.verse'),joinPrevious:el.hasAttribute('data-reader-join'),element:el})
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
          result=chapter===0&&cover&&blocks.length===1&&blocks[0].image?[]:paginateBlocks(blocks,measure.current,size.height-88)
        }
        if(cancelled)return
        if(!result.length&&!pdf&&!(chapter===0&&cover))result=[[{text:'Trang này không có văn bản.',tag:'p'}]]
        if(anchorRef.current && !pdf){const anchor=anchorRef.current;const index=result.findIndex(blocks=>blocks.some(block=>block.element===anchor.element&&block.start<=anchor.start&&block.end>anchor.start));if(index>=0)resume.current=index+1}
        setPages(result);setBusy(false)
      }catch(e){if(!cancelled){setError(e.message||'Không dàn được trang sách');setBusy(false)}}
    })()
    return()=>{cancelled=true;pageUrls.forEach(URL.revokeObjectURL)}
  },[ready,chapter,size.width,size.height,prefs.font,prefs.fontSize,prefs.lineHeight,prefs.paragraphGap,prefs.paragraphIndent,prefs.repairFlow])
  useEffect(()=>{
    if(busy||!ready)return
    const root=document.createElement('div');root.style.width=`${size.width*(size.spread?2:1)}px`;root.style.height=`${size.height}px`;host.current.replaceChildren(root)
    const flipSettings={width:size.width,height:size.height,size:'fixed',showCover:chapter===0,usePortrait:true,autoSize:false,drawShadow:true,maxShadowOpacity:.45,flippingTime:window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:850,startPage:Math.min(resume.current,pages.length),useMouseEvents:!selecting,mobileScrollSupport:true,showPageCorners:!selecting,disableFlipByClick:true,swipeDistance:35}
    const elements=[]
    const offset=chapter===0?1:0
    if(chapter===0){
      const first=document.createElement('div');first.className='flip-leaf book-first-page';first.dataset.density='soft'
      if(cover){const image=document.createElement('img');image.src=cover;image.alt=`Bìa ${bookInfo.title}`;first.appendChild(image)}
      else {const title=document.createElement('h1');title.textContent=bookInfo.title;first.appendChild(title);const author=document.createElement('p');author.textContent=bookInfo.author||'';first.appendChild(author)}
      if(pdf&&coverLeaf.current){const wrap=document.createElement('div');wrap.className='pdf-page-art';wrap.style.aspectRatio=`${coverLeaf.current.width}/${coverLeaf.current.height}`;const scale=Math.min(size.width/coverLeaf.current.width,size.height/coverLeaf.current.height);wrap.style.width=`${coverLeaf.current.width*scale}px`;wrap.style.height=`${coverLeaf.current.height*scale}px`;first.replaceChildren(wrap);const image=document.createElement('img');image.src=cover;image.alt=`Bìa ${bookInfo.title}`;wrap.appendChild(image);addPdfTextLayer(wrap,coverLeaf.current,annotations)}
      elements.push(first)
    }
    pages.forEach((blocks,index)=>{
      const leaf=document.createElement('div');leaf.className=pdf?'flip-leaf pdf-leaf':'flip-leaf';leaf.dataset.page=String(index)
      const title=document.createElement('div');title.className='flip-running-title';title.textContent=bookInfo.title;if(!pdf)leaf.appendChild(title)
      const content=document.createElement('div');content.className='flip-page-content'
      blocks.forEach((block,i)=>{
        if(block.image){const wrap=document.createElement('div');wrap.className=block.pdfPage?'pdf-page-art':'book-illustration';if(block.width){wrap.style.aspectRatio=`${block.width}/${block.height}`;const scale=Math.min(size.width/block.width,size.height/block.height);wrap.style.width=`${block.width*scale}px`;wrap.style.height=`${block.height*scale}px`}const img=document.createElement('img');img.src=block.image;img.alt=block.pdfPage?`Trang PDF ${block.pdfPage}`:'Minh họa trong sách';wrap.appendChild(img);if(block.pdfPage)addPdfTextLayer(wrap,block,annotations);content.appendChild(wrap);return}
        const last=content.lastElementChild
        const joined=block.joinPrevious&&last?.tagName==='P'
        const el=document.createElement(joined?'span':block.tag||'p');el.dataset.block=String(i)
        const highlights=annotations.filter(a=>a.type==='highlight'&&a.text&&(a.chapter===chapter||a.cfi?.startsWith(`epubcfi(${source.current?.cfiBase}!`))).map(a=>({start:block.text.indexOf(a.text),length:a.text.length})).filter(a=>a.start>=0).sort((a,b)=>a.start-b.start)
        let position=0
        for(const hit of highlights){if(hit.start<position)continue;el.appendChild(document.createTextNode(block.text.slice(position,hit.start)));const mark=document.createElement('mark');mark.textContent=block.text.slice(hit.start,hit.start+hit.length);el.appendChild(mark);position=hit.start+hit.length}
        el.appendChild(document.createTextNode(block.text.slice(position)))
        if(block.start>0||block.joinPrevious)el.style.textIndent='0'
        if(block.pre)el.style.whiteSpace='pre-wrap'
        if(joined){last.appendChild(document.createTextNode(' '));last.appendChild(el)}else content.appendChild(el)
      })
      leaf.appendChild(content);const ribbon=document.createElement('span');ribbon.className='flip-ribbon';if(!pdf)leaf.appendChild(ribbon);const number=document.createElement('div');number.className='flip-page-number';number.textContent=String(blocks[0]?.pdfPage||index+1);if(!pdf)leaf.appendChild(number);elements.push(leaf)
    })
    if(chapter===chapters.length-1){const back=document.createElement('div');back.className='flip-leaf book-last-page';back.dataset.density='soft';elements.push(back)}
    if(elements.length<2||elements.length%2!==0){const blank=document.createElement('div');blank.className='flip-leaf';elements.push(blank)}
    root.replaceChildren(...elements)
    const managed=mountPageFlip(root,flipSettings,elements)
    const flip=managed.flip;engine.current=flip
    for(let i=0;i<elements.length;i++){flip.getPage(i).setDensity('soft');flip.getPage(i).setDrawingDensity('soft')}
    flip.on('flip',event=>{
      const index=event.data;resume.current=index;setCurrent(index);setSelection(null)
      const pageIndex=Math.max(0,Math.min(pages.length-1,index-offset));const block=pages[pageIndex]?.find(x=>x.element)
      if(block)anchorRef.current={element:block.element,start:block.start}
      let cfi
      try{if(block)cfi=source.current.cfiFromRange(blockRange(block,block.start,block.end))}catch{}
      progressRef.current({flipChapter:chapter,flipPage:index,...(cfi?{cfi}:{}),...(pdf?{page:pages[pageIndex]?.[0]?.pdfPage}:{}),percent:chapter===chapters.length-1&&index>=pages.length?100:Math.round((chapter+pageIndex/pages.length)/chapters.length*100),updated:Date.now()})
    })
    setCurrent(flip.getCurrentPageIndex())
    return()=>{engine.current=null;managed.destroy()}
  },[pages,busy,selecting,cover,annotations])
  function turn(direction){setSelection(null);if(!engine.current)return;const index=engine.current.getCurrentPageIndex();if(direction>0&&index>=pages.length-(chapter===0?0:1)){if(chapter<chapters.length-1){anchorRef.current=null;resume.current=0;setChapter(chapter+1)}return}if(direction<0&&index===0){if(chapter>0){anchorRef.current=null;resume.current=0;setChapter(chapter-1)}return}direction>0?engine.current.flipNext('bottom'):engine.current.flipPrev('bottom')}
  useEffect(()=>{
    const key=event=>{
      if(event.target.closest('input,textarea,select')||note||settings)return
      if(event.key==='ArrowRight')turn(1)
      if(event.key==='ArrowLeft')turn(-1)
    }
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
  },[pages,chapter,note,settings])
  function capture(){
    if(!selecting)return
    const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.toString().trim())return
    const range=selection.getRangeAt(0)
    if(pdf){const page=range.startContainer.parentElement?.closest('[data-pdf-page]');if(page&&host.current.contains(page))setSelection({text:selection.toString().trim(),pdfPage:+page.dataset.pdfPage,cfi:`pdf:${page.dataset.pdfPage}`,chapter});return}
    const startEl=range.startContainer.parentElement?.closest('[data-block]'),endEl=range.endContainer.parentElement?.closest('[data-block]')
    if(!startEl||!endEl||!host.current.contains(startEl)||!host.current.contains(endEl))return
    const first=pages[Number(startEl.closest('[data-page]').dataset.page)][Number(startEl.dataset.block)]
    const last=pages[Number(endEl.closest('[data-page]').dataset.page)][Number(endEl.dataset.block)]
    const offset=(el,node,index)=>{const r=document.createRange();r.selectNodeContents(el);r.setEnd(node,index);return r.toString().length}
    try{const begin=blockRange(first,first.start+offset(startEl,range.startContainer,range.startOffset),first.end);const end=blockRange(last,last.start,last.start+offset(endEl,range.endContainer,range.endOffset));begin.setEnd(end.endContainer,end.endOffset);setSelection({text:selection.toString().trim(),cfi:source.current.cfiFromRange(begin)})}catch{}
  }
  useEffect(()=>{const listener=()=>capture();document.addEventListener('selectionchange',listener);return()=>document.removeEventListener('selectionchange',listener)},[selecting,pages])
  function saveNote(){setAnnotations([...annotations,{id:crypto.randomUUID(),type:'highlight',cfi:note.cfi,text:note.text,note:noteText,pdfPage:note.pdfPage,chapter,date:Date.now()}]);setNote(null);setNoteText('');toast('Đã lưu đoạn trích vào sổ tay.')}
  async function comment(){setPosting(true);try{const response=await fetch('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookId:bookInfo.id,cfi:note.cfi,quote:note.text,body:noteText,tag})});const data=await readApiJson(response);if(!response.ok)throw new Error(data.error);setNote(null);setNoteText('');loadComments();setPanel('comments');toast('Đã đăng bình luận theo đoạn.')}catch(e){toast(e.message)}finally{setPosting(false)}}
  useEffect(()=>{
    const timer=setInterval(()=>{if(!document.hidden){readingSeconds.current+=30;progressRef.current({readingSeconds:readingSeconds.current})}},30000)
    return()=>clearInterval(timer)
  },[])
  async function loadComments(){
    if(bookInfo.visibility!=='public')return
    try{const response=await fetch(`/api/comments?bookId=${bookInfo.id}`);if(response.ok){const data=await readApiJson(response);setComments(data.comments||[])}}catch{}
  }
  useEffect(()=>{loadComments()},[bookInfo.id])
  async function vote(comment,value){
    try{const response=await fetch(`/api/comments/${comment.id}/vote`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:comment.myVote===value?0:value})});const data=await readApiJson(response);if(!response.ok)throw new Error(data.error);loadComments()}catch(e){toast(e.message)}
  }
  const visibleIndex=()=>Math.max(0,Math.min(pages.length-1,current-(chapter===0?1:0)))
  function currentAnchor(){
    const blocks=pages[visibleIndex()]||[]
    const block=blocks.find(b=>b.element)
    const pdfPage=chapter===0&&current===0?1:blocks[0]?.pdfPage
    let cfi
    try{if(block)cfi=source.current.cfiFromRange(blockRange(block,block.start,block.end))}catch{}
    return {chapter,flipPage:current,cfi:pdf?`pdf:${pdfPage||1}`:cfi,pdfPage,text:chapters[chapter]?.label||'Trang đang đọc'}
  }
  function addBookmark(){setAnnotations([...annotations,{...currentAnchor(),id:crypto.randomUUID(),type:'bookmark',date:Date.now()}]);toast('Đã đánh dấu trang')}
  async function jumpTo(target){
    try{
      const pdfPage=target.pdfPage||(/^pdf:/u.test(target.cfi||'')?Number(target.cfi.slice(4)):null)
      if(pdfPage){const group=Math.floor((pdfPage-1)/12);if(group!==chapter){resume.current=group===0?pdfPage-1:(pdfPage-1)%12;anchorRef.current=null;setChapter(group)}else{const index=pages.findIndex(blocks=>blocks[0]?.pdfPage===pdfPage);engine.current?.turnToPage(pdfPage===1?0:index+(chapter===0?1:0))}}
      else if(target.cfi){
        const section=library.current.spine.get(target.cfi)
        if(section.index!==chapter){initialCfi.current=target.cfi;anchorRef.current=null;resume.current=0;setChapter(section.index)}
        else{const range=await library.current.getRange(target.cfi);const index=pages.findIndex(blocks=>blocks.some(b=>{if(!b.element?.contains(range.startContainer))return false;const prefix=b.element.ownerDocument.createRange();prefix.selectNodeContents(b.element);prefix.setEnd(range.startContainer,range.startOffset);const at=prefix.toString().length;return (b.offsets?.[b.start]??b.start)<=at&&(b.offsets?.[b.end]??b.end)>=at}));if(index>=0)engine.current?.turnToPage(index+(chapter===0?1:0))}
      }else if(target.chapter!=null){resume.current=target.flipPage||0;setChapter(target.chapter);engine.current?.turnToPage(resume.current)}
      setPanel('')
    }catch{toast('Không tìm lại được vị trí này trong tệp sách.')}
  }
  async function quotePage(){
    try{
      let text
      if(pdf){const page=await library.current.getPage(currentAnchor().pdfPage||1);text=extractPdfParagraphs((await page.getTextContent()).items).join('\n')}
      else text=(pages[visibleIndex()]||[]).filter(b=>b.text).map(b=>b.text).join(' ')
      if(!text?.trim()){toast('Trang này chưa có chữ để tạo ảnh. Hãy chọn một đoạn ở trang nội dung.');return}
      onQuote(text)
    }catch(e){toast(e.message)}
  }
  async function searchBook(query){
    const needle=query.toLocaleLowerCase('vi'),results=[]
    try{
      if(pdf){for(let n=1;n<=library.current.numPages&&results.length<50;n++){const page=await library.current.getPage(n);const text=extractPdfParagraphs((await page.getTextContent()).items).join(' ');const at=text.toLocaleLowerCase('vi').indexOf(needle);if(at>=0)results.push({pdfPage:n,label:`Trang ${n}`,text:text.slice(Math.max(0,at-60),at+query.length+100)})}}
      else{for(const section of library.current.spine.spineItems){if(results.length>=50)break;await section.load(library.current.load.bind(library.current));const matches=section.find(query);for(const match of matches)results.push({cfi:match.cfi,label:chapters[section.index]?.label||`Phần ${section.index+1}`,text:match.excerpt})}}
    }catch(e){toast(e.message)}
    return results.slice(0,50)
  }
  async function exportEpub(){
    if(conversionBusy.current)return;conversionBusy.current=true;toast('Đang tạo tệp EPUB…')
    try{const blob=await pdfToEpub(bufferRef.current,bookInfo.title);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${bookInfo.title}.epub`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}catch(e){toast(e.message)}finally{conversionBusy.current=false}
  }
  return <div className={`flip-reader ${assistantOpen?'book-ai-open':''}`} data-paper={prefs.theme} style={{'--leaf-paper':palette[0],'--leaf-ink':palette[1],'--leaf-font':prefs.font==='sans'?'"Be Vietnam Pro",sans-serif':'"Noto Serif",serif','--leaf-size':`${prefs.fontSize}px`,'--leaf-leading':prefs.lineHeight,'--leaf-gap':`${prefs.paragraphGap??.55}em`,'--leaf-indent':`${prefs.paragraphIndent??1.2}em`}}><header><button onClick={onClose} aria-label="Về tủ sách"><ArrowLeft size={19}/></button><strong>{bookInfo.title}<small>{bookInfo.author||'THƯ CÁC'}</small></strong><nav className="book-toolbar" aria-label="Công cụ đọc"><button className={selecting?'on':''} onClick={()=>{setSelecting(!selecting);setSelection(null)}} aria-label="Chọn chữ" title="Chọn chữ"><Highlighter size={18}/></button><button onClick={addBookmark} aria-label="Đánh dấu trang" title="Đánh dấu trang"><Bookmark size={18}/></button><button onClick={()=>setPanel(panel==='notes'?'':'notes')} aria-label="Sổ tay" title="Sổ tay"><StickyNote size={18}/></button><button onClick={()=>setPanel(panel==='comments'?'':'comments')} aria-label="Bình luận" title="Bình luận"><MessageCircle size={18}/></button><button onClick={()=>{setAssistantOpen(!assistantOpen);setPanel('')}} aria-label="Đọc cùng AI" title="Đọc cùng AI"><Sparkles size={18}/></button><button onClick={quotePage} aria-label="Tạo ảnh trang sách" title="Tạo và đăng ảnh"><Quote size={18}/></button><button onClick={()=>setPanel(panel==='search'?'':'search')} aria-label="Tìm trong sách" title="Tìm trong sách"><Search size={18}/></button><button onClick={()=>setPanel(panel==='timer'?'':'timer')} aria-label="Đồng hồ đọc" title="Đồng hồ đọc"><Clock3 size={18}/></button><button onClick={()=>setSettings(!settings)} aria-label="Tùy chỉnh sách" title="Tùy chỉnh sách"><Settings2 size={18}/></button></nav></header>
    {settings&&<div className="flip-settings">{pdf&&<button onClick={exportEpub}><Download size={16}/> Tải bản EPUB</button>}{!pdf&&<><label className="flow-checkbox"><input type="checkbox" checked={prefs.repairFlow!==false} onChange={e=>setPrefs(p=>({...p,repairFlow:e.target.checked}))}/>Nối đoạn bị ngắt sai</label><label>Cỡ chữ <input aria-label="Cỡ chữ sách" type="range" min="14" max="30" value={prefs.fontSize} onChange={e=>setPrefs(p=>({...p,fontSize:+e.target.value}))}/>{prefs.fontSize}px</label><select aria-label="Kiểu chữ sách" value={prefs.font} onChange={e=>setPrefs(p=>({...p,font:e.target.value}))}><option value="serif">Có chân · cổ điển</option><option value="sans">Không chân · hiện đại</option></select></>}{!pdf&&<><label>Thụt đầu đoạn <input aria-label="Thụt đầu đoạn" type="range" min="0" max="2" step="0.1" value={prefs.paragraphIndent??1.2} onChange={e=>setPrefs(p=>({...p,paragraphIndent:+e.target.value}))}/></label><label>Cách đoạn <input aria-label="Khoảng cách đoạn" type="range" min="0" max="1.5" step="0.1" value={prefs.paragraphGap??.55} onChange={e=>setPrefs(p=>({...p,paragraphGap:+e.target.value}))}/></label><label>Giãn dòng <input aria-label="Giãn dòng" type="range" min="1.3" max="2.2" step="0.1" value={prefs.lineHeight} onChange={e=>setPrefs(p=>({...p,lineHeight:+e.target.value}))}/></label></>}<select aria-label="Nền giấy sách" value={prefs.theme} onChange={e=>setPrefs(p=>({...p,theme:e.target.value}))}><option value="paper">Giấy ngà</option><option value="white">Trắng ấm</option><option value="sepia">Nâu cổ</option><option value="night">Đêm</option></select><button onClick={()=>setSettings(false)}><X size={17}/></button></div>}
    <div className="flip-stage" ref={stage}><div className={`flip-book-host ${selecting?'text-selection':''}`} ref={host} style={{width:size.width*(size.spread?2:1),height:size.height,transform:chapter===0&&current===0&&size.spread?`translateX(${-size.width/2}px)`:undefined}} onPointerUp={capture}/>{busy&&<div className="flip-status">Đang dàn trang sách…</div>}{error&&<div className="flip-status">{error}<button onClick={onClose}>Về tủ sách</button></div>}</div>
    <div className="flip-measure flip-page-content" ref={measure} style={{width:size.width-48,height:'auto'}}/>
    <footer><button onClick={()=>turn(-1)} aria-label="Lật trang trước"><ChevronLeft size={20}/></button><select aria-label="Chọn chương sách" value={chapter} onChange={e=>{anchorRef.current=null;resume.current=0;setChapter(+e.target.value)}}>{chapters.map(c=><option key={c.index} value={c.index}>{c.label}</option>)}</select><span>{chapter===0&&current===0?'Bìa sách':pdf?`Trang ${pages[Math.max(0,current-(chapter===0?1:0))]?.[0]?.pdfPage||1} / ${library.current?.numPages||'…'}`:`Trang ${Math.min(current+(chapter===0?0:1),pages.length)} / ${pages.length}`}</span><button onClick={()=>turn(1)} aria-label="Lật trang tiếp"><ChevronRight size={20}/></button></footer><p className="flip-hint">{selecting?'Nhấn giữ và kéo tay nắm để chọn chữ, rồi chọn ghi chú hoặc ảnh.':'Kéo góc trang hoặc vuốt để lật · Bấm mũi tên để mở bìa'}</p>
    {assistantOpen&&<ReaderAssistant book={bookInfo} excerpt={selection?.text||note?.text||''} chapter={chapters[chapter]?.label||''} onClose={()=>setAssistantOpen(false)}/>}
    <ReaderTools panel={panel} onClose={()=>setPanel('')} annotations={annotations} onDelete={a=>setAnnotations(annotations.filter(item=>item.id!==a.id))} onJump={jumpTo} onQuote={onQuote} comments={comments} onVote={vote} publicBook={bookInfo.visibility==='public'} onSearch={searchBook}/>
    {selection&&!note&&<div className="flip-selection"><button onPointerDown={e=>e.preventDefault()} onClick={()=>{setNote(selection);setSelection(null)}}>Ghi chú / bình luận</button><button onPointerDown={e=>e.preventDefault()} onClick={()=>onQuote(selection.text)}><Quote size={16}/> Tạo ảnh</button></div>}
    {note&&<div className="flip-note"><button onClick={()=>setNote(null)} aria-label="Đóng ghi chú"><X size={18}/></button><blockquote>{note.text}</blockquote><textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Ghi suy nghĩ về đoạn đã chọn…"/><button onClick={saveNote}>Lưu ghi chú riêng</button><button onClick={()=>{onQuote(note.text);setNote(null)}}>Tạo ảnh từ đoạn này</button><button onClick={()=>{setSelection(note);setNote(null);setAssistantOpen(true)}}>Bàn luận với AI</button>{bookInfo.visibility==='public'&&<><select value={tag} onChange={e=>setTag(e.target.value)}>{['Cảm nhận','Phản biện','Bổ sung kiến thức'].map(t=><option key={t}>{t}</option>)}</select><button disabled={posting||!noteText.trim()} onClick={comment}>Đăng bình luận</button></>}</div>}
  </div>
}
