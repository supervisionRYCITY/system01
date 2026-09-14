// ---------------------------------------------------------------
// curriculumLibrary.js — หน้า "เอกสารวิชาการด้านหลักสูตร" (curriculum-library.html)
// อ่านข้อมูลผ่าน Vercel Edge-Cached Proxy (action=documents) แล้วกรองเฉพาะ
// Source_System = 'หลักสูตร' ฝั่ง Client — ใช้ Cache เดียวกับหน้า Home จึงเร็วมาก
// การจัดการ (เพิ่ม/แก้/ลบ) ผ่าน Vercel POST Proxy (Admin เท่านั้น)
// ---------------------------------------------------------------

const CURRICULUM_SOURCE_SYSTEM = 'หลักสูตร';
let libraryCache = [];

function loadLibraryDocuments() {
  const container = document.getElementById('libraryRow');
  fetchApiGet_(`${GET_PROXY_URL}?action=documents`)
    .then(json => {
      if (json.status !== 'ok') throw new Error(json.message || 'เกิดข้อผิดพลาด');
      libraryCache = json.data.filter(d => d.Source_System === CURRICULUM_SOURCE_SYSTEM);
      renderLibraryRow_();
    })
    .catch(err => {
      container.innerHTML = `<p class="text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: ${err.message}</p>`;
    });
}

function isCurrentUserAdmin_() {
  const session = getSession();
  return !!(session && session.user && session.user.Role === 'Admin');
}

function renderLibraryRow_() {
  const container = document.getElementById('libraryRow');
  if (!libraryCache.length) {
    container.innerHTML = `<p class="text-sm text-ink/50">ยังไม่มีเอกสาร</p>`;
    return;
  }

  const admin = isCurrentUserAdmin_();

  container.innerHTML = libraryCache.map(d => `
    <div class="doc-card rounded-xl overflow-hidden shrink-0 w-48 relative group">
      <a href="${d.File_URL}" target="_blank" rel="noopener" class="block">
        <div class="h-56 bg-paper flex items-center justify-center overflow-hidden">
          ${d.Cover_Image_URL
            ? `<img src="${d.Cover_Image_URL}" alt="${d.Title}" class="w-full h-full object-cover">`
            : `<i class="fa-solid fa-file-pdf text-5xl text-ink/20"></i>`}
        </div>
        <div class="p-3">
          ${d.Category ? `<span class="inline-block text-[11px] font-medium text-teal bg-teal-light px-2 py-0.5 rounded-full mb-1">${d.Category}</span>` : ''}
          <p class="text-sm font-medium text-ink leading-snug line-clamp-2">${d.Title}</p>
        </div>
      </a>
      ${admin ? `
        <div class="absolute top-2 right-2 hidden group-hover:flex gap-1">
          <button onclick="event.preventDefault(); openDocumentForm('${d.Document_ID}')" class="w-7 h-7 rounded-full bg-white shadow flex items-center justify-center text-navy hover:bg-navy hover:text-white">
            <i class="fa-solid fa-pen text-xs"></i>
          </button>
          <button onclick="event.preventDefault(); handleDeleteDocument('${d.Document_ID}')" class="w-7 h-7 rounded-full bg-white shadow flex items-center justify-center text-red-600 hover:bg-red-600 hover:text-white">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// ---------------- Modal: Create / Edit ----------------
function openDocumentForm(documentId) {
  const doc = documentId ? libraryCache.find(d => d.Document_ID === documentId) : null;

  document.getElementById('documentFormId').value = doc ? doc.Document_ID : '';
  document.getElementById('documentFormTitle').textContent = doc ? 'แก้ไขเอกสาร' : 'เพิ่มเอกสารใหม่';
  document.getElementById('documentFormTitleInput').value = doc ? doc.Title : '';
  document.getElementById('documentFormCategory').value = doc ? (doc.Category || '') : '';
  document.getElementById('documentFormStatus').value = doc ? doc.Status : 'Published';
  document.getElementById('documentFormFeatured').checked = !!(doc && (doc.Is_Featured === true || doc.Is_Featured === 'TRUE'));
  document.getElementById('documentFormFile').value = '';

  const existingFileEl = document.getElementById('documentFormExistingFile');
  if (doc && doc.File_URL) {
    existingFileEl.textContent = 'ไฟล์เดิม: ' + (doc.File_Type || 'PDF') + ' (ไม่เลือกไฟล์ใหม่ = ใช้ไฟล์เดิมต่อ)';
    existingFileEl.classList.remove('hidden');
  } else {
    existingFileEl.classList.add('hidden');
  }

  document.getElementById('documentFormError').classList.add('hidden');
  openModal('documentFormModal');
}
function handleDocumentFormSubmit(event) {
  event.preventDefault();
  const session = getSession();
  if (!session || !session.token) {
    Swal.fire({ icon: 'error', title: 'กรุณาเข้าสู่ระบบใหม่', confirmButtonColor: '#0E3B5C' });
    return false;
  }

  const documentId = document.getElementById('documentFormId').value;
  const errorEl = document.getElementById('documentFormError');
  const submitBtn = document.getElementById('documentFormSubmitBtn');
  errorEl.classList.add('hidden');

  const fileInput = document.getElementById('documentFormFile');
  const selectedFile = fileInput.files[0];

  if (!documentId && !selectedFile) {
    errorEl.textContent = 'กรุณาแนบไฟล์ PDF';
    errorEl.classList.remove('hidden');
    return false;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังเตรียมข้อมูล...';

  // ไฟล์ PDF อัปโหลดผ่าน Chunked Upload — ภาพหน้าปกดึงจาก Thumbnail ของไฟล์เดียวกันอัตโนมัติ
  // (thumbnailUrl ที่ finalizeFileUpload_ คืนมา) ไม่ต้องอัปโหลดรูปแยกอีกต่อไป
  const uploadPromise = selectedFile
    ? uploadFileChunked_(session.token, selectedFile, percent => {
        submitBtn.textContent = `กำลังอัปโหลดไฟล์... ${percent}%`;
      })
    : Promise.resolve(null);

  uploadPromise.then(uploadResult => {
    submitBtn.textContent = 'กำลังบันทึก...';

    const payload = {
      token: session.token,
      Document_ID: documentId || undefined,
      Title: document.getElementById('documentFormTitleInput').value,
      Category: document.getElementById('documentFormCategory').value,
      Source_System: CURRICULUM_SOURCE_SYSTEM,
      Status: document.getElementById('documentFormStatus').value,
      Is_Featured: document.getElementById('documentFormFeatured').checked,
    };

    if (uploadResult) {
      payload.File_URL = uploadResult.url;
      payload.Cover_Image_URL = uploadResult.thumbnailUrl;
      payload.File_Type = 'PDF';
    }

    const action = documentId ? 'updateDocument' : 'createDocument';
    return callProxy(action, payload);
  }).then(() => {
    closeModal('documentFormModal');
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1200, showConfirmButton: false });
    loadLibraryDocuments();
  }).catch(err => {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }).finally(() => {
    submitBtn.disabled = false;
    submitBtn.textContent = 'บันทึก';
  });

  return false;
}

function handleDeleteDocument(documentId) {
  const session = getSession();
  if (!session || !session.token) return;

  Swal.fire({
    icon: 'warning',
    title: 'ยืนยันการลบเอกสาร?',
    text: 'ไม่สามารถกู้คืนได้หลังลบแล้ว',
    showCancelButton: true,
    confirmButtonText: 'ลบเลย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626',
  }).then(result => {
    if (!result.isConfirmed) return;
    callProxy('deleteDocument', { token: session.token, Document_ID: documentId })
      .then(() => {
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false });
        // ลบออกจากหน้าจอทันที (Optimistic) — ไม่เรียก loadLibraryDocuments() ซ้ำตรงนี้
        // เพราะอาจไปโดน Cache ของ Vercel Edge ที่ยังไม่ทันอัปเดต (สูงสุด ~20 วิ) แล้วข้อมูล
        // เก่าจะทับของที่เพิ่งลบถูกต้องไปแล้วกลับมาแสดงซ้ำอีกรอบ
        libraryCache = libraryCache.filter(d => d.Document_ID !== documentId);
        renderLibraryRow_();
      })
      .catch(err => Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err.message }));
  });
}

function onAuthStateChanged() {
  if (libraryCache.length) renderLibraryRow_();
}

document.addEventListener('DOMContentLoaded', () => {
  loadLibraryDocuments();
});
