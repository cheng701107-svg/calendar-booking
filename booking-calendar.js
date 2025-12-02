/********************************************
 * 設定：請改成你的 GAS Web App URL（/exec）
 ********************************************/
const API_URL = "https://script.google.com/macros/s/AKfycbzbJVv5esMv7ltwoXq4FAKoDR9GDwPVREzp4XW7MzRGnhr46gjoFDADfSsUYxoI7Fja/exec";

/********************************************
 * 館別 ➜ 房型
 ********************************************/
const ROOMS = {
  "A館": ["包棟"],
  "B館": ["包棟"]
};

/********************************************
 * 監聽館別選單 → 自動切換房型
 ********************************************/
document.getElementById("house").addEventListener("change", () => {
  const house = document.getElementById("house").value;
  const roomType = document.getElementById("roomType");

  roomType.innerHTML = `<option value="">請選擇房型</option>`;

  if (!house) return;

  ROOMS[house].forEach(r => {
    roomType.innerHTML += `<option value="${r}">${r}</option>`;
  });
});

/********************************************
 * flatpickr：Airbnb 雙日期
 ********************************************/
flatpickr("#dateRange", {
  locale: "zh_tw",
  mode: "range",
  dateFormat: "Y-m-d",
  minDate: "today",
  onClose: updatePrice // 選完日期自動更新金額
});

/********************************************
 * 更新房價（示範固定價格）
 ********************************************/
function updatePrice() {
  const range = document.getElementById("dateRange").value;

  if (!range.includes(" 至 ")) {
    document.getElementById("priceDetail").textContent = "請選擇入住與退房日期";
    return;
  }

  const [checkIn, checkOut] = range.split(" 至 ");
  const nights = dayDiff(checkIn, checkOut);

  const house = document.getElementById("house").value;
  const roomType = document.getElementById("roomType").value;

  if (!house || !roomType) {
    document.getElementById("priceDetail").textContent = "請先選擇館別與房型";
    return;
  }

  // 🔥 假設每晚固定 5000 元（可之後改成 GAS 回傳）
  const pricePerNight = 5000;
  const total = nights * pricePerNight;

  document.getElementById("priceDetail").innerHTML =
    `入住 ${nights} 晚 × NT$${pricePerNight}<br><b>總額：NT$${total}</b>`;
}

/********************************************
 * 計算天數
 ********************************************/
function dayDiff(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

/********************************************
 * 送出訂單
 ********************************************/
document.getElementById("btnSubmit").addEventListener("click", submitBooking);

async function submitBooking() {
  const house = document.getElementById("house").value;
  const roomType = document.getElementById("roomType").value;
  const range = document.getElementById("dateRange").value;

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const adult = document.getElementById("adult").value;
  const child = document.getElementById("child").value;
  const note = document.getElementById("note").value;

  // 基本欄位檢查
  if (!house || !roomType || !range.includes(" 至 ") || !name || !phone) {
    alert("❗ 請填寫所有必填欄位");
    return;
  }

  const [checkIn, checkOut] = range.split(" 至 ");
  const nights = dayDiff(checkIn, checkOut);

  const payload = {
    action: "createBooking",
    house,
    roomType,
    date: checkIn,
    nights,
    adult,
    child,
    name,
    email,
    phone,
    note
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (!json.success) {
      alert("系統錯誤：" + json.error);
      return;
    }

    document.querySelector(".container").classList.add("hidden");
    document.getElementById("resultArea").classList.remove("hidden");
    document.getElementById("resultText").textContent =
      `您的訂房已送出！\n訂單編號：${json.id}`;

  } catch (err) {
    alert("系統錯誤，請稍後再試。\n" + err);
  }
}

