const els={search:document.querySelector('#search-activity'),select:document.querySelector('#activity-select'),count:document.querySelector('#activity-count'),summary:document.querySelector('#activity-summary'),preview:document.querySelector('#preview-content'),subtitle:document.querySelector('#preview-subtitle'),phone:document.querySelector('#phone'),status:document.querySelector('#status'),send:document.querySelector('#send-whatsapp'),share:document.querySelector('#share-pdf'),toggle:document.querySelector('#toggle-preview')};
const sectionNames={general:'الاشتراطات العامة المناسبة للنشاط',specific:'الاشتراطات الخاصة بالنشاط',operations:'الممارسات والإجراءات التشغيلية المناسبة للنشاط'};
let data=null,selected=null,lastPdf=null;

function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function latinDigits(s){return s.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));}
function cleanPhone(){
 let digits=latinDigits(els.phone.value).replace(/\D/g,'');
 if(digits.startsWith('00974')&&digits.length===13)digits=digits.slice(5);
 else if(digits.startsWith('974')&&digits.length===11)digits=digits.slice(3);
 return digits.length===8?`974${digits}`:null;
}
function setStatus(message,error=false){els.status.textContent=message;els.status.classList.toggle('error',error);}
function sectionMarkup(blocks){return blocks.map(b=>b.kind==='heading'?`<h4>${escapeHtml(b.text)}</h4>`:`<p class="doc-paragraph">${escapeHtml(b.text)}</p>`).join('');}
function renderPreview(){
 if(!selected)return;
 lastPdf=null;
 const intro=selected.intro.map(x=>x.text).join(' ');
 els.summary.textContent=intro||'تم تحميل نصوص النشاط من الملحق.';
 els.preview.innerHTML=`<h2 class="doc-title">${escapeHtml(selected.title)}</h2><p class="doc-source">${escapeHtml(data.source)}</p>`+
 (intro?`<p class="doc-paragraph">${escapeHtml(intro)}</p>`:'')+
 ['general','specific','operations'].map(key=>`<section class="doc-section"><h3>${sectionNames[key]}</h3>${sectionMarkup(selected[key])}</section>`).join('');
 els.subtitle.textContent=`${selected.title} · الاشتراطات كاملة`;
}
function clearActivity(message){selected=null;lastPdf=null;els.send.disabled=true;els.share.disabled=true;els.select.selectedIndex=-1;els.preview.innerHTML='<p>اختر نشاطًا لعرض اشتراطاته.</p>';els.subtitle.textContent='محتوى النشاط المختار';els.summary.textContent=message;setStatus('');}
function setActivity(id){
 selected=data.items.find(x=>x.id===id)||null;
 if(!selected){clearActivity('اختر نشاطًا من القائمة للمتابعة.');return;}
 renderPreview();els.send.disabled=false;els.share.disabled=true;setStatus('جارٍ تحميل ملف النشاط…');
 const item=selected;
 hostedPdf(item).then(()=>{if(selected===item){els.share.disabled=false;setStatus('الملف جاهز للمشاركة.');}})
  .catch(()=>{if(selected===item){els.share.disabled=false;setStatus('تعذر تحميل الملف. اضغط «مشاركة الملف» للمحاولة مجددًا.',true);}});
}
function fillSelect(query=''){
 const q=query.trim().toLocaleLowerCase('ar');
 const found=data.items.filter(x=>(x.title+' '+x.intro.map(y=>y.text).join(' ')).toLocaleLowerCase('ar').includes(q));
 els.select.replaceChildren(...found.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.title;return option;}));
 els.count.textContent=`${found.length.toLocaleString('ar')} نشاط`;
 if(selected&&found.some(x=>x.id===selected.id))els.select.value=selected.id;
 else clearActivity(found.length?'اختر نشاطًا من القائمة للمتابعة.':'ما لقيناش نشاطًا بالاسم ده. جرّب كلمة أقصر.');
}
async function hostedPdf(item=selected){
 if(!item)throw new Error('اختر نشاطًا أولًا.');
 if(selected?.id===item.id&&lastPdf)return lastPdf;
 const response=await fetch(`pdfs/${encodeURIComponent(item.id)}.pdf`);
 if(!response.ok)throw new Error('تعذر تحميل ملف PDF المستضاف. حاول مرة أخرى.');
 const blob=await response.blob();
 if(blob.size<5000)throw new Error('ملف PDF المستضاف غير مكتمل. حاول مرة أخرى.');
 const file=new File([blob],`اشتراطات-${item.title.replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'-')}.pdf`,{type:'application/pdf'});
 if(selected?.id===item.id)lastPdf=file;
 return file;
}
function downloadFile(file){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function makeWhatsAppUrl(number){const message=`مرفق اشتراطات نشاط: ${selected.title}\n${data.source}`;return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;}
els.search.addEventListener('input',e=>fillSelect(e.target.value));
els.select.addEventListener('change',e=>setActivity(e.target.value));
els.toggle.addEventListener('click',()=>{const collapsed=els.preview.classList.toggle('collapsed');els.toggle.textContent=collapsed?'عرض المعاينة':'طي المعاينة';});
els.send.addEventListener('click',()=>{
 if(!selected)return;
 const number=cleanPhone();if(!number){setStatus('اكتب رقمًا قطريًا من ٨ أرقام بعد المفتاح 974.',true);els.phone.focus();return;}
 const url=makeWhatsAppUrl(number),win=window.open(url,'_blank');
 if(win){win.opener=null;setStatus('فُتحت محادثة واتساب بالنص الحالي. اضغط إرسال داخل واتساب.');}
 else window.location.href=url;
});
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
