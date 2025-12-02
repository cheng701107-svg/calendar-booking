/************************************************
 * 設定
 ************************************************/
const API_URL =
  "https://script.google.com/macros/s/AKfycbzbJVv5esMv7ltwoXq4FAKoDR9GDwPVREzp4XW7MzRGnhr46gjoFDADfSsUYxoI7Fja/exec";

/************************************************
 * DOM
 ************************************************/
const houseEl = document.getElementById("house");
const roomTypeEl = document.getElementById("roomType");
const dateRangeEl = document.getElementById("dateRange");
const adultEl = document.getElementById("adult");
const childEl = document.getElementById("child");
const nameEl = document.getElementById("name");
const emailEl = document.getElementById("email");
const phoneEl = document.getElementById("phone");
const noteEl = document.getElementById("note");
const priceDetailEl = document.getElementById("priceDetail");
const btnSubmit = document.getElementById("btnSubmit");

// global
let fullDates = [];
let priceTable = {};
let selectedDates = [];
let calcPrice = 0;
let calcDeposit = 0;

/************************************************
 * 館別切換時，載入房價 + 滿房
 ************************************************/
houseEl.addEventListener("change", async () => {
  const house = houseEl.value;
  if (!house) return;

  roomTypeEl.innerHTML = `<option value="包棟">包棟</option>`;

  await loadPriceTable(house);
  await loadFullDates(house);
});

/************************************************
 * 日期選擇器（Airbnb）
 ************************************************/
flatpickr(dateRangeEl, {
  mode: "range",
  minDate: "today",
  locale: "zh_tw",
  dateFormat: "Y-m-d",
  onChange(dates) {
    selectedDates = dates;
    updatePrice();
  }
});

/************************************************
 * 從 GAS 讀取房價表
 ************************************************/
async function loadPriceTable(house) {
  try {
    const res = await fetch(`${API_URL}?action=getPrice&house=${house}`);
    const data = await res.json();

    if (data.success) priceTable = data.priceTable;
  } catch (err) {
    console.error("price load failed", err);
  }
}

/************************************************
 * 滿房日期
 ************************************************/
async function loadFullDates(house) {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    const res = await fetch(
      `${API_URL}?action=getCalendar&house=${house}&year=${year}&month=${month}`
    );
    const data = await res.json();

    if (data.success) {
      fullDates = data.fullDates;
      flatpickr(dateRangeEl).set("disable", fullDates);
    }
  } catch (err) {
    console.error("calendar load failed", err);
  }
}

/************************************************
 * 計算金額
 ************************************************/
function updatePrice() {
  if (selectedDates.length !== 2) {
    priceDetailEl.innerHTML = "請先選擇入住與退房日期";
    return;
  }

  const [start, end] = selectedDates;
  const nights = Math.round((end - start) / 86400000);
  if (nights <= 0) {
    priceDetailEl.innerHTML = "退房日期需大於入住日期";
    return;
  }

  let total = 0;
  let detailLines = [];

  for (let i = 0; i < nights; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);

    const yyyy = d.getFullYear();
    const mm = ("0" + (d.getMonth() + 1)).slice(-2);
    const dd = ("0" + d.getDate()).slice(-2);
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const weekday = d.getDay();
    let type = "";

    // 特殊日
    if (priceTable["特殊日"] && priceTable["特殊日"][dateStr]) {
      type = "特殊日";

    } else if (weekday === 5 || weekday === 6) {
      type = "假日";

    } else {
      type = "平日";
    }

    const price = priceTable[type].price;
    total += price;
    detailLines.push(`${dateStr}：$${price}`);
  }

  const deposit = Math.round(total * 0.5);

  calcPrice = total;
  calcDeposit = deposit;

  priceDetailEl.innerHTML = `
    ${detailLines.join("<br>")}
    <hr>
    <div class="price-total">總金額：$${total}</div>
    <div class="price-deposit">訂金（50%）：$${deposit}</div>
  `;
}

/************************************************
 * 送出
 ************************************************/
btnSubmit.addEventListener("click", async () => {
  if (!validate()) return;

  const [start, end] = selectedDates;
  const nights = Math.round((end - start) / 86400000);

  const payload = {
    action: "createBooking",
    house: houseEl.value,
    roomType: roomTypeEl.value,
    date: flatDate(start),
    nights,
    name: nameEl.value,
    email: emailEl.value,
    phone: phoneEl.value,
    adult: adultEl.value,
    child: childEl.value,
    note: noteEl.value,
    price: calcPrice,
    deposit: calcDeposit
  };

  btnSubmit.disabled = true;
  btnSubmit.textContent = "送出中…";

  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  btnSubmit.disabled = false;
  btnSubmit.textContent = "送出預訂";

  if (data.success) {
    showResult(payload, data.id);
  } else {
    alert("送出失敗：" + data.error);
  }
});

/************************************************
 * 驗證
 ************************************************/
function validate() {
  if (!houseEl.value) return alert("請選擇館別");
  if (!roomTypeEl.value) return alert("請選擇房型");
  if (selectedDates.length !== 2) return alert("請選擇入住與退房日期");
  if (!nameEl.value) return alert("請輸入姓名");
  if (!phoneEl.value) return alert("請輸入手機號碼");
  return true;
}

/************************************************
 * 顯示結果
 ************************************************/
function showResult(data, id) {
  document.querySelector(".container").style.display = "none";
  document.getElementById("resultArea").classList.remove("hidden");

  document.getElementById("resultText").textContent = `
訂單編號：${id}
館別：${data.house}
房型：${data.roomType}
入住：${data.date}
住宿：${data.nights} 晚
大人：${data.adult}
小孩：${data.child}
總金額：${data.price}
訂金：${data.deposit}
 `;
}

/************************************************
 * 工具：yyyy-mm-dd
 ************************************************/
function flatDate(d) {
  return d.toISOString().split("T")[0];
}
