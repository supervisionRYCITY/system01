// ---------------------------------------------------------------
// home.js — ดึงข้อมูลจริงจาก Google Apps Script API (Code.gs)
// Endpoint: GET {API_BASE_URL}?action=news|documents|dashboard
// ---------------------------------------------------------------

// เรียก GAS Web App ผ่าน JSONP แทน fetch() ตรงๆ เพราะ fetch() ติดปัญหา CORS
// "Failed to fetch" กับ GAS Web App เวลาเรียกข้ามโดเมน (เช่นจาก Vercel)
// JSONP ไม่ผ่าน fetch() แต่โหลดผ่าน <script> tag แทน จึงไม่ถูก CORS บล็อก
let jsonpCounter = 0;
function jsonpRequest(url) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_cb_' + (jsonpCounter++) + '_' + Date.now();
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
      if (!settled) reject(new Error('เชื่อมต่อ API ไม่สำเร็จ (ตรวจสอบ API_BASE_URL ใน js/config.js)'));
    };

    const sep = url.includes('?') ? '&' : '?';
    script.src = url + sep + 'callback=' + callbackName;
    document.body.appendChild(script);
  });
}

function fetchAction(action) {
  return jsonpRequest(`${API_BASE_URL}?action=${action}`)
    .then(json => {
      if (json.status !== 'ok') throw new Error(json.message || 'เกิดข้อผิดพลาด');
      return json.data;
    });
}

function formatThaiDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isTrue(val) {
  return val === true || val === 'TRUE';
}

// ---------------- ข่าวประชาสัมพันธ์ ----------------
let newsCache = [];

function loadNews() {
  const row = document.getElementById('newsRow');
  fetchAction('news')
    .then(data => {
      newsCache = data;
      if (!data.length) {
        row.innerHTML = `<p class="text-sm text-ink/50">ยังไม่มีข่าวประชาสัมพันธ์</p>`;
        return;
      }

      
             row.innerHTML = data.map(n => `
        <article class="scroll-item shrink-0 w-[134px] doc-card rounded-xl overflow-hidden">
          <div class="relative h-[77px] bg-line">
            <img src="${n.Cover_Image_URL}" alt="" class="w-full h-full object-cover" onerror="this.style.display='none'">
            ${isTrue(n.Is_Pinned) ? '<span class="absolute top-1 right-1 bg-gold text-white text-[10px] px-1.5 py-0.5 rounded-full"><i class="fa-solid fa-thumbtack"></i></span>' : ''}
          </div>
          <div class="p-2.5">
            <div class="flex items-start justify-between mb-1 gap-1">
              <span class="inline-block text-[11px] font-medium px-1.5 py-0.5 rounded bg-teal-light text-teal truncate">${n.Category}</span>
              <div data-require-role="Admin" class="hidden flex items-center gap-1 shrink-0">
                <button onclick="editNews('${n.News_ID}')" class="text-ink/40 hover:text-navy" aria-label="แก้ไข"><i class="fa-solid fa-pen text-[11px]"></i></button>
                <button onclick="deleteNews('${n.News_ID}')" class="text-ink/40 hover:text-red-600" aria-label="ลบ"><i class="fa-solid fa-trash text-[11px]"></i></button>
              </div>
            </div>
            <h3 class="text-xs font-semibold text-ink leading-snug line-clamp-2 mb-1">${n.Title}</h3>
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-ink/40">${formatThaiDate(n.Publish_Date)}</span>
              <button onclick="showNewsDetail('${n.News_ID}')" class="text-[11px] font-medium text-navy hover:text-gold">
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </article>
      `).join('');
      
      if (typeof applyRoleVisibility === 'function') {
        applyRoleVisibility(getSession()?.user?.Role || null);
      }
    })
    .catch(err => {
      row.innerHTML = `<p class="text-sm text-red-600">โหลดข่าวไม่สำเร็จ: ${err.message}</p>`;
    });
}

function showNewsDetail(id) {
  const n = newsCache.find(x => x.News_ID === id);
  if (!n) return;
  document.getElementById('newsModalCategory').textContent = n.Category;
  document.getElementById('newsModalTitle').textContent = n.Title;
  document.getElementById('newsModalDate').textContent = formatThaiDate(n.Publish_Date);
  document.getElementById('newsModalContent').textContent = n.Content;

  const shortDescEl = document.getElementById('newsModalShortDesc');
  if (n.Short_Desc) {
    shortDescEl.textContent = n.Short_Desc;
    shortDescEl.classList.remove('hidden');
  } else {
    shortDescEl.classList.add('hidden');
  }

  // Gallery รูปภาพ — อ่านจากคอลัมน์ Image_URLs (JSON array) ถ้าไม่มีให้ fallback ไปใช้ Cover_Image_URL ตัวเดียว (ข่าวเก่าก่อนอัปเดตฟีเจอร์นี้)
  let images = [];
  try {
    images = n.Image_URLs ? JSON.parse(n.Image_URLs) : [];
  } catch (e) {
    images = [];
  }
  if (!images.length && n.Cover_Image_URL) images = [n.Cover_Image_URL];

  const mainWrap = document.getElementById('newsModalMainImageWrap');
  const mainImg = document.getElementById('newsModalMainImage');
  const thumbsEl = document.getElementById('newsModalThumbs');

  if (images.length) {
    mainImg.src = images[0];
    mainWrap.classList.remove('hidden');

    if (images.length > 1) {
      thumbsEl.innerHTML = images.map((url, i) => `
        <img src="${url}" onclick="selectNewsModalImage('${url}', this)"
             class="w-16 h-16 object-cover rounded-lg border-2 ${i === 0 ? 'border-gold' : 'border-line'} cursor-pointer shrink-0">
      `).join('');
      thumbsEl.classList.remove('hidden');
    } else {
      thumbsEl.innerHTML = '';
      thumbsEl.classList.add('hidden');
    }
  } else {
    mainWrap.classList.add('hidden');
    thumbsEl.innerHTML = '';
    thumbsEl.classList.add('hidden');
  }

  openModal('newsModal');
}

// สลับรูปหลักเมื่อกดรูปย่อ พร้อมไฮไลต์กรอบสีทองให้รูปที่เลือกอยู่
function selectNewsModalImage(url, thumbEl) {
  document.getElementById('newsModalMainImage').src = url;
  document.querySelectorAll('#newsModalThumbs img').forEach(el => {
    el.classList.remove('border-gold');
    el.classList.add('border-line');
  });
  thumbEl.classList.remove('border-line');
  thumbEl.classList.add('border-gold');
}


// ---------------- คู่มือและเอกสารวิชาการ (ชั้นหนังสือ) ----------------
function loadDocuments() {
  const row = document.getElementById('docsRow');
  fetchAction('documents')
    .then(data => {
      if (!data.length) {
        row.innerHTML = `<p class="text-sm text-ink/50">ยังไม่มีเอกสาร</p>`;
        return;
      }
      row.innerHTML = data.map(d => `
        <article class="scroll-item shrink-0 w-40 doc-card rounded-xl overflow-hidden">
          <div class="relative h-52 bg-line">
            <img src="${d.Cover_Image_URL}" alt="" class="w-full h-full object-cover" onerror="this.style.display='none'">
            <span class="absolute bottom-2 left-2 bg-navy/90 text-white text-[10px] px-2 py-0.5 rounded">
              <i class="fa-solid fa-file-lines mr-1"></i>${d.File_Type}
            </span>
          </div>
          <div class="p-3">
            <p class="text-xs font-medium text-ink leading-snug line-clamp-2 mb-2 min-h-[2rem]">${d.Title}</p>
            <button onclick="downloadDocument('${d.File_URL}')" class="w-full text-xs font-medium text-navy hover:text-gold flex items-center justify-center gap-1 py-1.5 rounded border border-line hover:border-gold">
              <i class="fa-solid fa-download text-[10px]"></i> ดาวน์โหลด
            </button>
          </div>
        </article>
      `).join('');
    })
    .catch(err => {
      row.innerHTML = `<p class="text-sm text-red-600">โหลดเอกสารไม่สำเร็จ: ${err.message}</p>`;
    });
}

function downloadDocument(fileUrl) {
  if (!fileUrl) {
    Swal.fire({ icon: 'error', title: 'ไม่พบไฟล์', confirmButtonColor: '#0E3B5C' });
    return;
  }
  window.open(fileUrl, '_blank');
}

// ---------------- Dashboard สถานศึกษาในสังกัด ----------------
function loadDashboard() {
  const summaryEl = document.getElementById('statsSummary');
  const bySchoolEl = document.getElementById('statsBySchool');

  fetchAction('dashboard')
    .then(schools => {
      const totals = schools.reduce((acc, s) => ({
        admin: acc.admin + Number(s.Admin_Count || 0),
        teacher: acc.teacher + Number(s.Teacher_Count || 0),
        student: acc.student + Number(s.Student_Count || 0),
      }), { admin: 0, teacher: 0, student: 0 });

      const summaryCards = [
        { label: 'ผู้บริหารสถานศึกษา', value: totals.admin, icon: 'fa-user-tie', accent: 'navy' },
        { label: 'ครูและบุคลากรทางการศึกษา', value: totals.teacher, icon: 'fa-chalkboard-user', accent: 'teal' },
        { label: 'นักเรียน', value: totals.student, icon: 'fa-child-reaching', accent: 'gold' },
      ];

      summaryEl.innerHTML = summaryCards.map(c => `
        <div class="doc-card rounded-xl p-5 flex items-center gap-4">
          <div class="w-12 h-12 rounded-lg bg-${c.accent === 'gold' ? 'gold-pale' : c.accent + '-light'} flex items-center justify-center shrink-0">
            <i class="fa-solid ${c.icon} text-${c.accent} text-lg"></i>
          </div>
          <div>
            <p class="text-2xl font-semibold text-ink leading-tight">${c.value.toLocaleString('th-TH')}</p>
            <p class="text-xs text-ink/60">${c.label}</p>
          </div>
        </div>
      `).join('');

      bySchoolEl.innerHTML = schools.map(s => `
        <div class="doc-card rounded-xl p-4">
          <p class="text-sm font-semibold text-navy mb-0.5">${s.School_Name}</p>
          <p class="text-xs text-ink/50 mb-3">${s.School_Type}</p>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="text-base font-semibold text-ink">${s.Admin_Count}</p>
              <p class="text-[11px] text-ink/50">ผู้บริหาร</p>
            </div>
            <div>
              <p class="text-base font-semibold text-ink">${s.Teacher_Count}</p>
              <p class="text-[11px] text-ink/50">ครู/บุคลากร</p>
            </div>
            <div>
              <p class="text-base font-semibold text-ink">${s.Student_Count}</p>
              <p class="text-[11px] text-ink/50">นักเรียน</p>
            </div>
          </div>
        </div>
      `).join('');
    })
    .catch(err => {
      summaryEl.innerHTML = `<p class="text-sm text-red-600 col-span-3">โหลด Dashboard ไม่สำเร็จ: ${err.message}</p>`;
    });
}

document.addEventListener('DOMContentLoaded', () => {
  loadNews();
  loadDocuments();
  loadDashboard();
});
