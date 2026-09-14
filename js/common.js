// ---------------------------------------------------------------
// common.js — โหลด Header/Sidebar แบบ Partial (fetch + inject)
// และฟังก์ชันที่ใช้ร่วมกันทุกหน้า
// หมายเหตุ: ต้องรันผ่าน Local Server (เช่น `npx serve`) หรือ Vercel
// เท่านั้น — เปิดไฟล์ตรงๆ ผ่าน file:// จะถูก Browser บล็อก fetch()
// ---------------------------------------------------------------

function loadPartial(url, targetId) {
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('โหลด ' + url + ' ไม่สำเร็จ');
      return res.text();
    })
    .then(html => {
      document.getElementById(targetId).innerHTML = html;
    });
}

document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    loadPartial('partials/header.html', 'headerContainer'),
    loadPartial('partials/sidebar.html', 'sidebarContainer'),
    loadPartial('partials/login-modal.html', 'loginModalContainer'),
  ])
    .then(() => {
      // Hook ให้แต่ละหน้ากำหนดเอง เช่น ตั้งชื่อหน้าใน Header หรือไฮไลต์เมนูที่ Active
      if (typeof afterLayoutLoaded === 'function') afterLayoutLoaded();
      // ตรวจสอบว่ามี Session เดิมค้างอยู่ไหม (จาก auth.js) แล้วอัปเดต Header ให้ตรงสถานะ
      if (typeof checkAuthState === 'function') checkAuthState();
    })
    .catch(err => console.error(err));
});

// ---------- Sidebar (มือถือ/แท็บเล็ต) ----------
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  const overlay = document.getElementById('sidebarOverlay');
  overlay.classList.remove('opacity-0', 'pointer-events-none');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebarOverlay');
  overlay.classList.add('opacity-0', 'pointer-events-none');
}

// ---------- Sidebar Accordion ----------
function toggleSidebarGroup(groupId) {
  const panel = document.getElementById(groupId);
  const icon = document.getElementById(groupId + '-icon');
  panel.classList.toggle('open');
  icon.classList.toggle('-rotate-90');
}

// ---------- Modal ทั่วไป (ใช้ซ้ำได้ทุกหน้า) ----------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

// หมายเหตุ: ฟังก์ชัน openStaffLogin() ย้ายไปอยู่ที่ js/auth.js แล้ว
// (เดิมเป็น Placeholder เฉยๆ ตอนนี้เปิด Modal Login จริง)


// ---------------------------------------------------------------
// Helper กลาง: ใช้ร่วมกันได้ทุกหน้า (Common.js โหลดอยู่แล้วทุกหน้าอยู่แล้ว)
// ---------------------------------------------------------------

// เรียก GET ผ่าน Vercel Edge-Cached Proxy พร้อม Retry อัตโนมัติ (รูปแบบเดียวกับที่ใช้ใน
// home.js/schoolStats.js เดิม แต่ย้ายมาไว้ที่นี่ให้หน้าใหม่เรียกใช้ซ้ำได้โดยไม่ต้องเขียนซ้ำ)
function fetchApiGet_(url, retriesLeft) {
  if (retriesLeft === undefined) retriesLeft = 2;
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('เชื่อมต่อ API ไม่สำเร็จ (' + res.status + ')');
      return res.json();
    })
    .catch(err => {
      if (retriesLeft <= 0) throw err;
      return new Promise(resolve => setTimeout(resolve, 800))
        .then(() => fetchApiGet_(url, retriesLeft - 1));
    });
}

// แปลงไฟล์ที่ผู้ใช้เลือก (จาก <input type="file">) เป็น Base64 สำหรับส่งขึ้น Backend
// คืนค่า { base64, filename, mimeType } — ใช้กับทั้งรูปภาพและ PDF ได้เหมือนกัน
function fileToBase64_(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve({ base64: base64, filename: file.name, mimeType: file.type });
    };
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}
