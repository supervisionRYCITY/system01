// ---------------------------------------------------------------
// curriculumSchool.js — หน้า "หลักสูตรสถานศึกษา" (curriculum-school.html)
// ระบบนี้ "ทั้งการดูและจัดการ" ผูกกับสิทธิ์ User_Permissions (Module: school_curriculum)
// ไม่ใช่ข้อมูลสาธารณะเหมือนหน้าอื่น — ถ้าไม่มีสิทธิ์ View จะไม่เห็นข้อมูลเลย
// ---------------------------------------------------------------

let curriculumCache = [];
let curriculumPermissionDenied = false;

function loadSchoolCurriculums() {
  const session = getSession();
  const content = document.getElementById('curriculumContent');

  if (!session || !session.token) {
    content.innerHTML = `<p class="text-sm text-ink/50">กรุณาเข้าสู่ระบบเพื่อดูข้อมูลหลักสูตรสถานศึกษา</p>`;
    document.getElementById('curriculumAddBtn').classList.add('hidden');
    return;
  }

  callProxy('getSchoolCurriculums', { token: session.token })
    .then(data => {
      curriculumPermissionDenied = false;
      curriculumCache = data;
      renderCurriculumContent_();
      updateCurriculumAddButtonVisibility_();
    })
    .catch(err => {
      curriculumPermissionDenied = true;
      content.innerHTML = `<p class="text-sm text-ink/50">คุณไม่มีสิทธิ์เข้าถึงระบบงานนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ (${err.message})</p>`;
      document.getElementById('curriculumAddBtn').classList.add('hidden');
    });
}

// ปุ่ม "เพิ่มหลักสูตร" แสดงเฉพาะ Admin หรือคนที่มี Can_Create=TRUE ใน User_Permissions
// เท่านั้น — เดาจากการที่ getSchoolCurriculums สำเร็จ (ไม่ได้บอกสิทธิ์ Create ตรงๆ) จึง
// ให้ Backend เป็นผู้ตัดสินสุดท้ายเสมอ (ปุ่มนี้เป็นแค่ทางลัด กดแล้วถ้าไม่มีสิทธิ์จริง
// Backend จะปฏิเสธตอนบันทึกอีกชั้นหนึ่งอยู่ดี)
function updateCurriculumAddButtonVisibility_() {
  const session = getSession();
  const btn = document.getElementById('curriculumAddBtn');
  if (session && session.user && (session.user.Role === 'Admin' || session.user.Role === 'Director')) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function renderCurriculumContent_() {
  const content = document.getElementById('curriculumContent');
  if (!curriculumCache.length) {
    content.innerHTML = `<p class="text-sm text-ink/50">ยังไม่มีข้อมูลหลักสูตร</p>`;
    return;
  }

  // จัดกลุ่มตามโรงเรียน แสดงเป็นแถวยาวต่อโรงเรียน (ตามที่ตกลงกันไว้)
  const grouped = {};
  curriculumCache.forEach(c => {
    if (!grouped[c.School_ID]) grouped[c.School_ID] = { name: c.School_Name, color: c.School_Color, items: [] };
    grouped[c.School_ID].items.push(c);
  });

  const session = getSession();
  const canManage = (schoolId) => session && session.user && (session.user.Role === 'Admin' || String(session.user.School_ID) === String(schoolId));

  content.innerHTML = Object.keys(grouped).map(schoolId => {
    const group = grouped[schoolId];
    return `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-2">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${group.color}"></span>
          <p class="text-sm font-semibold text-navy">${group.name}</p>
        </div>
        <div class="flex gap-3 overflow-x-auto pb-2">
          ${group.items.map(c => `
            <a href="${c.File_URL}" target="_blank" rel="noopener"
               class="doc-card rounded-xl p-3 shrink-0 w-52 block relative group"
               style="border-top: 3px solid ${group.color}">
              <i class="fa-solid fa-file-pdf text-2xl text-ink/30 mb-2"></i>
              <p class="text-sm font-medium text-ink leading-snug line-clamp-2 mb-1">${c.Curriculum_Name}</p>
              <p class="text-[11px] text-ink/50">${c.Education_Level} &middot; ปีการศึกษา ${c.Academic_Year}</p>
              ${canManage(c.School_ID) ? `
                <div class="absolute top-2 right-2 hidden group-hover:flex gap-1">
                  <button onclick="event.preventDefault(); openCurriculumForm('${c.Curriculum_ID}')" class="w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-navy hover:bg-navy hover:text-white">
                    <i class="fa-solid fa-pen text-[10px]"></i>
                  </button>
                  <button onclick="event.preventDefault(); handleDeleteCurriculum('${c.Curriculum_ID}')" class="w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-red-600 hover:bg-red-600 hover:text-white">
                    <i class="fa-solid fa-trash text-[10px]"></i>
                  </button>
                </div>
              ` : ''}
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ---------------- Modal: Create / Edit ----------------
function openCurriculumForm(curriculumId) {
  const item = curriculumId ? curriculumCache.find(c => c.Curriculum_ID === curriculumId) : null;
  const session = getSession();

  document.getElementById('curriculumFormId').value = item ? item.Curriculum_ID : '';
  document.getElementById('curriculumFormTitle').textContent = item ? 'แก้ไขหลักสูตร' : 'เพิ่มหลักสูตร';
  document.getElementById('curriculumFormYear').value = item ? item.Academic_Year : (new Date().getFullYear() + 543);
  document.getElementById('curriculumFormLevel').value = item ? item.Education_Level : 'ประถมศึกษา';
  document.getElementById('curriculumFormName').value = item ? item.Curriculum_Name : '';
  document.getElementById('curriculumFormFile').value = '';
  document.getElementById('curriculumFormError').classList.add('hidden');

  const existingFileEl = document.getElementById('curriculumFormExistingFile');
  if (item && item.File_URL) {
    existingFileEl.textContent = 'ไฟล์เดิม: ' + (item.File_Name || 'curriculum.pdf') + ' (ไม่เลือกไฟล์ใหม่ = ใช้ไฟล์เดิมต่อ)';
    existingFileEl.classList.remove('hidden');
  } else {
    existingFileEl.classList.add('hidden');
  }

  // Admin เลือกโรงเรียนได้ทุกที่ — คนอื่นล็อกเป็นโรงเรียนของตัวเองเสมอ (Backend บังคับอยู่แล้ว
  // แต่ซ่อน Dropdown ไว้ด้วยเพื่อ UX ที่ชัดเจน ไม่ให้สับสนว่าเลือกได้)
  const schoolWrap = document.getElementById('curriculumFormSchoolWrap');
  if (session.user.Role === 'Admin') {
    schoolWrap.classList.remove('hidden');
    const schoolSelect = document.getElementById('curriculumFormSchool');
    const uniqueSchools = {};
    curriculumCache.forEach(c => { uniqueSchools[c.School_ID] = c.School_Name; });
    schoolSelect.innerHTML = Object.keys(uniqueSchools).map(id => `<option value="${id}">${uniqueSchools[id]}</option>`).join('');
    if (item) schoolSelect.value = item.School_ID;
  } else {
    schoolWrap.classList.add('hidden');
  }

  openModal('curriculumFormModal');
}

function handleCurriculumFormSubmit(event) {
  event.preventDefault();
  const session = getSession();
  if (!session || !session.token) {
    Swal.fire({ icon: 'error', title: 'กรุณาเข้าสู่ระบบใหม่', confirmButtonColor: '#0E3B5C' });
    return false;
  }

  const curriculumId = document.getElementById('curriculumFormId').value;
  const errorEl = document.getElementById('curriculumFormError');
  const submitBtn = document.getElementById('curriculumFormSubmitBtn');
  errorEl.classList.add('hidden');

  const fileInput = document.getElementById('curriculumFormFile');
  const selectedFile = fileInput.files[0];
  if (!curriculumId && !selectedFile) {
    errorEl.textContent = 'กรุณาแนบไฟล์ PDF หลักสูตร';
    errorEl.classList.remove('hidden');
    return false;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังเตรียมข้อมูล...';

  // ไฟล์ใหญ่ (10-20MB) ต้องอัปโหลดแบบแบ่งชิ้น (Chunked) ก่อน ถึงจะได้ File_URL มาใช้บันทึก
  // ถ้าไม่ได้เลือกไฟล์ใหม่ (แก้ไขแต่ข้อมูลอื่น) จะข้ามขั้นตอนนี้ไปเลย
  const uploadPromise = selectedFile
    ? uploadFileChunked_(session.token, selectedFile, percent => {
        submitBtn.textContent = `กำลังอัปโหลดไฟล์... ${percent}%`;
      })
    : Promise.resolve(null);

  uploadPromise.then(uploadResult => {
    submitBtn.textContent = 'กำลังบันทึก...';

    const schoolWrap = document.getElementById('curriculumFormSchoolWrap');
    const payload = {
      token: session.token,
      Curriculum_ID: curriculumId || undefined,
      School_ID: !schoolWrap.classList.contains('hidden') ? document.getElementById('curriculumFormSchool').value : undefined,
      Academic_Year: document.getElementById('curriculumFormYear').value,
      Education_Level: document.getElementById('curriculumFormLevel').value,
      Curriculum_Name: document.getElementById('curriculumFormName').value,
    };

    if (uploadResult) {
      payload.File_URL = uploadResult.url;
      payload.File_Name = selectedFile.name;
    }

    const action = curriculumId ? 'updateSchoolCurriculum' : 'createSchoolCurriculum';
    return callProxy(action, payload);
  }).then(() => {
    closeModal('curriculumFormModal');
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1200, showConfirmButton: false });
    loadSchoolCurriculums();
  }).catch(err => {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }).finally(() => {
    submitBtn.disabled = false;
    submitBtn.textContent = 'บันทึก';
  });

  return false;
}

function handleDeleteCurriculum(curriculumId) {
  const session = getSession();
  if (!session || !session.token) return;

  Swal.fire({
    icon: 'warning',
    title: 'ยืนยันการลบหลักสูตรนี้?',
    text: 'ไม่สามารถกู้คืนได้หลังลบแล้ว',
    showCancelButton: true,
    confirmButtonText: 'ลบเลย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626',
  }).then(result => {
    if (!result.isConfirmed) return;
    callProxy('deleteSchoolCurriculum', { token: session.token, Curriculum_ID: curriculumId })
      .then(() => {
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false });
        // ลบออกจากหน้าจอทันที (Optimistic) ด้วยเหตุผลเดียวกับ curriculumLibrary.js
        curriculumCache = curriculumCache.filter(c => c.Curriculum_ID !== curriculumId);
        renderCurriculumContent_();
      })
      .catch(err => Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err.message }));
  });
}

function onAuthStateChanged() {
  loadSchoolCurriculums();
}

document.addEventListener('DOMContentLoaded', () => {
  loadSchoolCurriculums();
});
