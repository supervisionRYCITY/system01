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

// อ่าน Blob (ชิ้นส่วนของไฟล์) เป็น Base64 — ใช้ภายใน uploadFileChunked_ เท่านั้น
function blobToBase64_(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------
// uploadFileChunked_: อัปโหลดไฟล์ใหญ่ (10-20MB+) โดยแบ่งเป็นชิ้นละ ~1.5MB ก่อน Base64
// (Base64 ทำให้โตขึ้น ~33% เหลือ ~2MB ต่อ Request ปลอดภัยกว่า Limit ~4.5MB ของ Vercel มาก)
// ส่งทีละชิ้นตามลำดับผ่าน action: uploadFileChunk แล้วเรียก action: finalizeFileUpload
// ครั้งเดียวตอนท้ายให้ Backend ประกอบกลับเป็นไฟล์เดียว คืนค่า Promise<{url: string}>
//
// onProgress(percent): callback เรียกทุกครั้งที่อัปโหลดชิ้นสำเร็จ 1 ชิ้น (0-100)
// ใช้แสดง Progress ให้ผู้ใช้เห็นระหว่างรอได้ (ไฟล์ใหญ่ใช้เวลาหลายวินาทีถึงเป็นนาที)
//
// ใช้ได้กับทุกระบบงานย่อยในอนาคตที่ต้องอัปโหลดไฟล์ใหญ่ — เรียกใช้ตรงๆ ได้เลยไม่ต้องเขียนซ้ำ
// ---------------------------------------------------------------
const UPLOAD_CHUNK_SIZE_ = 1.5 * 1024 * 1024; // 1.5MB ต่อชิ้น

function uploadFileChunked_(token, file, onProgress) {
  const uploadId = 'UP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const totalChunks = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK_SIZE_));

  function uploadChunk(index) {
    const start = index * UPLOAD_CHUNK_SIZE_;
    const end = Math.min(start + UPLOAD_CHUNK_SIZE_, file.size);
    const chunkBlob = file.slice(start, end);

    return blobToBase64_(chunkBlob)
      .then(base64 => callProxy('uploadFileChunk', {
        token: token,
        uploadId: uploadId,
        chunkIndex: index,
        data: base64,
      }))
      .then(() => {
        if (onProgress) onProgress(Math.round(((index + 1) / totalChunks) * 100));
        if (index + 1 < totalChunks) return uploadChunk(index + 1);
      });
  }

  return uploadChunk(0).then(() => callProxy('finalizeFileUpload', {
    token: token,
    uploadId: uploadId,
    filename: file.name,
    mimeType: file.type || 'application/pdf',
  }));
}
