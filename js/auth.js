// ---------------------------------------------------------------
// auth.js — Login / Logout / Session
// เรียกผ่าน Vercel Serverless Proxy (PROXY_URL ใน config.js) ซึ่งจะ
// forward เป็น POST ไปหา GAS แบบ Server-to-Server (ไม่ติด CORS)
// ---------------------------------------------------------------

const SESSION_STORAGE_KEY = 'supervision_session';

function callProxy(action, payload) {
  return fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })
    .then(res => res.json())
    .then(json => {
      if (json.status !== 'ok') throw new Error(json.message || 'เกิดข้อผิดพลาด');
      return json.data;
    });
}

function saveSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}
function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

// เรียกจากปุ่ม "สำหรับบุคลากร" (แทนที่ Placeholder เดิมใน common.js)
function openStaffLogin() {
  const errorEl = document.getElementById('loginError');
  const form = document.getElementById('loginForm');
  if (errorEl) errorEl.classList.add('hidden');
  if (form) form.reset();
  openModal('loginModal');
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const submitBtn = document.getElementById('loginSubmitBtn');

  errorEl.classList.add('hidden');

  if (!username || !password) {
    errorEl.textContent = 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน';
    errorEl.classList.remove('hidden');
    return false;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังเข้าสู่ระบบ...';

  callProxy('login', { username, password })
    .then(data => {
      saveSession(data);
      closeModal('loginModal');
      renderAuthUI(data.user);
      Swal.fire({ icon: 'success', title: 'เข้าสู่ระบบสำเร็จ', timer: 1200, showConfirmButton: false });
    })
    .catch(err => {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'เข้าสู่ระบบ';
    });

  return false;
}

function handleLogout() {
  const session = getSession();
  clearSession();
  renderAuthUI(null);
  if (session && session.token) {
    callProxy('logout', { token: session.token }).catch(() => {});
  }
}

// สลับปุ่ม "สำหรับบุคลากร" <-> ชื่อผู้ใช้ + ปุ่มออกจากระบบ ใน Header
function renderAuthUI(user) {
  const guestBtn = document.getElementById('staffLoginBtn');
  const guestBtnMobile = document.getElementById('staffLoginBtnMobile');
  const userChip = document.getElementById('userChip');
  const userNameEl = document.getElementById('userChipName');
  if (!guestBtn || !userChip) return; // Header ยังโหลดไม่เสร็จ

  if (user) {
    guestBtn.classList.add('hidden');
    if (guestBtnMobile) guestBtnMobile.classList.add('hidden');
    userChip.classList.remove('hidden');
    userNameEl.textContent = `${user.Prefix || ''}${user.First_Name} ${user.Last_Name}`;
  } else {
    guestBtn.classList.remove('hidden');
    if (guestBtnMobile) guestBtnMobile.classList.remove('hidden');
    userChip.classList.add('hidden');
  }

  applyRoleVisibility(user ? user.Role : null);
}

// ซ่อน/โชว์เมนูใน Sidebar (หรือส่วนอื่นๆ) ตามสิทธิ์ผู้ใช้งาน
// ใช้กับ Element ที่มี attribute data-require-role="ชื่อ Role" เช่น "Admin"
function applyRoleVisibility(role) {
  document.querySelectorAll('[data-require-role]').forEach(el => {
    const requiredRole = el.getAttribute('data-require-role');
    el.classList.toggle('hidden', role !== requiredRole);
  });
}

// ตรวจสอบ Session เดิมตอนโหลดหน้า — เรียกจาก common.js หลัง Header/Modal โหลดเสร็จ
function checkAuthState() {
  const session = getSession();
  if (!session || !session.token) {
    renderAuthUI(null);
    return;
  }

  callProxy('verifySession', { token: session.token })
    .then(user => renderAuthUI(user))
    .catch(() => {
      clearSession();
      renderAuthUI(null);
    });
}
