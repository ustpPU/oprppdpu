/* OPR PPDPU v15 — aliran pantas, crop gambar dan PDF sepadan pratonton. */

function createImageState() {
  return {
    1: { dataUrl: "", existingRef: "", changed: false, sourceUrl: "" },
    2: { dataUrl: "", existingRef: "", changed: false, sourceUrl: "" },
    3: { dataUrl: "", existingRef: "", changed: false, sourceUrl: "" },
    4: { dataUrl: "", existingRef: "", changed: false, sourceUrl: "" }
  };
}

state.images = createImageState();

let cropperInstance = null;
let activeImageIndex = null;

function getApiUrl() {
  if (window.OPR_API_URL) return window.OPR_API_URL;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return `${window.location.origin}/api`;
  return GAS_WEB_APP_URL;
}

document.addEventListener("DOMContentLoaded", () => {
  fitPreview();
  window.addEventListener("resize", fitPreview);
  if (window.ResizeObserver) {
    new ResizeObserver(fitPreview).observe(document.getElementById("previewShell"));
  }
});

function fitPreview() {
  const shell = document.getElementById("previewShell");
  const area = document.getElementById("printArea");
  if (!shell || !area || area.classList.contains("pdf-capture")) return;
  area.style.transform = "none";
  const naturalWidth = area.offsetWidth || 794;
  const scale = Math.min(1, shell.clientWidth / naturalWidth);
  area.style.transform = `scale(${scale})`;
  shell.style.height = `${area.offsetHeight * scale}px`;
}

async function loadData(isRefresh = false) {
  const refreshSpinner = document.getElementById("refreshSpinner");
  const selectedOfficer = document.getElementById("namaPegawai")?.value || "";
  if (isRefresh && refreshSpinner) refreshSpinner.classList.add("fa-spin");
  try {
    const response = await fetch(`${getApiUrl()}?action=getInitialData`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message || "Data tidak dapat dimuatkan");
    state.pegawai = result.pegawai || [];
    state.respon = result.respon || [];
    renderStats();
    renderTable(state.respon);
    populatePegawaiDropdown();
    if (selectedOfficer && state.pegawai.some(person => person.nama === selectedOfficer)) {
      document.getElementById("namaPegawai").value = selectedOfficer;
    }
    renderPegawaiGrid();
  } catch (err) {
    console.error("Gagal tarik data:", err);
    const tbody = document.getElementById("oprTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-red-600">Data gagal dimuatkan. Sila tekan Refresh.</td></tr>`;
  } finally {
    if (isRefresh && refreshSpinner) refreshSpinner.classList.remove("fa-spin");
  }
}

function renderStats() {
  document.getElementById("statTotalOpr").innerText = state.respon.length;
  document.getElementById("statTotalPegawai").innerText = state.pegawai.length;
  const now = new Date();
  const countMonth = state.respon.filter(r => {
    const stamp = String(r.timestamp || "").replace(" ", "T");
    const date = new Date(stamp);
    return !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  document.getElementById("statMonthOpr").innerText = countMonth;
}

function processAndUploadImage(event, index) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Sila pilih fail gambar yang sah.");
    event.target.value = "";
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    alert("Gambar terlalu besar. Had maksimum ialah 15 MB.");
    event.target.value = "";
    return;
  }
  const imageState = state.images[index];
  if (imageState.sourceUrl && imageState.sourceUrl.startsWith("blob:")) URL.revokeObjectURL(imageState.sourceUrl);
  imageState.sourceUrl = URL.createObjectURL(file);
  openImageEditor(index, imageState.sourceUrl);
}

function openImageEditor(index, sourceOverride = "") {
  const imageState = state.images[index];
  const source = sourceOverride || imageState.dataUrl || imageState.sourceUrl;
  if (!source) return;
  activeImageIndex = index;
  const modal = document.getElementById("imageEditorModal");
  const image = document.getElementById("cropperImage");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  image.src = source;
  if (cropperInstance) cropperInstance.destroy();
  cropperInstance = new Cropper(image, {
    aspectRatio: index === 1 ? 16 / 9 : 4 / 3,
    viewMode: 1,
    dragMode: "move",
    autoCropArea: 1,
    responsive: true,
    background: false,
    guides: true,
    center: true,
    movable: true,
    zoomable: true,
    scalable: false,
    rotatable: false,
    toggleDragModeOnDblclick: false
  });
}

function closeImageEditor() {
  const modal = document.getElementById("imageEditorModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  activeImageIndex = null;
}

function cropZoom(amount) {
  if (cropperInstance) cropperInstance.zoom(amount);
}

function cropReset() {
  if (cropperInstance) cropperInstance.reset();
}

function applyImageCrop() {
  if (!cropperInstance || !activeImageIndex) return;
  const index = activeImageIndex;
  const canvas = cropperInstance.getCroppedCanvas({
    width: index === 1 ? 1280 : 900,
    height: index === 1 ? 720 : 675,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    fillColor: "#ffffff"
  });
  const imageState = state.images[index];
  imageState.dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  imageState.changed = true;
  document.getElementById(`editImgBtn${index}`).classList.remove("hidden");
  closeImageEditor();
  updatePreview();
}

function updatePreview() {
  document.getElementById("prevTajuk").innerText = document.getElementById("tajukProgram").value || "";
  document.getElementById("prevTarikh").innerText = document.getElementById("tarikhPelaksanaan").value || "";
  document.getElementById("prevMasa").innerText = document.getElementById("masa").value || "";
  document.getElementById("prevSasaran").innerText = document.getElementById("sasaran").value || "";
  const pelibatan = document.getElementById("pelibatan").value;
  document.getElementById("prevPelibatan").innerText = pelibatan;
  document.getElementById("prevPelibatanBox").classList.toggle("hidden", !pelibatan);
  document.getElementById("prevObjektif").innerText = document.getElementById("objektif").value || "";
  document.getElementById("prevKekuatan").innerText = document.getElementById("kekuatan").value || "";
  document.getElementById("prevPenambahbaikan").innerText = document.getElementById("penambahbaikan").value || "";
  document.getElementById("prevNama").innerText = document.getElementById("namaPegawai").value || "";
  document.getElementById("prevJawatan").innerText = document.getElementById("jawatanPegawai").value || "";
  document.getElementById("prevTarikhLaporan").innerText = document.getElementById("tarikhLaporan").value || "";

  const hero = document.getElementById("prevImg1");
  const heroData = state.images[1].dataUrl;
  hero.src = heroData || "";
  hero.classList.toggle("hidden", !heroData);

  let hasGallery = false;
  for (let index = 2; index <= 4; index++) {
    const imageData = state.images[index].dataUrl;
    const box = document.getElementById(`boxImg${index}`);
    const image = document.getElementById(`prevImg${index}`);
    const caption = document.getElementById(`prevCap${index}`);
    image.src = imageData || "";
    box.classList.toggle("hidden", !imageData);
    caption.innerText = document.getElementById(`kapsyen${index}`).value || `Gambar ${index}`;
    if (imageData) hasGallery = true;
  }
  document.getElementById("prevGalleryBox").classList.toggle("hidden", !hasGallery);
  requestAnimationFrame(fitPreview);
}

function resetOprForm() {
  if (!confirm("Adakah anda pasti untuk mengosongkan borang?")) return;
  document.getElementById("oprForm").reset();
  document.getElementById("editRowId").value = "";
  document.getElementById("editIc").value = "";
  document.getElementById("editIc").required = false;
  document.getElementById("editAuthBox").classList.add("hidden");
  state.images = createImageState();
  for (let index = 1; index <= 4; index++) {
    document.getElementById(`fileImg${index}`).value = "";
    document.getElementById(`editImgBtn${index}`).classList.add("hidden");
  }
  document.getElementById("tarikhLaporan").value = new Date().toISOString().split("T")[0];
  document.getElementById("submitBtnText").innerText = "Simpan Laporan & Muat Turun PDF";
  updatePreview();
}

async function loadOprForEdit(summary) {
  switchTab("form");
  closeModal();
  const submitBtn = document.getElementById("submitBtn");
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Memuatkan laporan…</span>`;
  try {
    let data = summary;
    try {
      const response = await fetch(`${getApiUrl()}?action=getRecord&rowId=${encodeURIComponent(summary.id)}`, { cache: "no-store" });
      const result = await response.json();
      if (result.status === "success" && result.record) data = result.record;
    } catch (loadError) {
      console.warn("Menggunakan data ringkas kerana butiran penuh gagal dimuatkan.", loadError);
    }

    document.getElementById("editRowId").value = data.id || "";
    document.getElementById("namaPegawai").value = data.namaPegawai || "";
    document.getElementById("jawatanPegawai").value = data.jawatanPegawai || "";
    document.getElementById("tarikhLaporan").value = formatDateForInput(data.tarikhLaporan);
    document.getElementById("tajukProgram").value = data.tajukProgram || "";
    document.getElementById("tarikhPelaksanaan").value = data.tarikhPelaksanaan || "";
    document.getElementById("masa").value = data.masa || "";
    document.getElementById("sasaran").value = data.sasaran || "";
    document.getElementById("pelibatan").value = data.pelibatan || "";
    document.getElementById("objektif").value = data.objektif || "";
    document.getElementById("kekuatan").value = data.kekuatan || "";
    document.getElementById("penambahbaikan").value = data.penambahbaikan || "";
    for (let index = 2; index <= 4; index++) {
      document.getElementById(`kapsyen${index}`).value = data[`kapsyen${index}`] || "";
    }

    state.images = createImageState();
    for (let index = 1; index <= 4; index++) {
      const imageData = data[`gambar${index}`] || "";
      state.images[index] = {
        dataUrl: imageData,
        existingRef: data[`gambarRef${index}`] || "",
        changed: false,
        sourceUrl: ""
      };
      document.getElementById(`fileImg${index}`).value = "";
      document.getElementById(`editImgBtn${index}`).classList.toggle("hidden", !imageData);
    }

    document.getElementById("editAuthBox").classList.remove("hidden");
    document.getElementById("editIc").required = true;
    document.getElementById("editIc").value = "";
    updatePreview();
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
    document.getElementById("submitBtnText").innerText = "Kemaskini & Muat Turun PDF";
  }
}

function setProgress(step, status) {
  const element = document.getElementById(`step-${step}`);
  if (!element) return;
  element.dataset.status = status;
  const icon = element.querySelector(".step-icon");
  if (status === "active") icon.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
  if (status === "done") icon.innerHTML = `<i class="fa-solid fa-check"></i>`;
  if (status === "error") icon.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
}

function showSaveProgress() {
  ["images", "pdf", "drive", "done"].forEach(step => {
    const element = document.getElementById(`step-${step}`);
    element.dataset.status = "pending";
    const defaults = {
      images: "fa-solid fa-image",
      pdf: "fa-solid fa-file-pdf",
      drive: "fa-brands fa-google-drive",
      done: "fa-solid fa-flag-checkered"
    };
    element.querySelector(".step-icon").innerHTML = `<i class="${defaults[step]}"></i>`;
  });
  document.getElementById("saveProgressMessage").classList.add("hidden");
  document.getElementById("closeProgressBtn").classList.add("hidden");
  const modal = document.getElementById("saveProgressModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function showProgressError(step, message) {
  setProgress(step, "error");
  const box = document.getElementById("saveProgressMessage");
  box.textContent = message;
  box.classList.remove("hidden");
  document.getElementById("closeProgressBtn").classList.remove("hidden");
}

function closeSaveProgress() {
  const modal = document.getElementById("saveProgressModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function waitForPreviewImages() {
  const images = [...document.querySelectorAll("#printArea img")].filter(image => image.src && !image.classList.contains("hidden"));
  return Promise.all(images.map(image => {
    if (image.complete) return Promise.resolve();
    return new Promise(resolve => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
      setTimeout(resolve, 5000);
    });
  }));
}

async function generatePdfBlob() {
  const area = document.getElementById("printArea");
  await document.fonts.ready;
  await waitForPreviewImages();
  const oldTransform = area.style.transform;
  area.classList.add("pdf-capture");
  area.style.transform = "none";
  try {
    const canvas = await html2canvas(area, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      width: area.offsetWidth,
      height: area.offsetHeight,
      windowWidth: area.offsetWidth,
      windowHeight: area.offsetHeight
    });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    return pdf.output("blob");
  } finally {
    area.classList.remove("pdf-capture");
    area.style.transform = oldTransform;
    fitPreview();
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function safeFilePart(value) {
  return String(value || "OPR")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 55) || "OPR";
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function handleSaveAndPrint(event) {
  event.preventDefault();
  const editRowId = document.getElementById("editRowId").value || "";
  const editIc = document.getElementById("editIc").value.replace(/\D/g, "");
  if (editRowId && editIc.length !== 12) {
    alert("Untuk mengedit laporan, sila masukkan 12 digit nombor IC tanpa sempang.");
    document.getElementById("editIc").focus();
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  showSaveProgress();
  let currentStep = "images";
  try {
    setProgress("images", "active");
    await waitForPreviewImages();
    setProgress("images", "done");

    currentStep = "pdf";
    setProgress("pdf", "active");
    const pdfBlob = await generatePdfBlob();
    const pdfBase64 = await blobToBase64(pdfBlob);
    setProgress("pdf", "done");

    currentStep = "drive";
    setProgress("drive", "active");
    const title = document.getElementById("tajukProgram").value;
    const officer = document.getElementById("namaPegawai").value;
    const date = document.getElementById("tarikhLaporan").value;
    const pdfFileName = `OPR_${safeFilePart(title)}_${safeFilePart(officer)}_${date || "LAPORAN"}.pdf`;
    const payload = {
      action: "saveReport",
      editRowId,
      editIc,
      namaPegawai: officer,
      jawatanPegawai: document.getElementById("jawatanPegawai").value,
      tarikhLaporan: date,
      tajukProgram: title,
      tarikhPelaksanaan: document.getElementById("tarikhPelaksanaan").value,
      masa: document.getElementById("masa").value,
      sasaran: document.getElementById("sasaran").value,
      pelibatan: document.getElementById("pelibatan").value,
      objektif: document.getElementById("objektif").value,
      kekuatan: document.getElementById("kekuatan").value,
      penambahbaikan: document.getElementById("penambahbaikan").value,
      gambar1: state.images[1].changed ? state.images[1].dataUrl : "",
      gambar2: state.images[2].changed ? state.images[2].dataUrl : "",
      kapsyen2: document.getElementById("kapsyen2").value,
      gambar3: state.images[3].changed ? state.images[3].dataUrl : "",
      kapsyen3: document.getElementById("kapsyen3").value,
      gambar4: state.images[4].changed ? state.images[4].dataUrl : "",
      kapsyen4: document.getElementById("kapsyen4").value,
      pdfBase64,
      pdfFileName
    };

    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message || "Rekod gagal disimpan");
    setProgress("drive", "done");

    currentStep = "done";
    setProgress("done", "active");
    downloadBlob(pdfBlob, pdfFileName);
    setProgress("done", "done");
    document.getElementById("closeProgressBtn").classList.remove("hidden");
    loadData(true);
  } catch (error) {
    console.error("Ralat simpan:", error);
    showProgressError(currentStep, `Proses tidak selesai: ${error.message || error}`);
  } finally {
    submitBtn.disabled = false;
  }
}
