// ---------------------------------------------------------------
// schoolStats.js — หน้า "ข้อมูลสถิตินักเรียน" (school-stats.html)
// อ่านข้อมูลผ่าน GET + JSONP (action=dashboard) และบันทึกผ่าน Vercel Proxy
// (เหมือน newsAdmin.js) ด้วย action: saveSchoolStat
// ---------------------------------------------------------------

let schoolStatsCache = [];

// ระดับชั้น: ชุดมาตรฐานตายตัว — ต้องตรงกับ GRADE_LEVELS_/SCHOOL_TYPE_GRADE_GROUPS_ ใน Code.gs เป๊ะ
// (ถ้าจะแก้ไขรายการระดับชั้น ต้องแก้ทั้ง 2 ไฟล์ให้ตรงกัน)
const GRADE_LEVELS_ = [
  { id: 'K1', name: 'อนุบาล 1', group: 'อนุบาล' },
  { id: 'K2', name: 'อนุบาล 2', group: 'อนุบาล' },
  { id: 'K3', name: 'อนุบาล 3', group: 'อนุบาล' },
  { id: 'P1', name: 'ป.1', group: 'ประถม' },
  { id: 'P2', name: 'ป.2', group: 'ประถม' },
  { id: 'P3', name: 'ป.3', group: 'ประถม' },
  { id: 'P4', name: 'ป.4', group: 'ประถม' },
  { id: 'P5', name: 'ป.5', group: 'ประถม' },
  { id: 'P6', name: 'ป.6', group: 'ประถม' },
  { id: 'M1', name: 'ม.1', group: 'มัธยม' },
  { id: 'M2', name: 'ม.2', group: 'มัธยม' },
  { id: 'M3', name: 'ม.3', group: 'มัธยม' },
  { id: 'M4', name: 'ม.4', group: 'มัธยม' },
  { id: 'M5', name: 'ม.5', group: 'มัธยม' },
  { id: 'M6', name: 'ม.6', group: 'มัธยม' },
];

const SCHOOL_TYPE_GRADE_GROUPS_ = {
  'ปฐมวัย': ['อนุบาล'],
  'ประถมศึกษา': ['อนุบาล', 'ประถม'],
  'มัธยมศึกษา': ['มัธยม'],
};

function getGradeLevelsForSchoolType_(schoolType) {
  const allowedGroups = SCHOOL_TYPE_GRADE_GROUPS_[schoolType] || [];
  return GRADE_LEVELS_.filter(g => allowedGroups.indexOf(g.group) !== -1);
}

// เก็บผลรายละเอียดระดับชั้นที่เคยโหลดไว้ (School_ID -> array) กันโหลดซ้ำเวลากางแล้วหุบแล้วกางใหม่
let schoolGradeDetailCache = {};

// JSONP แบบเดียวกับใน js/home.js
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

// เรียก JSONP พร้อม Retry อัตโนมัติ (แก้ปัญหา "เชื่อมต่อ API ไม่สำเร็จ" ที่เกิดเป็นบางครั้ง
// ซึ่งมักเกิดจาก Google Apps Script ยุ่ง/ช้าชั่วคราว โดยเฉพาะเวลามีหลายระบบ/หลายแท็บ
// เรียกพร้อมกัน — ลองใหม่อัตโนมัติก่อนค่อยถือว่าเชื่อมต่อไม่สำเร็จจริง
function schoolStatsJsonpRequestWithRetry_(url, retriesLeft) {
  if (retriesLeft === undefined) retriesLeft = 2;
  return schoolStatsJsonpRequest(url).catch(err => {
    if (retriesLeft <= 0) throw err;
    return new Promise(resolve => setTimeout(resolve, 800))
      .then(() => schoolStatsJsonpRequestWithRetry_(url, retriesLeft - 1));
  });
}

// silent = true: ใช้ตอนรีเฟรชเงียบๆ หลังบันทึกฟอร์มสำเร็จ (การ์ดถูกอัปเดตแบบ Optimistic
// ไปแล้วก่อนหน้า) ถ้ารอบนี้เชื่อมต่อไม่สำเร็จ จะไม่เขียนทับการ์ดที่อัปเดตไปแล้วด้วย Error
function loadSchoolStats(silent) {
  const container = document.getElementById('schoolStatsList');
  if (!silent) container.innerHTML = `<p class="text-sm text-ink/40">กำลังโหลด...</p>`;

  return schoolStatsJsonpRequestWithRetry_(`${API_BASE_URL}?action=dashboard`)
    .then(json => {
      if (json.status !== 'ok') throw new Error(json.message || 'เกิดข้อผิดพลาด');
      schoolStatsCache = json.data;
      renderSchoolStatsList_();
    })
    .catch(err => {
      if (silent) return;
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
      ${s.Academic_Year ? `
        <button onclick="toggleSchoolGradeDetail('${s.School_ID}')" id="gradeToggleBtn-${s.School_ID}" class="w-full text-center text-xs text-navy hover:text-gold mt-3 pt-3 border-t border-line">
          <i class="fa-solid fa-chevron-down mr-1"></i>ดูรายละเอียดตามระดับชั้น
        </button>
        <div id="gradeDetail-${s.School_ID}" class="hidden mt-2"></div>
      ` : ''}
    </div>
  `).join('');
}

// ---------------- Accordion: รายละเอียดแยกระดับชั้น ----------------
function toggleSchoolGradeDetail(schoolId) {
  const detailEl = document.getElementById('gradeDetail-' + schoolId);
  const btnEl = document.getElementById('gradeToggleBtn-' + schoolId);
  if (!detailEl) return;

  const isHidden = detailEl.classList.contains('hidden');
  if (!isHidden) {
    detailEl.classList.add('hidden');
    btnEl.innerHTML = '<i class="fa-solid fa-chevron-down mr-1"></i>ดูรายละเอียดตามระดับชั้น';
    return;
  }

  detailEl.classList.remove('hidden');
  btnEl.innerHTML = '<i class="fa-solid fa-chevron-up mr-1"></i>ซ่อนรายละเอียด';

  if (schoolGradeDetailCache[schoolId]) {
    renderSchoolGradeDetail_(schoolId, schoolGradeDetailCache[schoolId]);
    return;
  }

  detailEl.innerHTML = `<p class="text-xs text-ink/40 text-center py-2">กำลังโหลด...</p>`;
  loadSchoolGradeDetail_(schoolId)
    .then(rows => {
      schoolGradeDetailCache[schoolId] = rows;
      renderSchoolGradeDetail_(schoolId, rows);
    })
    .catch(err => {
      detailEl.innerHTML = `<p class="text-xs text-red-600 text-center py-2">โหลดไม่สำเร็จ: ${err.message}</p>`;
    });
}

function loadSchoolGradeDetail_(schoolId) {
  const school = schoolStatsCache.find(s => s.School_ID === schoolId);
  if (!school) return Promise.reject(new Error('ไม่พบข้อมูลโรงเรียน'));

  const url = `${API_BASE_URL}?action=schoolGradeStats&schoolId=${encodeURIComponent(schoolId)}&year=${encodeURIComponent(school.Academic_Year)}&semester=${encodeURIComponent(school.Semester)}`;
  return schoolStatsJsonpRequestWithRetry_(url).then(json => {
    if (json.status !== 'ok') throw new Error(json.message || 'เกิดข้อผิดพลาด');
    return json.data;
  });
}

function renderSchoolGradeDetail_(schoolId, rows) {
  const detailEl = document.getElementById('gradeDetail-' + schoolId);
  if (!detailEl) return;

  const rowsWithData = rows.filter(r => r.Male_Count > 0 || r.Female_Count > 0);
  if (!rowsWithData.length) {
    detailEl.innerHTML = `<p class="text-xs text-ink/40 text-center py-2">ยังไม่มีข้อมูลแยกระดับชั้น</p>`;
    return;
  }

  detailEl.innerHTML = `
    <table class="w-full text-xs">
      <thead>
        <tr class="text-ink/50">
          <th class="text-left font-medium py-1">ระดับชั้น</th>
          <th class="text-center font-medium py-1">ชาย</th>
          <th class="text-center font-medium py-1">หญิง</th>
          <th class="text-center font-medium py-1">รวม</th>
        </tr>
      </thead>
      <tbody>
        ${rowsWithData.map(r => `
          <tr class="border-t border-line/60">
            <td class="py-1 text-ink/80">${r.Grade_Name}</td>
            <td class="py-1 text-center text-ink/80">${r.Male_Count}</td>
            <td class="py-1 text-center text-ink/80">${r.Female_Count}</td>
            <td class="py-1 text-center font-medium text-navy">${r.Male_Count + r.Female_Count}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openSchoolStatForm(schoolId) {
  const school = schoolStatsCache.find(s => s.School_ID === schoolId);
  if (!school) return;

  document.getElementById('schoolStatFormSchoolId').value = school.School_ID;
  document.getElementById('schoolStatFormSchoolType').value = school.School_Type;
  document.getElementById('schoolStatFormSchoolName').textContent = school.School_Name;
  document.getElementById('schoolStatFormYear').value = school.Academic_Year || (new Date().getFullYear() + 543);
  document.getElementById('schoolStatFormSemester').value = school.Semester || '1';
  document.getElementById('schoolStatFormError').classList.add('hidden');

  const rowsContainer = document.getElementById('schoolStatFormGradeRows');
  rowsContainer.innerHTML = `<p class="text-xs text-ink/40 text-center py-2">กำลังโหลด...</p>`;
  openModal('schoolStatFormModal');

  // ถ้ามีข้อมูลเดิมอยู่แล้วให้ดึงมาเติมในฟอร์ม ถ้ายังไม่มีข้อมูลเลยให้เริ่มจาก 0 ทุกช่อง
  const detailPromise = schoolGradeDetailCache[schoolId]
    ? Promise.resolve(schoolGradeDetailCache[schoolId])
    : (school.Academic_Year ? loadSchoolGradeDetail_(schoolId).catch(() => []) : Promise.resolve([]));

  detailPromise.then(existingRows => {
    renderSchoolStatFormGradeRows_(school.School_Type, existingRows);
  });
}

// วาดแถวกรอกข้อมูลตามระดับชั้นที่เกี่ยวข้องกับประเภทโรงเรียนนั้นเท่านั้น
// (เช่น รร.ประถมศึกษา เห็นแค่ อนุบาล 1-3 + ป.1-6 ไม่เห็น ม.1-6)
function renderSchoolStatFormGradeRows_(schoolType, existingRows) {
  const grades = getGradeLevelsForSchoolType_(schoolType);
  const container = document.getElementById('schoolStatFormGradeRows');

  container.innerHTML = grades.map(g => {
    const existing = existingRows.find(r => r.Grade_Level === g.id) || { Male_Count: 0, Female_Count: 0 };
    return `
      <div class="grid grid-cols-3 gap-2 items-center">
        <label class="text-xs text-ink/70">${g.name}</label>
        <input type="number" min="0" data-grade-id="${g.id}" data-gender="male"
               value="${existing.Male_Count}" oninput="updateSchoolStatFormTotal_()"
               class="w-full px-2 py-1.5 rounded-lg border border-line text-sm text-center focus:outline-none focus:border-navy">
        <input type="number" min="0" data-grade-id="${g.id}" data-gender="female"
               value="${existing.Female_Count}" oninput="updateSchoolStatFormTotal_()"
               class="w-full px-2 py-1.5 rounded-lg border border-line text-sm text-center focus:outline-none focus:border-navy">
      </div>
    `;
  }).join('');

  updateSchoolStatFormTotal_();
}

function updateSchoolStatFormTotal_() {
  const maleInputs = document.querySelectorAll('#schoolStatFormGradeRows input[data-gender="male"]');
  const femaleInputs = document.querySelectorAll('#schoolStatFormGradeRows input[data-gender="female"]');
  let male = 0;
  let female = 0;
  maleInputs.forEach(el => { male += Number(el.value) || 0; });
  femaleInputs.forEach(el => { female += Number(el.value) || 0; });
  document.getElementById('schoolStatFormTotal').textContent = `${male + female} คน (ชาย ${male} / หญิง ${female})`;
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

  const schoolId = document.getElementById('schoolStatFormSchoolId').value;
  const schoolType = document.getElementById('schoolStatFormSchoolType').value;
  const grades = getGradeLevelsForSchoolType_(schoolType);

  const gradeStats = grades.map(g => {
    const maleInput = document.querySelector(`#schoolStatFormGradeRows input[data-grade-id="${g.id}"][data-gender="male"]`);
    const femaleInput = document.querySelector(`#schoolStatFormGradeRows input[data-grade-id="${g.id}"][data-gender="female"]`);
    return {
      Grade_Level: g.id,
      Male_Count: Number(maleInput ? maleInput.value : 0) || 0,
      Female_Count: Number(femaleInput ? femaleInput.value : 0) || 0,
    };
  });

  const totalMale = gradeStats.reduce((sum, g) => sum + g.Male_Count, 0);
  const totalFemale = gradeStats.reduce((sum, g) => sum + g.Female_Count, 0);

  const payload = {
    token: session.token,
    School_ID: schoolId,
    Academic_Year: document.getElementById('schoolStatFormYear').value,
    Semester: document.getElementById('schoolStatFormSemester').value,
    GradeStats: gradeStats,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังบันทึก...';

  callProxy('saveSchoolStat', payload)
    .then(result => {
      closeModal('schoolStatFormModal');
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1200, showConfirmButton: false });

      // อัปเดตการ์ดของโรงเรียนนี้ทันทีด้วยค่าที่เพิ่งบันทึกสำเร็จ (Optimistic Update)
      const school = schoolStatsCache.find(s => s.School_ID === schoolId);
      if (school) {
        school.Academic_Year = result.Academic_Year;
        school.Semester = result.Semester;
        school.Student_Count = result.Student_Count;
        school.Student_Male_Count = totalMale;
        school.Student_Female_Count = totalFemale;
      }

      // ล้าง Cache รายละเอียดระดับชั้นของโรงเรียนนี้ เพื่อให้ Accordion โหลดค่าล่าสุดใหม่รอบหน้า
      delete schoolGradeDetailCache[schoolId];
      renderSchoolStatsList_();

      // รีเฟรชซ้ำแบบเงียบๆ เพื่อให้ตรงกับ Server เป๊ะ (เผื่อมีคนอื่นแก้ไขพร้อมกัน)
      loadSchoolStats(true);
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
