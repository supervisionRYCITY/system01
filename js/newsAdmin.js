// ---------------------------------------------------------------
// newsAdmin.js — จัดการข่าวประชาสัมพันธ์ (Admin เท่านั้น)
// เรียกผ่าน Vercel Proxy (callProxy ใน auth.js) ด้วย action:
// createNews | updateNews | deleteNews
// ---------------------------------------------------------------

const NEWS_FORM_MAX_IMAGES = 5;
let newsFormExistingImages = [];  // URL รูปเดิมที่ยังเก็บไว้ (ใช้ตอนแก้ไขข่าว)
let newsFormNewImages = [];       // รูปใหม่ที่เพิ่งเลือก [{ base64, filename }]

// แปลงไฟล์รูปเป็น Base64 พร้อมย่อขนาดภาพก่อน (กว้างสุด 1200px)
// เพื่อไม่ให้ Payload ใหญ่เกินไปตอนส่งผ่าน Vercel Proxy ไปหา GAS
function resizeAndEncodeImage_(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1200;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.split(',')[1]); // ตัด prefix "data:image/jpeg;base64," ออก
      };
      img.onerror = () => reject(new Error('ไฟล์รูปเสียหาย อ่านไม่ได้'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const imageInput = document.getElementById('newsFormImage');
  if (!imageInput) return;
  imageInput.addEventListener('change', async () => {
    const files = Array.from(imageInput.files || []);
    imageInput.value = ''; // เคลียร์ input ทุกครั้ง เพื่อให้เลือกไฟล์ซ้ำ/เพิ่มทีหลังได้

    const remainingSlots = NEWS_FORM_MAX_IMAGES - (newsFormExistingImages.length + newsFormNewImages.length);
    if (remainingSlots <= 0) {
      Swal.fire({ icon: 'warning', title: 'ครบ 5 รูปแล้ว', text: 'ลบรูปเดิมออกก่อนถึงจะเพิ่มรูปใหม่ได้', confirmButtonColor: '#0E3B5C' });
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      Swal.fire({ icon: 'info', title: 'เพิ่มรูปได้สูงสุด 5 รูป', text: `เลือกไว้แค่ ${remainingSlots} รูปแรก`, confirmButtonColor: '#0E3B5C' });
    }

    for (const file of filesToAdd) {
      if (file.size > 8 * 1024 * 1024) {
        Swal.fire({ icon: 'error', title: 'ไฟล์ใหญ่เกินไป', text: `"${file.name}" เกิน 8MB ข้ามไฟล์นี้ไป`, confirmButtonColor: '#0E3B5C' });
        continue;
      }
      const base64 = await resizeAndEncodeImage_(file);
      newsFormNewImages.push({ base64, filename: file.name });
    }

    renderNewsFormImageGrid_();
  });
});

// วาดตารางพรีวิวรูปทั้งหมด (ทั้งรูปเดิมที่เก็บไว้ + รูปใหม่ที่เพิ่งเลือก) พร้อมปุ่มลบทีละรูป
function renderNewsFormImageGrid_() {
  const grid = document.getElementById('newsFormImagePreviewGrid');
  const existingThumbs = newsFormExistingImages.map((url, i) => `
    <div class="relative">
      <img src="${url}" class="w-full h-20 object-cover rounded-lg border border-line">
      <button type="button" onclick="removeNewsFormImage('existing', ${i})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center" aria-label="ลบรูป">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `);
  const newThumbs = newsFormNewImages.map((img, i) => `
    <div class="relative">
      <img src="data:image/jpeg;base64,${img.base64}" class="w-full h-20 object-cover rounded-lg border border-line">
      <button type="button" onclick="removeNewsFormImage('new', ${i})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center" aria-label="ลบรูป">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `);
  grid.innerHTML = existingThumbs.concat(newThumbs).join('');

  const imageInput = document.getElementById('newsFormImage');
  const totalCount = newsFormExistingImages.length + newsFormNewImages.length;
  imageInput.disabled = totalCount >= NEWS_FORM_MAX_IMAGES;
}

// ลบรูปออกจากพรีวิว (type: 'existing' = รูปเดิมบน Drive, 'new' = รูปที่เพิ่งเลือกแต่ยังไม่อัปโหลด)
function removeNewsFormImage(type, index) {
  if (type === 'existing') newsFormExistingImages.splice(index, 1);
  else newsFormNewImages.splice(index, 1);
  renderNewsFormImageGrid_();
}

// เปิดฟอร์ม "เพิ่มข่าวใหม่" (ฟอร์มว่าง)
function openNewsForm() {
  document.getElementById('newsFormTitle').textContent = 'เพิ่มข่าวใหม่';
  document.getElementById('newsForm').reset();
  document.getElementById('newsFormId').value = '';
  document.getElementById('newsFormError').classList.add('hidden');
  document.getElementById('newsFormCategoryOtherWrap').classList.add('hidden');
  document.getElementById('newsFormCategoryOther').value = '';

  newsFormExistingImages = [];
  newsFormNewImages = [];
  renderNewsFormImageGrid_();

  openModal('newsFormModal');
}

// โชว์/ซ่อนช่องกรอกหมวดหมู่เอง ตอนเลือก "อื่นๆ" ในดรอปดาวน์
function toggleCategoryOtherInput() {
  const select = document.getElementById('newsFormCategory');
  const wrap = document.getElementById('newsFormCategoryOtherWrap');
  const otherInput = document.getElementById('newsFormCategoryOther');
  const isOther = select.value === 'อื่นๆ';
  wrap.classList.toggle('hidden', !isOther);
  otherInput.required = isOther;
}

// เปิดฟอร์ม "แก้ไขข่าว" พร้อมข้อมูลเดิม (ดึงจาก newsCache ที่ home.js เก็บไว้)
function editNews(newsId) {
  const n = newsCache.find(x => x.News_ID === newsId);
  if (!n) return;

  document.getElementById('newsFormTitle').textContent = 'แก้ไขข่าว';
  document.getElementById('newsFormId').value = n.News_ID;
  document.getElementById('newsFormTitleInput').value = n.Title || '';
  document.getElementById('newsFormShortDesc').value = n.Short_Desc || '';
  document.getElementById('newsFormContent').value = n.Content || '';
  document.getElementById('newsFormPublishDate').value = n.Publish_Date ? new Date(n.Publish_Date).toISOString().slice(0, 10) : '';
  document.getElementById('newsFormPinned').checked = isTrue(n.Is_Pinned);
  document.getElementById('newsFormError').classList.add('hidden');

  // ถ้าหมวดหมู่เดิมไม่อยู่ในตัวเลือกที่มี (เช่นข้อมูลเก่าก่อนปรับเป็น Dropdown) ให้ตกไปที่ "อื่นๆ" แล้วเติมค่าเดิมในช่องระบุเอง
  const categorySelect = document.getElementById('newsFormCategory');
  const knownCategories = Array.from(categorySelect.options).map(o => o.value);
  if (knownCategories.includes(n.Category)) {
    categorySelect.value = n.Category;
    document.getElementById('newsFormCategoryOtherWrap').classList.add('hidden');
    document.getElementById('newsFormCategoryOther').value = '';
  } else {
    categorySelect.value = 'อื่นๆ';
    document.getElementById('newsFormCategoryOtherWrap').classList.remove('hidden');
    document.getElementById('newsFormCategoryOther').value = n.Category || '';
  }

  // โหลดรูปเดิมจากคอลัมน์ Image_URLs (JSON array) ถ้าไม่มีให้ fallback ไปใช้ Cover_Image_URL ตัวเดียว (ข่าวเก่า)
  try {
    newsFormExistingImages = n.Image_URLs ? JSON.parse(n.Image_URLs) : [];
  } catch (e) {
    newsFormExistingImages = [];
  }
  if (!newsFormExistingImages.length && n.Cover_Image_URL) newsFormExistingImages = [n.Cover_Image_URL];
  newsFormNewImages = [];
  renderNewsFormImageGrid_();

  openModal('newsFormModal');
}

function handleNewsFormSubmit(event) {
  event.preventDefault();
  const session = getSession();
  if (!session || !session.token) {
    Swal.fire({ icon: 'error', title: 'กรุณาเข้าสู่ระบบใหม่', confirmButtonColor: '#0E3B5C' });
    return false;
  }

  if (newsFormExistingImages.length + newsFormNewImages.length === 0) {
    Swal.fire({ icon: 'warning', title: 'กรุณาแนบรูปอย่างน้อย 1 รูป', confirmButtonColor: '#0E3B5C' });
    return false;
  }

  const newsId = document.getElementById('newsFormId').value;
  const errorEl = document.getElementById('newsFormError');
  const submitBtn = document.getElementById('newsFormSubmitBtn');
  errorEl.classList.add('hidden');

  const categorySelectValue = document.getElementById('newsFormCategory').value;
  const category = categorySelectValue === 'อื่นๆ'
    ? document.getElementById('newsFormCategoryOther').value.trim()
    : categorySelectValue;

  const payload = {
    token: session.token,
    News_ID: newsId || undefined,
    Title: document.getElementById('newsFormTitleInput').value.trim(),
    Short_Desc: document.getElementById('newsFormShortDesc').value.trim(),
    Content: document.getElementById('newsFormContent').value.trim(),
    Category: category,
    Publish_Date: document.getElementById('newsFormPublishDate').value,
    Is_Pinned: document.getElementById('newsFormPinned').checked,
    Status: 'Published',
    existingImageUrls: newsFormExistingImages,
    newImages: newsFormNewImages,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังบันทึก...';

  callProxy(newsId ? 'updateNews' : 'createNews', payload)
    .then(() => {
      closeModal('newsFormModal');
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1200, showConfirmButton: false });
      loadNews();
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

function deleteNews(newsId) {
  const session = getSession();
  if (!session || !session.token) {
    Swal.fire({ icon: 'error', title: 'กรุณาเข้าสู่ระบบใหม่', confirmButtonColor: '#0E3B5C' });
    return;
  }

  Swal.fire({
    icon: 'warning',
    title: 'ยืนยันการลบข่าว',
    text: 'ลบแล้วจะไม่สามารถกู้คืนได้',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#DC2626',
  }).then(result => {
    if (!result.isConfirmed) return;
    callProxy('deleteNews', { token: session.token, News_ID: newsId })
      .then(() => {
        Swal.fire({ icon: 'success', title: 'ลบข่าวแล้ว', timer: 1200, showConfirmButton: false });
        loadNews();
      })
      .catch(err => {
        Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err.message, confirmButtonColor: '#0E3B5C' });
      });
  });
}
