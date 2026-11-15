const els={search:document.querySelector('#search-activity'),select:document.querySelector('#activity-select'),count:document.querySelector('#activity-count'),summary:document.querySelector('#activity-summary'),preview:document.querySelector('#preview-content'),subtitle:document.querySelector('#preview-subtitle'),phone:document.querySelector('#phone'),status:document.querySelector('#status'),statusLink:document.querySelector('#status-link'),prepare:document.querySelector('#prepare-send'),download:document.querySelector('#download-pdf'),share:document.querySelector('#share-pdf'),toggle:document.querySelector('#toggle-preview')};
const sectionNames={general:'الاشتراطات العامة المناسبة للنشاط',specific:'الاشتراطات الخاصة بالنشاط',operations:'الممارسات والإجراءات التشغيلية المناسبة للنشاط'};
let data=null,selected=null,lastPdf=null;

function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function latinDigits(s){return s.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));}
function cleanPhone(){return latinDigits(els.phone.value).replace(/\D/g,'');}
function setStatus(message,error=false,link=null){els.status.textContent=message;els.status.classList.toggle('error',error);els.statusLink.hidden=!link;if(link)els.statusLink.href=link;}
function sectionMarkup(blocks){return blocks.map(b=>b.kind==='heading'?`<h4>${escapeHtml(b.text)}</h4>`:`<p class="doc-paragraph">${escapeHtml(b.text)}</p>`).join('');}
function renderPreview(){
 if(!selected)return;
 lastPdf=null;els.share.textContent='↗ تحميل PDF ثم مشاركته';
 const intro=selected.intro.map(x=>x.text).join(' ');
 els.summary.textContent=intro||'تم تحميل نصوص النشاط من الملحق.';
 els.preview.innerHTML=`<h2 class="doc-title">${escapeHtml(selected.title)}</h2><p class="doc-source">${escapeHtml(data.source)}</p>`+
 (intro?`<p class="doc-paragraph">${escapeHtml(intro)}</p>`:'')+
 ['general','specific','operations'].map(key=>`<section class="doc-section"><h3>${sectionNames[key]}</h3>${sectionMarkup(selected[key])}</section>`).join('');
 els.subtitle.textContent=`${selected.title} · الاشتراطات كاملة`;
}
function setActivity(id){selected=data.items.find(x=>x.id===id)||data.items[0];renderPreview();}
function fillSelect(query=''){
 const q=query.trim().toLocaleLowerCase('ar');
 const found=data.items.filter(x=>(x.title+' '+x.intro.map(y=>y.text).join(' ')).toLocaleLowerCase('ar').includes(q));
 els.select.replaceChildren(...found.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.title;return option;}));
 els.count.textContent=`${found.length.toLocaleString('ar')} نشاط`;
 if(found.length){if(!found.some(x=>x.id===selected?.id))setActivity(found[0].id);else els.select.value=selected.id;}
 else {selected=null;lastPdf=null;els.preview.innerHTML='<p>ما لقيناش نشاطًا بالاسم ده. جرّب كلمة أقصر.</p>';els.summary.textContent='';}
}
function safeFilename(){return `اشتراطات-${selected.title.replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'-')}.pdf`;}
async function hostedPdf(){
 if(!selected)throw new Error('اختر نشاطًا أولًا.');
 if(lastPdf)return lastPdf;
 const response=await fetch(`pdfs/${encodeURIComponent(selected.id)}.pdf`);
 if(!response.ok)throw new Error('تعذر تحميل ملف PDF المستضاف. حاول مرة أخرى.');
 const blob=await response.blob();
 if(blob.size<5000)throw new Error('ملف PDF المستضاف غير مكتمل. حاول مرة أخرى.');
 lastPdf=new File([blob],safeFilename(),{type:'application/pdf'});
 setStatus(`ملف PDF جاهز من Netlify · ${(blob.size/1024/1024).toFixed(1)} ميغابايت`);
 return lastPdf;
}
function downloadFile(file){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function makeWhatsAppUrl(number){const message=`مرفق اشتراطات نشاط: ${selected.title}\n${data.source}`;return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;}
els.search.addEventListener('input',e=>fillSelect(e.target.value));
els.select.addEventListener('change',e=>setActivity(e.target.value));
els.toggle.addEventListener('click',()=>{const collapsed=els.preview.classList.toggle('collapsed');els.toggle.textContent=collapsed?'عرض المعاينة':'طي المعاينة';});
els.download.addEventListener('click',async()=>{els.download.disabled=true;try{const f=await hostedPdf();downloadFile(f);setStatus('تم تنزيل الملف.');}catch(e){setStatus(e.message,true);}finally{els.download.disabled=false;}});
els.prepare.addEventListener('click',async()=>{
 const number=cleanPhone();if(number.length<8||number.length>15){setStatus('اكتب رقم واتساب دوليًا من ٨ إلى ١٥ رقمًا، من دون علامة +.',true);els.phone.focus();return;}
 els.prepare.disabled=true;
 const win=window.open('about:blank','_blank');
 try{const f=await hostedPdf();downloadFile(f);const url=makeWhatsAppUrl(number);if(win){win.location.replace(url);setStatus('تم تنزيل PDF وفتح محادثة واتساب. أرفق الملف الذي نُزّل ثم اضغط إرسال.');}else setStatus('تم تنزيل PDF. اضغط الرابط لفتح محادثة واتساب ثم أرفق الملف.',false,url);}
 catch(e){setStatus(e.message,true);}finally{els.prepare.disabled=false;}
});
els.share.addEventListener('click',async()=>{
 els.share.disabled=true;try{if(!lastPdf){await hostedPdf();els.share.textContent='↗ شارك PDF الآن';setStatus('الملف جاهز. اضغط «شارك PDF الآن» لفتح قائمة المشاركة.');return;}const payload={files:[lastPdf]};if(!navigator.canShare?.(payload))throw new Error('مشاركة الملفات غير مدعومة في هذا المتصفح. نزّل PDF ثم أرسله من تطبيق الملفات.');const sharing=navigator.share({files:[lastPdf],title:selected.title,text:`اشتراطات ${selected.title} · ${data.source}`});await sharing;setStatus('اختر واتساب من قائمة المشاركة، ثم اختر المستلِم.');}
 catch(e){if(e.name==='AbortError')setStatus('أُلغيت المشاركة.');else setStatus(e.message,true);}finally{els.share.disabled=false;}
});
fetch('assets/requirements.json').then(r=>{if(!r.ok)throw new Error('تعذر تحميل بيانات الأنشطة.');return r.json();}).then(json=>{data=json;els.share.hidden=!(navigator.share&&navigator.canShare&&typeof File!=='undefined');fillSelect();}).catch(e=>{setStatus(e.message,true);});
