// api/gas-get.js — Vercel Serverless Function (Edge-Cacheable GET Proxy)
// พร็อกซี Request แบบ "อ่านข้อมูล" (news/documents/dashboard/home) ไปหา GAS
// แบบ Server-to-Server เหมือน api/gas.js (ตัวเดิมสำหรับ Login/News Admin ฯลฯ)
// ต่างกันตรงที่ไฟล์นี้ตั้งค่า Cache-Control ให้ Vercel Edge Network (CDN) แคชผลลัพธ์
// ได้จริง ทำให้ผู้ใช้ส่วนใหญ่ได้รับข้อมูลจาก Edge ใกล้ตัวทันที ไม่ต้องยิงไปหา GAS ทุกครั้ง
//
// เหตุผลที่เลิกใช้ JSONP: JSONP ต้องมี ?callback=ชื่อสุ่ม ต่อท้าย URL เสมอ ทำให้ URL
// ไม่ซ้ำกันสักครั้ง จึง Cache อะไรไม่ได้เลยทั้งฝั่ง Browser และ CDN
//
// ใช้ Environment Variable ตัวเดียวกับ api/gas.js (GAS_EXEC_URL) ไม่ต้องตั้งค่าเพิ่ม

const ALLOWED_ACTIONS = ['news', 'documents', 'dashboard', 'home'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  const action = req.query.action;
  if (!ALLOWED_ACTIONS.includes(action)) {
    res.status(400).json({ status: 'error', message: 'action ไม่ถูกต้องหรือไม่ได้รับอนุญาตให้แคช: "' + action + '"' });
    return;
  }

  const gasUrl = process.env.GAS_EXEC_URL;
  if (!gasUrl) {
    res.status(500).json({ status: 'error', message: 'ยังไม่ได้ตั้งค่า GAS_EXEC_URL บน Vercel Environment Variables' });
    return;
  }

  try {
    const targetUrl = gasUrl + '?action=' + encodeURIComponent(action);
    const data = await callGasGetWithRedirect_(targetUrl);

    // max-age=10: Browser เก็บสั้นๆ 10 วินาที
    // s-maxage=20: Vercel Edge/CDN เก็บ 20 วินาที เท่านั้น (ลดจาก 300 วิ)
    // เหตุผล: Cache ชั้นนี้ไม่รู้เมื่อ Admin แก้/ลบข้อมูล (Cache ฝั่ง GAS ถูกล้างทันทีตอนมีการ
    // แก้ไขอยู่แล้ว แต่ Cache ชั้นนี้เป็นคนละระบบ ไม่มีกลไกแจ้งให้ล้างตาม) ถ้าตั้งนานเกินไป
    // ข้อมูลที่ลบ/แก้ไขไปแล้วจะยัง "ค้าง" แสดงผลเก่าอยู่จนกว่า Cache จะหมดอายุเอง
    // 20 วินาทีเป็นจุดสมดุลที่ยังได้ประโยชน์ด้าน Performance เวลามีคนเข้าพร้อมกันเยอะๆ
    // แต่ไม่ทำให้ข้อมูลค้างนานจนรู้สึกได้ (คนละส่วนกับ Optimistic Update ที่ทำให้ผู้ที่แก้ไข
    // เองเห็นผลทันทีอยู่แล้วโดยไม่ต้องพึ่ง Cache นี้เลย)
    res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=20, stale-while-revalidate=60');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ status: 'error', message: 'เชื่อมต่อ Backend (GAS) ไม่สำเร็จ: ' + err.message });
  }
}

// เรียก GAS แบบ GET แล้วจัดการ Redirect (302) เอง เหมือนที่ api/gas.js ทำสำหรับ POST
// (GAS Web App ตอบกลับด้วย 302 เสมอ ต้องตามไปเอาเนื้อหาจริงจาก Location header เอง)
async function callGasGetWithRedirect_(url, maxHops = 3) {
  let response = await fetch(url, { method: 'GET', redirect: 'manual' });

  let hops = 0;
  while ([301, 302, 303, 307, 308].includes(response.status) && hops < maxHops) {
    const location = response.headers.get('location');
    if (!location) break;
    response = await fetch(location, { method: 'GET', redirect: 'manual' });
    hops++;
  }

  return response.json();
}
