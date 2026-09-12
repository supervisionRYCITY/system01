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
        <article class="scroll-item shrink-0 w-72 doc-card rounded-xl overflow-hidden">
          <div class="relative h-36 bg-line">
            <img src="${n.Cover_Image_URL}" alt="" class="w-full h-full object-cover" onerror="this.style.display='none'">
            ${isTrue(n.Is_Pinned) ? '<span class="absolute top-2 right-2 bg-gold text-white text-[11px] px-2 py-0.5 rounded-full"><i class="fa-solid fa-thumbtack mr-1"></i>ปักหมุด</span>' : ''}
          </div>
          <div class="p-4">
            <span class="inline-block text-xs font-medium px-2 py-0.5 rounded bg-teal-light text-teal mb-2">${n.Category}</span>
            <h3 class="text-sm font-semibold text-ink leading-snug line-clamp-2 mb-1">${n.Title}</h3>
            <p class="text-xs text-ink/60 line-clamp-2 mb-3">${n.Short_Desc}</p>
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-ink/40">${formatThaiDate(n.Publish_Date)}</span>
              <button onclick="showNewsDetail('${n.News_ID}')" class="text-xs font-medium text-navy hover:text-gold">
                อ่านต่อ <i class="fa-solid fa-arrow-right text-[10px] ml-0.5"></i>
              </button>
            </div>
          </div>
        </article>
      `).join('');
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
  openModal('newsModal');
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
