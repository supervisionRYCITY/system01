// ---------------------------------------------------------------
// schoolStats.js — หน้า "ข้อมูลสถิตินักเรียน" (school-stats.html)
// อ่านข้อมูลผ่าน GET + JSONP (action=dashboard) และบันทึกผ่าน Vercel Proxy
// (เหมือน newsAdmin.js) ด้วย action: saveSchoolStat
// ---------------------------------------------------------------

let schoolStatsCache = [];

// JSONP แบบเดียวกับใน js/home.js — แยกไว้ในไฟล์นี้เอง เพื่อไม่ต้องพึ่ง home.js
// (home.js มีโค้ดเฉพาะของหน้า Home ที่จะ Error ถ้าถูกเรียกในหน้านี้)
let schoolStatsJsonpCounter = 0;
function schoolStatsJsonpRequest(url) {
  return new Promise((resolve, reject) => {
    const callbackName = 'ssjsonp_cb_' + (schoolStatsJsonpCounter++) + '_' + Date.now();
    const script = document.createElement('script');
    let settled = false;

    function cleanup() {
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = data => {
      settled = true;
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      if (!settled) reject(new Error('เชื่อมต่อ API ไม่สำเร็จ'));
    };

    const sep = url.includes('?') ? '&' : '?';
    script.src = url + sep + 'callback=' + callbackName;
    document.body.appendChild(script);
  });
}

function loadSchoolStats() {
  const container = document.getElementById('schoolStatsList');
  schoolStatsJsonpRequest(`${API_BASE_URL}?action=dashboard`)
    .then(json => {
      if (json.status !== 'ok') throw new Error(json.message || 'เกิดข้อผิดพลาด');
      schoolStatsCache = json.data;
      renderSchoolStatsList_();
    })
    .catch(err => {
      container.innerHTML = `<p class="text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: ${err.message}</p>`;
    });
}

function canEditSchoolStat_(school) {
  const session = getSession();
  const role = session && session.user ? session.user.Role : null;
  if (role === 'Admin') return true;
  if (role === 'Director' && session.user.School_ID && String(session.user.School_ID) === String(school.School_ID)) return true;
  return false;
}

function renderSchoolStatsList_() {
  const container = document.getElementById('schoolStatsList');
  if (!schoolStatsCache.length) {
    container.innerHTML = `<p class="text-sm text-ink/50">ยังไม่มีข้อมูลสถานศึกษา</p>`;
    return;
  }

  container.innerHTML = schoolStatsCache.map(s => `
    <div class="doc-card rounded-xl p-4">
      <div class="flex items-start justify-between gap-2 mb-3">
        <div>
          <p class="text-sm font-semibold text-navy">${s.School_Name}</p>
          <p class="text-xs text-ink/50">${s.School_Type}${s.Academic_Year ? ` &middot; ปีการศึกษา ${s.Academic_Year} ภาคเรียนที่ ${s.Semester}` : ' &middot; ยังไม่มีข้อมูล'}</p>
        </div>
        ${canEditSchoolStat_(s) ? `
          <button onclick="openSchoolStatForm('${s.School_ID}')" class="shrink-0 text-xs font-medium text-white bg-navy hover:bg-navy-dark px-3 py-1.5 rounded-lg">
            <i class="fa-solid fa-pen mr-1"></i>แก้ไข
          </button>` : ''}
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div>
          <p class="text-base font-semibold text-ink">${s.Student_Count}</p>
          <p class="text-[11px] text-ink/50">นักเรียนรวม</p>
        </div>
        <div>
          <p class="text-base font-semibold text-ink">${s.Student_Male_Count || 0}</p>
          <p class="text-[11px] text-ink/50">ชาย</p>
        </div>
        <div>
          <p class="text-base font-semibold text-ink">${s.Student_Female_Count || 0}</p>
          <p class="text-[11px] text-ink/50">หญิง</p>
        </div>
      </div>
    </div>
  `).join('');
}

function openSchoolStatForm(schoolId) {
  const school = schoolStatsCache.find(s => s.School_ID === schoolId);
  if (!school) return;

  document.getElementById('schoolStatFormSchoolId').value = school.School_ID;
  document.getElementById('schoolStatFormSchoolName').textContent = school.School_Name;
  document.getElementById('schoolStatFormYear').value = school.Academic_Year || (new Date().getFullYear() + 543);
  document.getElementById('schoolStatFormSemester').value = school.Semester || '1';
  document.getElementById('schoolStatFormMale').value = school.Student_Male_Count || 0;
  document.getElementById('schoolStatFormFemale').value = school.Student_Female_Count || 0;
  document.getElementById('schoolStatFormError').classList.add('hidden');

  openModal('schoolStatFormModal');
}

function handleSchoolStatFormSubmit(event) {
  event.preventDefault();
  const session = getSession();
  if (!session || !session.token) {
    Swal.fire({ icon: 'error', title: 'กรุณาเข้าสู่ระบบใหม่', confirmButtonColor: '#0E3B5C' });
    return false;
  }

  const errorEl = document.getElementById('schoolStatFormError');
  const submitBtn = document.getElementById('schoolStatFormSubmitBtn');
  errorEl.classList.add('hidden');

  const payload = {
    token: session.token,
    School_ID: document.getElementById('schoolStatFormSchoolId').value,
    Academic_Year: document.getElementById('schoolStatFormYear').value,
    Semester: document.getElementById('schoolStatFormSemester').value,
    Student_Male_Count: document.getElementById('schoolStatFormMale').value,
    Student_Female_Count: document.getElementById('schoolStatFormFemale').value,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังบันทึก...';

  callProxy('saveSchoolStat', payload)
    .then(() => {
      closeModal('schoolStatFormModal');
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1200, showConfirmButton: false });
      loadSchoolStats();
    })
    .catch(err => {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'บันทึก';
    });

  return false;
}

// เรียกจาก common.js หลัง Header/Sidebar โหลดเสร็จ — ตั้งชื่อหน้าใน Header
function afterLayoutLoaded() {
  document.getElementById('pageTitle').textContent = 'ข้อมูลสถิตินักเรียน';
}

document.addEventListener('DOMContentLoaded', () => {
  loadSchoolStats();
});
