// ---------------------------------------------------------------
// newsAdmin.js — จัดการข่าวประชาสัมพันธ์ (Admin เท่านั้น)
// เรียกผ่าน Vercel Proxy (callProxy ใน auth.js) ด้วย action:
// createNews | updateNews | deleteNews
// ---------------------------------------------------------------

let newsFormImageBase64 = null;
let newsFormImageMimeType = null;
let newsFormImageFilename = null;

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
    const file = imageInput.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      Swal.fire({ icon: 'error', title: 'ไฟล์ใหญ่เกินไป', text: 'กรุณาเลือกไฟล์ไม่เกิน 8MB', confirmButtonColor: '#0E3B5C' });
      imageInput.value = '';
      return;
    }
    newsFormImageBase64 = await resizeAndEncodeImage_(file);
    newsFormImageMimeType = 'image/jpeg';
    newsFormImageFilename = file.name;

    const preview = document.getElementById('newsFormImagePreview');
    preview.src = 'data:image/jpeg;base64,' + newsFormImageBase64;
    preview.classList.remove('hidden');
  });
});

// เปิดฟอร์ม "เพิ่มข่าวใหม่" (ฟอร์มว่าง)
function openNewsForm() {
  document.getElementById('newsFormTitle').textContent = 'เพิ่มข่าวใหม่';
  document.getElementById('newsForm').reset();
  document.getElementById('newsFormId').value = '';
  document.getElementById('newsFormImagePreview').classList.add('hidden');
  document.getElementById('newsFormError').classList.add('hidden');
  newsFormImageBase64 = null;
  newsFormImageMimeType = null;
  newsFormImageFilename = null;
  openModal('newsFormModal');
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
  document.getElementById('newsFormCategory').value = n.Category || '';
  document.getElementById('newsFormPublishDate').value = n.Publish_Date ? new Date(n.Publish_Date).toISOString().slice(0, 10) : '';
  document.getElementById('newsFormPinned').checked = isTrue(n.Is_Pinned);
  document.getElementById('newsFormError').classList.add('hidden');

  const preview = document.getElementById('newsFormImagePreview');
  if (n.Cover_Image_URL) {
    preview.src = n.Cover_Image_URL;
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
  }
  newsFormImageBase64 = null;
  newsFormImageMimeType = null;
  newsFormImageFilename = null;

  openModal('newsFormModal');
}

function handleNewsFormSubmit(event) {
  event.preventDefault();
  const session = getSession();
  if (!session || !session.token) {
    Swal.fire({ icon: 'error', title: 'กรุณาเข้าสู่ระบบใหม่', confirmButtonColor: '#0E3B5C' });
    return false;
  }

  const newsId = document.getElementById('newsFormId').value;
  const errorEl = document.getElementById('newsFormError');
  const submitBtn = document.getElementById('newsFormSubmitBtn');
  errorEl.classList.add('hidden');

  const payload = {
    token: session.token,
    News_ID: newsId || undefined,
    Title: document.getElementById('newsFormTitleInput').value.trim(),
    Short_Desc: document.getElementById('newsFormShortDesc').value.trim(),
    Content: document.getElementById('newsFormContent').value.trim(),
    Category: document.getElementById('newsFormCategory').value.trim(),
    Publish_Date: document.getElementById('newsFormPublishDate').value,
    Is_Pinned: document.getElementById('newsFormPinned').checked,
    Status: 'Published',
  };

  if (newsFormImageBase64) {
    payload.imageBase64 = newsFormImageBase64;
    payload.imageMimeType = newsFormImageMimeType;
    payload.imageFilename = newsFormImageFilename;
  }

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
