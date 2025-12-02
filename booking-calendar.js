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

let fullDates = [];      // 滿房日期（從 GAS 抓）
let priceTable = {};     // 房價表（從 GAS 抓）
let selectedDates = [];  // 入住 + 退房
let calcPrice = 0;       // 最終總金額
let calcDeposit = 0;     // 訂金 50%

/************************************************
 * ① 載入房價表 + 館別切換房型
 ************************************************/
houseEl.addEventListener("change", async () => {
  const house = houseEl.value;

  if (!house) {
    roomTypeEl.innerHTML = `<option value="">請先選擇館別</option>`;
    return;
  }

  // 房型固定為「包棟」
  roomTypeEl.innerHTML = `
    <option value="包棟">包棟</option>
  `;

  // 讀取房價
  await loadPriceTable(house);

  // 讀取該館別的滿房日
  await loadFullDates(house);
});

/************************************************
 * ② Flatpickr（Airbnb 雙日期）
 ************************************************/
flatpickr(dateRangeEl, {
  mode: "range",
  minDate: "today",
  locale: "zh_tw",
  dateFormat: "Y-m-d",
  onChange: function (dates) {
    selectedDates = dates;
    updatePrice();
  },
  disable: [], // 之後用 loadFullDates() 填入
});

/************************************************
 * ③ 從 GAS 載入房價
 ************************************************/
async function loadPriceTable(house) {
  try {
    const res = await fetch(`${API_URL}?action=getPrice&house=${house}`);
    const data = await res.json();

    if (data.success) {
      priceTable = data.priceTable;
    }
  } catch (err) {
    console.error("loadPriceTable error", err);
  }
}

/************************************************
 * ④ 從 GAS 載入滿房日期
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
    console.error("loadFullDates error", err);
  }
}

/************************************************
 * ⑤ 計算金額（平日＝日～四，假日＝五六）
 ************************************************/
function updatePrice() {
  if (selectedDates.length !== 2) {
    priceDetailEl.innerHTML = "請先選擇入住與退房日期";
    return;
  }

  const [start, end] = selectedDates;
  const dayCount = Math.round((end - start) / 86400000);

  if (dayCount <= 0) {
    priceDetailEl.innerHTML = "退房日必須大於入住日";
    return;
  }

  let total = 0;
  let detailLines = [];

  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);

    const yyyy = d.getFullYear();
    const mm = ("0" + (d.getMonth() + 1)).slice(2);
    const dd = ("0" + d.getDate()).slice(2);
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const day = d.getDay(); // 0=日,1=一...6=六
    const isWeekend = day === 5 || day === 6;

    let price =
      isWeekend ? priceTable.weekendPrice : priceTable.weekdayPrice;

    total += Number(price);

    detailLines.push(`${dateStr}：$${price}`);
  }

  const deposit = Math.round(total * 0.5);

  calcPrice = total;
  calcDeposit = deposit;

  priceDetailEl.innerHTML = `
    <div>${detailLines.join("<br>")}</div>
    <hr>
    <div class="price-total">總金額：$${total}</div>
    <div class="price-deposit">訂金（50%）：$${deposit}</div>
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
    date: flatDate(start),
    nights: nights,
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

  btnSubmit.textContent = "送出預訂";
  btnSubmit.disabled = false;
});

/************************************************
 * ⑦ 驗證
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
 * ⑧ 顯示結果畫面
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
大人：${data.adult} 位
小孩：${data.child} 位
總金額：${data.price}
訂金：${data.deposit}
`;
}

/************************************************
 * 工具：格式化日期 yyyy-mm-dd
 ************************************************/
function flatDate(d) {
  return d.toISOString().split("T")[0];
}
