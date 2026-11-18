const els={select:document.querySelector('#activity-select'),count:document.querySelector('#activity-count'),summary:document.querySelector('#activity-summary'),preview:document.querySelector('#preview-content'),subtitle:document.querySelector('#preview-subtitle'),status:document.querySelector('#status'),share:document.querySelector('#share-pdf'),toggle:document.querySelector('#toggle-preview')};
const sectionNames={general:'الاشتراطات العامة المناسبة للنشاط',specific:'الاشتراطات الخاصة بالنشاط',operations:'الممارسات والإجراءات التشغيلية المناسبة للنشاط'};
let data=null,selected=null,lastPdf=null;

function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setStatus(message,error=false){els.status.textContent=message;els.status.classList.toggle('error',error);}
function sectionMarkup(blocks){return blocks.map(b=>b.kind==='heading'?`<h4>${escapeHtml(b.text)}</h4>`:`<p class="doc-paragraph">${escapeHtml(b.text)}</p>`).join('');}
function renderPreview(){
 if(!selected)return;
 lastPdf=null;
 if(selected.documentOnly){
  els.summary.textContent='الملف الأصلي مرفق كما هو.';
  els.preview.innerHTML=`<h2 class="doc-title">${escapeHtml(selected.title)}</h2><p class="doc-paragraph">الملف الأصلي مرفق كما هو، دون استخراج نصه.</p>`;
  els.subtitle.textContent=`${selected.title} · الملف الأصلي`;
  return;
 }
 const intro=selected.intro.map(x=>x.text).join(' ');
 const source=selected.source||data.source;
 els.summary.textContent=intro||'تم تحميل نصوص النشاط من الملحق.';
 els.preview.innerHTML=`<h2 class="doc-title">${escapeHtml(selected.title)}</h2><p class="doc-source">${escapeHtml(source)}</p>`+
 (intro?`<p class="doc-paragraph">${escapeHtml(intro)}</p>`:'')+
 ['general','specific','operations'].map(key=>`<section class="doc-section"><h3>${sectionNames[key]}</h3>${sectionMarkup(selected[key])}</section>`).join('');
 els.subtitle.textContent=`${selected.title} · الاشتراطات كاملة`;
}
function clearActivity(message){selected=null;lastPdf=null;els.share.disabled=true;els.select.selectedIndex=0;els.preview.innerHTML='<p>اختر نشاطًا لعرض اشتراطاته.</p>';els.subtitle.textContent='محتوى النشاط المختار';els.summary.textContent=message;setStatus('');}
function setActivity(id){
 selected=data.items.find(x=>x.id===id)||null;
 if(!selected){clearActivity('اختر نشاطًا من القائمة للمتابعة.');return;}
 renderPreview();els.share.disabled=true;setStatus('جارٍ تحميل ملف النشاط…');
 const item=selected;
 hostedPdf(item).then(()=>{if(selected===item){els.share.disabled=false;setStatus('الملف جاهز للمشاركة.');}})
  .catch(()=>{if(selected===item){els.share.disabled=false;setStatus('تعذر تحميل الملف. اضغط «مشاركة الملف» للمحاولة مجددًا.',true);}});
}
function fillSelect(){
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='اختر نشاطًا من القائمة';placeholder.disabled=true;
 els.select.replaceChildren(placeholder,...data.items.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.title;return option;}));
 els.count.textContent=`${data.items.length.toLocaleString('ar')} نشاط`;
 clearActivity('اختر نشاطًا من القائمة للمتابعة.');
}
async function hostedPdf(item=selected){
 if(!item)throw new Error('اختر نشاطًا أولًا.');
 if(selected?.id===item.id&&lastPdf)return lastPdf;
 const pdfPath=item.pdfFile||`${item.id}.pdf`;
 const response=await fetch(`pdfs/${encodeURIComponent(pdfPath)}`);
 if(!response.ok)throw new Error('تعذر تحميل ملف PDF المستضاف. حاول مرة أخرى.');
 const blob=await response.blob();
 if(blob.size<5000)throw new Error('ملف PDF المستضاف غير مكتمل. حاول مرة أخرى.');
 const file=new File([blob],`اشتراطات-${item.title.replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'-')}.pdf`,{type:'application/pdf'});
 if(selected?.id===item.id)lastPdf=file;
 return file;
}
function downloadFile(file){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
els.select.addEventListener('change',e=>setActivity(e.target.value));
els.toggle.addEventListener('click',()=>{const collapsed=els.preview.classList.toggle('collapsed');els.toggle.textContent=collapsed?'عرض المعاينة':'طي المعاينة';});
els.share.addEventListener('click',async()=>{
 if(!selected)return;
 els.share.disabled=true;
 try{
  if(!lastPdf){await hostedPdf();setStatus('الملف جاهز. اضغط «مشاركة الملف» مرة أخرى.');return;}
  const payload={files:[lastPdf]};
  if(navigator.canShare?.(payload)){
   await navigator.share({files:[lastPdf],title:selected.title,text:`اشتراطات ${selected.title} · ${data.source}`});
   setStatus('اختر واتساب أو التطبيق الذي تريد مشاركة الملف معه.');
  }else{downloadFile(lastPdf);setStatus('تم تنزيل الملف. يمكنك مشاركته من التنزيلات أو تطبيق الملفات.');}
 }catch(e){if(e.name==='AbortError')setStatus('أُلغيت المشاركة.');else setStatus(e.message,true);}finally{els.share.disabled=!selected;}
});
fetch('assets/requirements.json').then(r=>{if(!r.ok)throw new Error('تعذر تحميل بيانات الأنشطة.');return r.json();}).then(json=>{data=json;fillSelect();}).catch(e=>{setStatus(e.message,true);});

