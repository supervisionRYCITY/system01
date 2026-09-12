// api/gas.js — Vercel Serverless Function
// ทำหน้าที่เป็นตัวกลาง (Proxy) เรียก GAS Web App ด้วย POST แบบ Server-to-Server
// เลี่ยงปัญหา CORS "Failed to fetch" ที่เกิดเมื่อ Browser เรียก GAS ข้ามโดเมนตรงๆ
//
// ต้องตั้งค่า Environment Variable บน Vercel ก่อนใช้งาน:
//   ชื่อตัวแปร: GAS_EXEC_URL
//   ค่า: Web App URL ที่ได้จากการ Deploy Code.gs (อันเดียวกับที่เคยใช้ใน js/config.js)
// ตั้งค่าที่ Vercel Dashboard > เลือกโปรเจกต์ > Settings > Environment Variables
// (ตั้งแล้วต้อง Redeploy อีกครั้งค่าจึงจะมีผล)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  const gasUrl = process.env.GAS_EXEC_URL;
  if (!gasUrl) {
    res.status(500).json({ status: 'error', message: 'ยังไม่ได้ตั้งค่า GAS_EXEC_URL บน Vercel Environment Variables' });
    return;
  }

  try {
    const gasResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await gasResponse.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ status: 'error', message: 'เชื่อมต่อ Backend (GAS) ไม่สำเร็จ: ' + err.message });
  }
}
