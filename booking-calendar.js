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

let priceTable = {};     // 房價表（平日、假日、特殊日）
let fullDates = [];      // 滿房日期
let selectedDates = [];  // 使用者選的入住 + 退房日期
let calcPrice = 0;       // 總金額
let calcDeposit = 0;     // 訂金 50%

/************************************************
 * ① 選館別 → 載入房價表＋房型（固定包棟）
 ************************************************/
houseEl.addEventListener("change", async () => {
  const house = houseEl.value;

  if (!house) {
    roomTypeEl.innerHTML = `<option value="">請先選擇館別</option>`;
    return;
  }

  // 房型固定為包棟
  roomTypeEl.innerHTML = `<option value="包棟">包棟</option>`;

  await loadPriceTable(house);
  await loadFullDates(house);
});

/************************************************
 * ② 日期選擇器（Airbnb Range）
 ************************************************/
let fp = flatpickr(dateRangeEl, {
  mode: "range",
  minDate: "today",
  locale: "zh_tw",
  dateFormat: "Y-m-d",
  onChange: (dates) => {
    selectedDates = dates;
    updatePrice();
  },
});

/************************************************
 * ③ 從 GAS 取得房價表
 ************************************************/
async function loadPriceTable(house) {
  try {
    const res = await fetch(`${API_URL}?action=getPrice&house=${house}`);
    const data = await res.json();

    if (data.success) {
      /**
       * data.priceTable 格式（你試算表的對應格式）：
       * {
       *   "平日": 6500,
       *   "假日": 8500,
       *   "旺季": 9000,
       *   "特殊日": {
       *       "2025-12-31": 12000
       *   }
       * }
       */
      priceTable = data.priceTable;
    }
  } catch (e) {
    console.error("房價讀取錯誤", e);
  }
}

/************************************************
 * ④ 從 GAS 載入滿房日
 ************************************************/
async function loadFullDates(house) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const res = await fetch(
      `${API_URL}?action=getCalendar&house=${house}&year=${year}&month=${month}`
    );
    const data = await res.json();

    if (data.success) {
      fullDates = data.fullDates;
      fp.set("disable", fullDates);
    }
  } catch (e) {
    console.error("滿房日期讀取錯誤", e);
  }
}

/************************************************
 * ⑤ 金額計算（平日 / 假日 / 特殊日）
 ************************************************/
function updatePrice() {
  if (selectedDates.length !== 2) {
    priceDetailEl.innerHTML = `請先選擇入住與退房日期`;
    return;
  }

  const [start, end] = selectedDates;
  const nights = Math.round((end - start) / 86400000);

  if (nights <= 0) {
    priceDetailEl.innerHTML = `退房日必須大於入住日`;
    return;
  }

  let total = 0;
  let detailLines = [];

  for (let i = 0; i < nights; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);

    const dateStr = formatDate(d);
    const dayOfWeek = d.getDay(); // 0(日) ~ 6(六)

    let price = 0;

    /*********** ❶ 特殊日優先 ***********/
    if (priceTable["特殊日"] && priceTable["特殊日"][dateStr]) {
      price = priceTable["特殊日"][dateStr];
    }
    /*********** ❷ 平日（日～四） ***********/
    else if (dayOfWeek >= 0 && dayOfWeek <= 4) {
      price = priceTable["平日"];
    }
    /*********** ❸ 假日（五六） ***********/
    else {
      price = priceTable["假日"];
    }

    total += Number(price);
    detailLines.push(`${dateStr}：$${price}`);
  }

  const deposit = Math.round(total * 0.5);

  calcPrice = total;
  calcDeposit = deposit;

  /*********** 顯示金額 ***********/
  priceDetailEl.innerHTML = `
    <div>${detailLines.join("<br>")}</div>
    <hr>
    <div style="font-weight:bold; font-size:20px;">總金額：$${total}</div>
    <div style="color:#d00; font-size:18px;">訂金（50%）：$${deposit}</div>
  `;
}

/************************************************
 * ⑥ 送出預訂
 ************************************************/
btnSubmit.addEventListener("click", async () => {
  if (!validate()) return;

  const [start, end] = selectedDates;
  const nights = Math.round((end - start) / 86400000);

  const payload = {
    action: "createBooking",
    house: houseEl.value,
    roomType: roomTypeEl.value,
    date: formatDate(start),
    nights,
    name: nameEl.value,
    email: emailEl.value,
    phone: phoneEl.value,
    adult: adultEl.value,
    child: childEl.value,
    note: noteEl.value,
    price: calcPrice,
    deposit: calcDeposit,
  };

  btnSubmit.textContent = "送出中…";
  btnSubmit.disabled = true;

  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (data.success) {
    showResult(payload, data.id);
  } else {
    alert("送出失敗：" + data.error);
  }

  btnSubmit.disabled = false;
  btnSubmit.textContent = "送出預訂";
});

/************************************************
 * ⑦ 驗證輸入
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
 * ⑧ 顯示結果
 ************************************************/
function showResult(data, id) {
  document.querySelector(".container").style.display = "none";
  document.getElementById("resultArea").classList.remove("hidden");

  document.getElementById("resultText").textContent = `
訂單編號：${id}
館別：${data.house}
房型：${data.roomType}
入住日期：${data.date}
住宿：${data.nights} 晚
大人：${data.adult}
小孩：${data.child}
總金額：${data.price}
訂金：${data.deposit}
  `;
}

/************************************************
 * 工具
 ************************************************/
function formatDate(d) {
  return d.toISOString().split("T")[0];
}
