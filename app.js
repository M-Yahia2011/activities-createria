const els={search:document.querySelector('#search-activity'),select:document.querySelector('#activity-select'),count:document.querySelector('#activity-count'),summary:document.querySelector('#activity-summary'),preview:document.querySelector('#preview-content'),subtitle:document.querySelector('#preview-subtitle'),phone:document.querySelector('#phone'),status:document.querySelector('#status'),statusLink:document.querySelector('#status-link'),prepare:document.querySelector('#prepare-send'),download:document.querySelector('#download-pdf'),share:document.querySelector('#share-pdf'),toggle:document.querySelector('#toggle-preview')};
const sectionNames={general:'الاشتراطات العامة المناسبة للنشاط',specific:'الاشتراطات الخاصة بالنشاط',operations:'الممارسات والإجراءات التشغيلية المناسبة للنشاط'};
let data=null,selected=null,lastPdf=null,pdfCacheDb=null;
const pdfCacheName='aldaayen-food-checklists',pdfCacheVersion=1,pdfCacheLimit=4;

function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function latinDigits(s){return s.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));}
function cleanPhone(){return latinDigits(els.phone.value).replace(/\D/g,'');}
function setStatus(message,error=false,link=null){els.status.textContent=message;els.status.classList.toggle('error',error);els.statusLink.hidden=!link;if(link)els.statusLink.href=link;}
function sectionMarkup(blocks){return blocks.map(b=>b.kind==='heading'?`<h4>${escapeHtml(b.text)}</h4>`:`<p class="doc-paragraph">${escapeHtml(b.text)}</p>`).join('');}
function enabledSections(){return [...document.querySelectorAll('.checks input:checked')].map(x=>x.value);}
function requirementLength(blocks){return blocks.length?`${blocks.length.toLocaleString('ar')} بند/فقرة`: 'لا توجد بنود لهذا القسم';}
function renderPreview(){
 if(!selected)return;
 lastPdf=null;els.share.textContent='↗ تجهيز PDF ثم مشاركته';
 const intro=selected.intro.map(x=>x.text).join(' ');
 els.summary.textContent=intro||'تم تحميل نصوص النشاط من الملحق.';
 for(const name of ['general','specific','operations'])document.querySelector(`#${name}-count`).textContent=requirementLength(selected[name]);
 const chosen=enabledSections();
 els.preview.innerHTML=`<h2 class="doc-title">${escapeHtml(selected.title)}</h2><p class="doc-source">${escapeHtml(data.source)}</p>`+
 (intro?`<p class="doc-paragraph">${escapeHtml(intro)}</p>`:'')+
 (chosen.length?chosen.map(key=>`<section class="doc-section"><h3>${sectionNames[key]}</h3>${sectionMarkup(selected[key])}</section>`).join(''):'<p>اختر قسمًا واحدًا على الأقل لعرضه وتصديره.</p>');
 els.subtitle.textContent=`${selected.title} · ${chosen.length} أقسام محددة`;
}
function setActivity(id){selected=data.items.find(x=>x.id===id)||data.items[0];renderPreview();}
function fillSelect(query=''){
 const q=query.trim().toLocaleLowerCase('ar');
 const found=data.items.filter(x=>(x.title+' '+x.intro.map(y=>y.text).join(' ')).toLocaleLowerCase('ar').includes(q));
 els.select.replaceChildren(...found.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.title;return option;}));
 els.count.textContent=`${found.length.toLocaleString('ar')} نشاط`;
 if(found.length){if(!found.some(x=>x.id===selected?.id))setActivity(found[0].id);else els.select.value=selected.id;}
 else {selected=null;els.preview.innerHTML='<p>ما لقيناش نشاطًا بالاسم ده. جرّب كلمة أقصر.</p>';els.summary.textContent='';}
}
function makePdfNode(){
 const chosen=enabledSections();if(!chosen.length)throw new Error('اختر قسمًا واحدًا على الأقل.');
 const node=document.createElement('article');node.className='pdf-doc';node.setAttribute('dir','rtl');
 const brand=document.createElement('div');brand.className='pdf-brand-row';brand.setAttribute('dir','ltr');
 const municipality=document.createElement('img');municipality.className='pdf-brand-logo';municipality.src='assets/municipality-aldaayen.png';municipality.alt='بلدية الظعاين';
 const qatar=document.createElement('img');qatar.className='pdf-brand-logo';qatar.src='assets/qatar-ministry.png';qatar.alt='شعار دولة قطر ووزارة البلدية';
 brand.append(municipality,qatar);node.append(brand);
 const title=document.createElement('h1');title.textContent=selected.title;node.append(title);
 const sub=document.createElement('p');sub.className='pdf-sub';sub.textContent='اشتراطات المنشآت الغذائية';node.append(sub);
 for(const block of selected.intro){const p=document.createElement(block.kind==='heading'?'h3':'p');p.textContent=block.text;if(block.kind!=='heading')p.className='pdf-paragraph';node.append(p);}
 for(const key of chosen){
  const h=document.createElement('h2');h.textContent=sectionNames[key];node.append(h);
  for(const block of selected[key]){const p=document.createElement(block.kind==='heading'?'h3':'p');p.textContent=block.text;if(block.kind!=='heading')p.className='pdf-paragraph';node.append(p);}
 }
 document.querySelector('#pdf-stage').replaceChildren(node);return node;
}
function safeFilename(){return `اشتراطات-${selected.title.replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'-')}.pdf`;}
function pdfCacheKey(){return `${selected.id}|${enabledSections().slice().sort().join(',')}|v2`;}
function openPdfCache(){
 if(!('indexedDB' in window))return Promise.resolve(null);
 if(pdfCacheDb)return pdfCacheDb;
 pdfCacheDb=new Promise(resolve=>{
  try{
   const request=indexedDB.open(pdfCacheName,pdfCacheVersion);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('files'))request.result.createObjectStore('files',{keyPath:'key'});};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>resolve(null);
  }catch{resolve(null);}
 });
 return pdfCacheDb;
}
async function readCachedPdf(key){
 const db=await openPdfCache();if(!db)return null;
 return new Promise(resolve=>{
  try{
   const request=db.transaction('files','readonly').objectStore('files').get(key);
   request.onsuccess=()=>{const row=request.result;if(!row){resolve(null);return;}row.usedAt=Date.now();db.transaction('files','readwrite').objectStore('files').put(row);resolve(new File([row.blob],row.name,{type:'application/pdf',lastModified:row.lastModified||Date.now()}));};
   request.onerror=()=>resolve(null);
  }catch{resolve(null);}
 });
}
async function writeCachedPdf(key,file){
 const db=await openPdfCache();if(!db)return;
 try{
  const tx=db.transaction('files','readwrite'),store=tx.objectStore('files');
  store.put({key,name:file.name,blob:file,lastModified:file.lastModified,usedAt:Date.now()});
  const request=store.getAll();
  request.onsuccess=()=>request.result.sort((a,b)=>b.usedAt-a.usedAt).slice(pdfCacheLimit).forEach(row=>store.delete(row.key));
 }catch{}
}
async function generatePdf(){
 if(!selected)throw new Error('اختر نشاطًا أولًا.');
 if(!window.html2pdf){window.print();throw new Error('مكتبة PDF غير متاحة حاليًا. فتحنا نافذة الطباعة؛ اختر «حفظ كـ PDF».');}
 const key=pdfCacheKey(),cached=await readCachedPdf(key);
 if(cached){lastPdf=cached;setStatus('ملف PDF جاهز من النسخة المحفوظة على هذا الجهاز.');return cached;}
 const node=makePdfNode();setStatus('جارٍ تجهيز ملف PDF…');
 const options={margin:[12,12,14,12],filename:safeFilename(),image:{type:'jpeg',quality:.96},html2canvas:{scale:1.6,useCORS:true,backgroundColor:'#ffffff',logging:false},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy'],avoid:['h2','h3']}};
 const worker=window.html2pdf().set(options).from(node).toPdf();
 const pdf=await worker.get('pdf');
 for(let page=1;page<=pdf.getNumberOfPages();page++){
  pdf.setPage(page);pdf.setDrawColor(126,21,58);pdf.setLineWidth(.8);pdf.rect(6,6,198,285);
  pdf.setDrawColor(190,151,71);pdf.setLineWidth(.25);pdf.rect(8,8,194,281);
 }
 const blob=pdf.output('blob');
 lastPdf=new File([blob],safeFilename(),{type:'application/pdf'});await writeCachedPdf(key,lastPdf);
 setStatus(`ملف PDF جاهز · ${(blob.size/1024/1024).toFixed(1)} ميغابايت`);
 return lastPdf;
}
function downloadFile(file){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function makeWhatsAppUrl(number){const message=`مرفق اشتراطات نشاط: ${selected.title}\n${data.source}`;return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;}
els.search.addEventListener('input',e=>fillSelect(e.target.value));
els.select.addEventListener('change',e=>setActivity(e.target.value));
document.querySelectorAll('.checks input').forEach(x=>x.addEventListener('change',renderPreview));
els.toggle.addEventListener('click',()=>{const collapsed=els.preview.classList.toggle('collapsed');els.toggle.textContent=collapsed?'عرض المعاينة':'طي المعاينة';});
els.download.addEventListener('click',async()=>{els.download.disabled=true;try{const f=await generatePdf();downloadFile(f);setStatus('تم تنزيل الملف.');}catch(e){setStatus(e.message,true);}finally{els.download.disabled=false;}});
els.prepare.addEventListener('click',async()=>{
 const number=cleanPhone();if(number.length<8||number.length>15){setStatus('اكتب رقم واتساب دوليًا من ٨ إلى ١٥ رقمًا، من دون علامة +.',true);els.phone.focus();return;}
 els.prepare.disabled=true;
 const win=window.open('about:blank','_blank');
 try{const f=await generatePdf();downloadFile(f);const url=makeWhatsAppUrl(number);if(win){win.location.replace(url);setStatus('تم تنزيل PDF وفتح محادثة واتساب. أرفق الملف الذي نُزّل ثم اضغط إرسال.');}else setStatus('تم تنزيل PDF. اضغط الرابط لفتح محادثة واتساب ثم أرفق الملف.',false,url);}
 catch(e){setStatus(e.message,true);}finally{els.prepare.disabled=false;}
});
els.share.addEventListener('click',async()=>{
 els.share.disabled=true;try{if(!lastPdf){await generatePdf();els.share.textContent='↗ شارك PDF الآن';setStatus('الملف جاهز. اضغط «شارك PDF الآن» لفتح قائمة المشاركة.');return;}const payload={files:[lastPdf]};if(!navigator.canShare?.(payload))throw new Error('مشاركة الملفات غير مدعومة في هذا المتصفح. نزّل PDF ثم أرسله من تطبيق الملفات.');const sharing=navigator.share({files:[lastPdf],title:selected.title,text:`اشتراطات ${selected.title} · ${data.source}`});await sharing;setStatus('اختر واتساب من قائمة المشاركة، ثم اختر المستلِم.');}
 catch(e){if(e.name==='AbortError')setStatus('أُلغيت المشاركة.');else setStatus(e.message,true);}finally{els.share.disabled=false;}
});
fetch('assets/requirements.json').then(r=>{if(!r.ok)throw new Error('تعذر تحميل بيانات الأنشطة.');return r.json();}).then(json=>{data=json;els.share.hidden=!(navigator.share&&navigator.canShare&&typeof File!=='undefined');fillSelect();}).catch(e=>{setStatus(e.message,true);});
