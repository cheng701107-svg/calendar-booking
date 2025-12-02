/***********************
 * 前台：Airbnb 訂房表單
 * 自動：房價計算 + 訂金計算（由 GAS 回傳）
 ***********************/

const API_URL = "https://script.google.com/macros/s/AKfycbzbJVv5esMv7ltwoXq4FAKoDR9GDwPVREzp4XW7MzRGnhr46gjoFDADfSsUYxoI7Fja/exec";   // ★ 一定要改成你的 URL

// DOM
const houseEl     = document.getElementById("house");
const roomTypeEl  = document.getElementById("roomType");
const dateRangeEl = document.getElementById("dateRange");
const priceDetail = document.getElementById("priceDetail");

const nightsBox   = document.getElementById("nightsBox");

// 初始化日期選擇器
flatpickr("#dateRange", {
  mode: "range",
  minDate: "today",
  locale: "zh_tw",
  onChange: function (sel) {
    updatePrice();
  }
});

// ★ 館別 → 房型動態切換
houseEl.addEventListener("change", () => {
  const house = houseEl.value;

  if (!house) {
    roomTypeEl.innerHTML = `<option value="">請先選擇館別</option>`;
    return;
  }

  roomTypeEl.innerHTML = `
    <option value="包棟">包棟</option>
  `;

  updatePrice();
});

roomTypeEl.addEventListener("change", updatePrice);
dateRangeEl.addEventListener("change", updatePrice);

// ★ 呼叫後端計價 API
async function updatePrice() {

  const house    = houseEl.value;
  const roomType = roomTypeEl.value;
  const dateStr  = dateRangeEl.value;

  if (!house || !roomType || !dateStr) {
    priceDetail.innerHTML = "請先選擇日期";
    return;
  }

  // 解析入住/退房日期
  const parts = dateStr.split(" 至 ");
  if (parts.length !== 2) {
    priceDetail.innerHTML = "請正確選擇日期";
    return;
  }

  const checkin  = parts[0];
  const checkout = parts[1];

  // 計算晚數
  const d1 = new Date(checkin);
  const d2 = new Date(checkout);
  const diff = (d2 - d1) / (1000 * 60 * 60 * 24);

  if (diff <= 0) {
    priceDetail.innerHTML = "退房日期需大於入住日期";
    return;
  }

  // ★ 呼叫 GAS 計算房價
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createBooking",   // 用 createBooking 來計算（但不寫入）
        previewOnly: true,         // ★ 不寫入，只計算房價
        house,
        roomType,
        date: checkin,
        nights: diff
      })
    });

    const json = await res.json();

    if (!json.success) {
      priceDetail.innerHTML = "無法取得金額";
      console.log(json.error);
      return;
    }

    const total   = json.totalPrice;
    const deposit = json.deposit;

    priceDetail.innerHTML = `
      住宿 ${diff} 晚<br><br>
      房價總額：<b>NT$${total}</b><br><br>
      <span style="color:red">訂金需付款：NT$${deposit}</span>
    `;

  } catch (err) {
    priceDetail.innerHTML = "金額計算失敗";
    console.log(err);
  }
}

// ★ 最終送出
document.getElementById("btnSubmit").addEventListener("click", submitBooking);

async function submitBooking() {

  const house = houseEl.value;
  const roomType = roomTypeEl.value;
  const dateStr = dateRangeEl.value;

  if (!house || !roomType || !dateStr) {
    alert("請完整填寫表單");
    return;
  }

  const parts = dateStr.split(" 至 ");
  const checkin  = parts[0];
  const checkout = parts[1];

  const nights = (new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24);

  const data = {
    action: "createBooking",
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    email: document.getElementById("email").value,
    house,
    roomType,
    date: checkin,
    nights,
    adult: document.getElementById("adult").value,
    child: document.getElementById("child").value,
    note: document.getElementById("note").value
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const json = await res.json();

    if (!json.success) {
      alert("無法送出預訂");
      console.log(json.error);
      return;
    }

    // 預訂成功
    document.getElementById("resultArea").classList.remove("hidden");
    document.querySelector(".container").classList.add("hidden");

    document.getElementById("resultText").innerText =
      `您的預訂已完成！\n訂單編號：${json.id}`;

  } catch (err) {
    alert("預訂發生錯誤");
    console.log(err);
  }
}
