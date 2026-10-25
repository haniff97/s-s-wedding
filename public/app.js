const form=document.querySelector('#rsvp-form');const status=document.querySelector('#status');const download=document.querySelector('#download');let reply=null;
function setAttendance(){const absent=form.elements.attendance.value==='Tidak hadir';document.querySelector('#pax-wrap').hidden=absent;form.elements.pax.disabled=absent;}
form.elements.attendance.forEach(r=>r.addEventListener('change',setAttendance));
try{const previous=JSON.parse(localStorage.getItem('syahrul-suhaila-rsvp'));if(previous&&typeof previous.name==='string'&&['Hadir','Tidak hadir'].includes(previous.attendance)){reply=previous;form.elements.name.value=previous.name;form.elements.attendance.value=previous.attendance;form.elements.pax.value=String(previous.pax||1);form.elements.wish.value=previous.wish||'';download.hidden=false;status.textContent='Jawapan terdahulu dimuatkan. Anda boleh mengemas kininya.';setAttendance();}}catch{}
const whatsapp=document.querySelector('#whatsapp');
let submissionId=crypto.randomUUID();
function prepareWhatsApp(){const message='Assalamualaikum Syahrul, RSVP majlis 8 November 2026.\nNama: '+form.elements.name.value.trim()+'\nTelefon: '+form.elements.phone.value.trim()+'\nKehadiran: '+form.elements.attendance.value+'\nBilangan tetamu: '+(form.elements.attendance.value==='Hadir'?form.elements.pax.value:0)+'\nUcapan: '+form.elements.wish.value.trim();whatsapp.href='https://wa.me/60109173658?text='+encodeURIComponent(message);}
form.addEventListener('input',prepareWhatsApp);form.addEventListener('change',prepareWhatsApp);
form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;const name=form.elements.name.value.trim();if(!name){form.elements.name.setCustomValidity('Sila masukkan nama anda.');form.elements.name.reportValidity();return;}reply={id:submissionId,name,attendance:form.elements.attendance.value,pax:form.elements.attendance.value==='Hadir'?Number(form.elements.pax.value):0,wish:form.elements.wish.value.trim(),visible:form.elements.visible.checked,website:form.elements.website.value,savedAt:new Date().toISOString()};const button=form.querySelector('button[type=submit]');button.disabled=true;status.textContent='Menghantar jawapan…';prepareWhatsApp();try{const response=await fetch('/api/rsvp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reply)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Jawapan belum disimpan.');try{localStorage.setItem('syahrul-suhaila-rsvp',JSON.stringify(reply));}catch{}status.textContent=reply.visible&&reply.wish?'Terima kasih! RSVP disimpan dan ucapan anda dipaparkan di bawah.':'Terima kasih! RSVP anda telah disimpan.';download.hidden=false;submissionId=crypto.randomUUID();await loadMessages();}catch(error){status.textContent=error.message||'Jawapan belum disimpan. Sila cuba lagi atau gunakan WhatsApp.';}finally{button.disabled=false;}});
form.elements.name.addEventListener('input',()=>form.elements.name.setCustomValidity(''));
download.addEventListener('click',()=>{if(!reply)return;const text='RSVP · Syahrul & Suhaila\nNama: '+reply.name+'\nKehadiran: '+reply.attendance+'\nBilangan: '+reply.pax+'\nUcapan: '+reply.wish+'\n\nSalinan jawapan RSVP anda.';const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='jawapan-rsvp.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
document.querySelector('#calendar').addEventListener('click',()=>{const text=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pink Wedding//MS','BEGIN:VEVENT','UID:syahrul-suhaila-20261108','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;VALUE=DATE:20261108','DTEND;VALUE=DATE:20261109','SUMMARY:Majlis perkahwinan Syahrul & Suhaila','DESCRIPTION:Berdekatan Masjid Darul Hidayah - Kampung Skim Cocos - 91027 Kunak - Sabah. Masa akan dimaklumkan.','END:VEVENT','END:VCALENDAR'].join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/calendar'}));const a=document.createElement('a');a.href=url;a.download='syahrul-suhaila.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});

// The cover is progressive enhancement: the invitation remains available without JavaScript.
const opening=document.querySelector('#opening');
const openButton=document.querySelector('#open-invitation');
const invitationSections=[document.querySelector('main'),document.querySelector('footer')];
if(!location.hash){
 opening.hidden=false;document.body.classList.add('invitation-closed');
 invitationSections.forEach(section=>section.inert=true);
 openButton.focus({preventScroll:true});
 let opened=false;
 const reveal=()=>{if(opened)return;opened=true;openButton.disabled=true;opening.classList.add('is-opening');
 const finish=()=>{opening.hidden=true;document.body.classList.remove('invitation-closed');document.dispatchEvent(new Event('invitation-opened'));invitationSections.forEach(section=>section.inert=false);const title=document.querySelector('h1');title.setAttribute('tabindex','-1');title.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});};
 setTimeout(finish,window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:700);
 };
 openButton.addEventListener('click',reveal);
 opening.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();reveal();}if(e.key==='Tab'){e.preventDefault();openButton.focus();}});
}

async function loadMessages(){const messageStatus=document.querySelector('#guestbook-status');const list=document.querySelector('#guest-messages');try{const response=await fetch('/api/rsvp',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error);list.replaceChildren();for(const message of data.messages){const card=document.createElement('article');card.className='guest-message';const top=document.createElement('div');top.className='guest-message-top';const name=document.createElement('h3');name.textContent=message.name;const badge=document.createElement('small');badge.textContent=message.attendance==='Hadir'?'♡ Akan hadir':'Doa dari jauh';top.append(name,badge);const wish=document.createElement('p');wish.textContent=message.wish;const date=document.createElement('time');date.dateTime=new Date(message.created_at).toISOString();date.textContent=new Intl.DateTimeFormat('ms-MY',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(message.created_at);card.append(top,wish,date);list.append(card);}messageStatus.textContent=data.messages.length?'':'Belum ada ucapan. Jadilah yang pertama menitipkan doa buat pengantin.';}catch(error){messageStatus.textContent=error.message||'Ucapan belum dapat dimuatkan. Sila cuba lagi.';}}
document.querySelector('#refresh-messages').addEventListener('click',loadMessages);
if('IntersectionObserver' in window){const messageObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){messageObserver.disconnect();loadMessages();}},{rootMargin:'300px'});messageObserver.observe(document.querySelector('#guestbook'));}else{loadMessages();}
// Reveal once per visit; all content stays visible when motion is disabled.
function startScrollMotion(){
if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}},{threshold:.08,rootMargin:'0px 0px -25px 0px'});
 const targets=document.querySelectorAll('.invitation > *, .details > *, .programme > .eyebrow, .programme > h2, .programme > p, .simple-timeline article, .rsvp-copy > *, #rsvp-form, .guestbook > .eyebrow, .guestbook > h2, .guestbook > p, .closing > *');
 targets.forEach((element,index)=>{if(element.getBoundingClientRect().top<window.innerHeight)return;element.classList.add('reveal-motion');element.style.setProperty('--reveal-delay',Math.min(index%3*70,140)+'ms');observer.observe(element);});
}

}
if(opening.hidden){startScrollMotion();}else{document.addEventListener('invitation-opened',startScrollMotion,{once:true});}

const sectionLinks=[...document.querySelectorAll('.section-indicator a')];
const readingSections=sectionLinks.map(link=>document.querySelector(link.getAttribute('href')));
let indicatorFrame=0;
function updateIndicator(){indicatorFrame=0;const marker=window.innerHeight*.4;let active=0;readingSections.forEach((section,index)=>{if(section.getBoundingClientRect().top<=marker)active=index;});const total=document.documentElement.scrollHeight-window.innerHeight;const progress=total>0?Math.max(0,Math.min(1,window.scrollY/total)):0;if(progress>.99)active=readingSections.length-1;sectionLinks.forEach((link,index)=>{if(index===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});document.querySelector('#reading-progress').style.transform='scaleY('+progress+')';}
function scheduleIndicator(){if(!indicatorFrame)indicatorFrame=requestAnimationFrame(updateIndicator);}
window.addEventListener('scroll',scheduleIndicator,{passive:true});window.addEventListener('resize',scheduleIndicator);window.addEventListener('load',scheduleIndicator);document.addEventListener('invitation-opened',scheduleIndicator);new ResizeObserver(scheduleIndicator).observe(document.querySelector('main'));updateIndicator();

// Load YouTube only after a guest explicitly opens the invitation or taps music.
const musicToggle=document.querySelector('#music-toggle');
const musicLabel=document.querySelector('#music-label');
let musicPlayer=null,musicRequested=false,musicReady=false,musicPlaying=false;
function showMusicState(playing){musicPlaying=playing;musicToggle.setAttribute('aria-pressed',String(playing));musicToggle.setAttribute('aria-label',playing?'Jeda muzik':'Mainkan muzik');musicLabel.textContent=playing?'Jeda muzik':'Mainkan muzik';}
function startBackgroundMusic(){
 musicRequested=true;
 if(musicReady){musicPlayer.playVideo();return;}
 if(document.querySelector('#youtube-music-api'))return;
 musicLabel.textContent='Memuatkan muzik…';
 window.onYouTubeIframeAPIReady=()=>{musicPlayer=new YT.Player('background-player',{width:1,height:1,videoId:'sBiSqt8k3U4',playerVars:{autoplay:1,controls:0,playsinline:1,loop:1,playlist:'sBiSqt8k3U4',origin:location.origin},events:{onReady:()=>{musicReady=true;const frame=musicPlayer.getIframe();frame.classList.add('background-player');frame.setAttribute('tabindex','-1');frame.setAttribute('aria-hidden','true');frame.setAttribute('allow','autoplay; encrypted-media');if(musicRequested)musicPlayer.playVideo();},onStateChange:event=>{if(event.data===YT.PlayerState.PLAYING)showMusicState(true);else if(event.data===YT.PlayerState.PAUSED||event.data===YT.PlayerState.ENDED)showMusicState(false);},onAutoplayBlocked:()=>showMusicState(false),onError:()=>{showMusicState(false);musicLabel.textContent='Cuba main semula';}}});};
 const script=document.createElement('script');script.id='youtube-music-api';script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>{script.remove();musicLabel.textContent='Cuba main semula';};document.head.append(script);
}
openButton.addEventListener('click',startBackgroundMusic,{once:true});
musicToggle.addEventListener('click',()=>{if(musicPlaying&&musicReady){musicRequested=false;musicPlayer.pauseVideo();}else startBackgroundMusic();});
