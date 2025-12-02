/********************************************
 * 🌟 設定：請改成你的 GAS Web App URL（/exec）
 ********************************************/
const API_URL = "https://script.google.com/macros/s/AKfycbzbJVv5esMv7ltwoXq4FAKoDR9GDwPVREzp4XW7MzRGnhr46gjoFDADfSsUYxoI7Fja/exec";

/********************************************
 * 🌟 房價設定（可自由調整）
 ********************************************/
const PRICE = {
  "A館": { "包棟": 5000 },
  "B館": { "包棟": 5500 }
};

/********************************************
 * 館別 ➜ 房型
 ********************************************/
const ROOMS = {
  "A館": ["包棟"],
  "B館": ["包棟"]
};

document.getElementById("house").addEventListener("change", () => {
  const house = document.getElementById("house").value;
  const roomType = document.getElementById("roomType");

  roomType.innerHTML = `<option value="">請選擇房型</option>`;
  if (!house) return;

  ROOMS[house].forEach(r => {
    roomType.innerHTML += `<option value="${r}">${r}</option>`;
  });

  updatePrice(); // 切換館別後重新計算價格
});


/********************************************
 * flatpickr：Airbnb 雙日期選擇
 ********************************************/
flatpickr("#dateRange", {
  locale: "zh_tw",
  mode: "range",
  dateFormat: "Y-m-d",
  minDate: "today",
  onClose: updatePrice
});


/********************************************
 * 🌟 計算房價（最重要）
 ********************************************/
function updatePrice() {
  const range = document.getElementById("dateRange").value;
  const house = document.getElementById("house").value;
  const roomType = document.getElementById("roomType").value;
  const priceBox = document.getElementById("priceDetail");

  if (!house || !roomType) {
    priceBox.textContent = "請先選擇館別與房型";
    return;
  }

  if (!range.includes(" 至 ")) {
    priceBox.textContent = "請先選擇日期";
    return;
  }

  // 日期解析
  const [checkIn, checkOut] = range.split(" 至 ");
  const nights = dayDiff(checkIn, checkOut);

  if (nights <= 0) {
    priceBox.textContent = "日期選擇不正確";
    return;
  }

  // 取得房價
  const pricePerNight = PRICE[house][roomType];
  const total = nights * pricePerNight;

  // 顯示金額
  priceBox.innerHTML = `
    入住 <b>${nights}</b> 晚<br>
    單價：NT$${pricePerNight}<br>
    <b>總額：NT$${total}</b>
  `;
}

/********************************************
 * 工具：計算相差天數
 ********************************************/
function dayDiff(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}


/********************************************
 * 🌟 送出預訂
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

    // 顯示成功畫面
    document.querySelector(".container").classList.add("hidden");
    document.getElementById("resultArea").classList.remove("hidden");
    document.getElementById("resultText").textContent =
      `您的訂房已送出！\n訂單編號：${json.id}`;

  } catch (err) {
    alert("系統錯誤，請稍後再試。\n" + err);
  }
}
