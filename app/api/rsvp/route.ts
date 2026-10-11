import { env } from 'cloudflare:workers';
const headers={'Cache-Control':'no-store'};
export async function GET(){try{const data=await env.DB.prepare('SELECT name, attendance, wish, created_at FROM rsvps WHERE visible = 1 AND wish != ? ORDER BY created_at DESC LIMIT 100').bind('').all();return Response.json({messages:data.results}, {headers});}catch{return Response.json({error:'Ucapan belum dapat dimuatkan. Sila cuba lagi.'},{status:503,headers});}}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Permintaan tidak sah.'},{status:403});
 if(Number(request.headers.get('content-length')||0)>8000)return Response.json({error:'Jawapan terlalu panjang.'},{status:413});
 try{
 const body=await request.text();if(body.length>8000)return Response.json({error:'Jawapan terlalu panjang.'},{status:413});
 const data=JSON.parse(body);const name=typeof data.name==='string'?data.name.trim():'';const wish=typeof data.wish==='string'?data.wish.trim():'';
 if(data.website||!name||name.length>100||wish.length>1000||!['Hadir','Tidak hadir'].includes(data.attendance)||!Number.isInteger(data.pax)||data.pax<0||data.pax>6||typeof data.id!=='string'||!/^[0-9a-f-]{36}$/i.test(data.id)||data.attendance==='Hadir'&&data.pax<1)return Response.json({error:'Sila semak nama dan butiran kehadiran.'},{status:400});
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('cf-connecting-ip')||'local'));const rateKey=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
 const now=Date.now();const existing=await env.DB.prepare('SELECT id FROM rsvps WHERE id = ?').bind(data.id).first();if(existing)return Response.json({ok:true},{headers});
 const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM rsvps WHERE rate_key = ? AND created_at > ?').bind(rateKey,now-3600000).first();if(Number(count?.total)>9)return Response.json({error:'Terlalu banyak jawapan. Sila cuba lagi kemudian atau gunakan WhatsApp.'},{status:429});
 await env.DB.prepare('INSERT INTO rsvps (id,name,attendance,pax,wish,visible,created_at,rate_key) VALUES (?,?,?,?,?,?,?,?)').bind(data.id,name,data.attendance,data.attendance==='Hadir'?data.pax:0,wish,data.visible===true?1:0,now,rateKey).run();return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'Jawapan belum disimpan. Sila cuba lagi atau gunakan WhatsApp.'},{status:503,headers});}
}
