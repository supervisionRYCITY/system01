// ---------------------------------------------------------------
// config.js — ตั้งค่า URL ของ Google Apps Script Web App (Backend API)
// วิธีหา URL: ใน GAS ไปที่ Deploy > Manage deployments > คัดลอก Web app URL
// (ต้อง Deploy แบบ Execute as: Me / Who has access: Anyone)
// ---------------------------------------------------------------
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwYUIThqcQ9relw12mbkhGgtJ-rY__Bi5K3M_HGxuTDJxrrHLp7LojI-e5H3l_R4tiQbw/exec';

// ---------------------------------------------------------------
// PROXY_URL — ใช้สำหรับ Login/Logout/Session (POST) ผ่าน Vercel
// Serverless Function (api/gas.js) เป็น Path สัมพัทธ์ (โดเมนเดียวกับเว็บ
// เอง) จึงไม่ต้องแก้ค่านี้ ไม่ว่าจะ Deploy ที่โดเมนไหนก็ตาม
// ---------------------------------------------------------------
const PROXY_URL = '/api/gas';

// ---------------------------------------------------------------
// GET_PROXY_URL — ใช้สำหรับดึงข้อมูล (news/documents/dashboard/home) ผ่าน Vercel
// Edge-Cached Proxy (api/gas-get.js) แทน JSONP แบบเดิม เพื่อให้ Cache ของ Browser/CDN
// ทำงานได้จริง (JSONP มี ?callback=... สุ่มทุกครั้ง ทำให้ Cache ไม่เคยทำงานเลย)
// ---------------------------------------------------------------
const GET_PROXY_URL = '/api/gas-get';
