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
