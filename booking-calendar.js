/************************************************
 * 設定區：請改成你的 GAS Web App URL
 ************************************************/
const API_URL = "https://script.google.com/macros/s/你的ScriptID/exec";

/************************************************
 * DOM 快取
 ************************************************/
const houseSelect   = document.getElementById("house");
const roomTypeSelect= document.getElementById("roomType");
const dateRangeInput= document.getElementById("dateRange");
const adultInput    = document.getElementById("adult");
const childInput    = document.getElementById("child");
const nameInput     = document.getElementById("name");
const emailInput    = document.getElementById("email");
const phoneInput    = document.getElementById("phone");
const noteInput     = document.getElementById("note");

const priceDetailEl = document.getElementById("priceDetail");
const btnSubmit     = document.getElementById("btnSubmit");

const formContainer = document.querySelector(".container");
const resultArea    = document.getElementById("resultArea");
const resultText    = document.getElementById("resultText");

/************************************************
 * 房型設定（目前：A館 / B館 皆為「包棟」）
 ************************************************/
const ROOM_TYPES = {
  "A館": ["包棟"],
  "B館": ["包棟"]
};

/************************************************
 * 狀態變數
 ************************************************/
let fp;                    // flatpickr 實例
let fullDatesCache = [];   // 當月滿房日期
let nightsCount = 0;       // 住宿天數
let lastPriceResult = null; // 計價結果快取（給送出時使用）

/************************************************
 * 初始化
 ************************************************/
document.addEventListener("DOMContentLoaded", () => {
  initFlatpickr();
  bindEvents();
});

/************************************************
 * 初始化 Flatpickr（Airbnb 風雙日期）
 ************************************************/
function initFlatpickr() {
  fp = flatpickr(dateRangeInput, {
    mode: "range",
    locale: "zh_tw",             // 中文
    minDate: "today",
    dateFormat: "Y-m-d",
    onOpen: () => {
      refreshDisabledDates();
    },
    onMonthChange: () => {
      refreshDisabledDates();
    },
    onYearChange: () => {
      refreshDisabledDates();
    },
    onChange: (selectedDates) => {
      handleDateChange(selectedDates);
    }
  });
}

/************************************************
 * 綁定事件
 ************************************************/
function bindEvents() {
  // 館別變更 → 重新載入房型 + 重算滿房日期 + 清除日期
  houseSelect.addEventListener("change", () => {
    updateRoomTypes();
    fp.clear();
    nightsCount = 0;
    priceDetailEl.textContent = "請先選擇入住與退房日期";
    refreshDisabledDates();
  });

  // 房型 / 人數變更 → 若日期已選擇，則重新計算價格
  roomTypeSelect.addEventListener("change", updatePriceIfReady);
  adultInput.addEventListener("input", updatePriceIfReady);
  childInput.addEventListener("input", updatePriceIfReady);

  // 送出預訂
  btnSubmit.addEventListener("click", onSubmit);
}

/************************************************
 * 根據館別更新房型選單
 ************************************************/
function updateRoomTypes() {
  const house = houseSelect.value;
  roomTypeSelect.innerHTML = "";

  if (!house || !ROOM_TYPES[house]) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "請先選擇館別";
    roomTypeSelect.appendChild(opt);
    return;
  }

  const list = ROOM_TYPES[house];
  list.forEach(rt => {
    const opt = document.createElement("option");
    opt.value = rt;
    opt.textContent = rt;
    roomTypeSelect.appendChild(opt);
  });
}

/************************************************
 * 依目前顯示月份 & 館別 → 取得滿房日期
 ************************************************/
async function refreshDisabledDates() {
  const house = houseSelect.value;
  if (!house || !fp) return;

  const year = fp.currentYear;
  const month = fp.currentMonth + 1; // 0-based → 1-based

  try {
    const url = `${API_URL}?action=getCalendar&house=${encodeURIComponent(house)}&year=${year}&month=${month}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!json.success) {
      console.warn("getCalendar error:", json.error);
      return;
    }

    fullDatesCache = json.fullDates || [];
    fp.set("disable", fullDatesCache);

  } catch (err) {
    console.error("refreshDisabledDates error:", err);
  }
}

/************************************************
 * 日期變更（Airbnb 雙日期）
 ************************************************/
function handleDateChange(selectedDates) {
  if (selectedDates.length < 2) {
    nightsCount = 0;
    priceDetailEl.textContent = "請再選擇退房日期";
    return;
  }

  const checkin = selectedDates[0];
  const checkout = selectedDates[1];

  // 計算天數
  const diffMs = checkout - checkin;
  nightsCount = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (nightsCount <= 0) {
    nightsCount = 0;
    priceDetailEl.textContent = "日期區間錯誤，請重新選擇。";
    return;
  }

  // 若有館別 / 房型 → 試著計算價格
  updatePriceIfReady();
}

/************************************************
 * 若條件皆具備 → 呼叫後端計算金額
 ************************************************/
function updatePriceIfReady() {
  const house    = houseSelect.value;
  const roomType = roomTypeSelect.value;

  if (!house || !roomType || nightsCount <= 0 || fp.selectedDates.length < 2) {
    return;
  }

  const [checkin, checkout] = fp.selectedDates;
  const checkinStr = formatDate(checkin);
  const checkoutStr= formatDate(checkout);

  updatePrice(house, roomType, checkinStr, checkoutStr, nightsCount);
}

/************************************************
 * 呼叫後端 getPrice 計算金額（平日/假日/旺季/特殊日）
 ************************************************/
async function updatePrice(house, roomType, checkin, checkout, nights) {
  priceDetailEl.textContent = "計算中…";

  try {
    const url = `${API_URL}?action=getPrice`
      + `&house=${encodeURIComponent(house)}`
      + `&roomType=${encodeURIComponent(roomType)}`
      + `&checkin=${encodeURIComponent(checkin)}`
      + `&checkout=${encodeURIComponent(checkout)}`;

    const res = await fetch(url);
    const json = await res.json();

    if (!json.success) {
      priceDetailEl.textContent = "暫無房價設定，將由管家另行報價。";
      lastPriceResult = null;
      return;
    }

    // 後端可回傳：total, breakdownText
    lastPriceResult = json;

    const breakdown = json.breakdownText || "";
    const total = json.total || 0;

    let s = `入住：${checkin}\n退房：${checkout}\n共 ${nights} 晚\n\n`;
    if (breakdown) s += breakdown + "\n\n";
    s += `預估總金額：${total.toLocaleString()} 元`;

    priceDetailEl.textContent = s;

  } catch (err) {
    console.error("updatePrice error:", err);
    priceDetailEl.textContent = "系統暫時無法計算金額，將由管家另行報價。";
    lastPriceResult = null;
  }
}

/************************************************
 * 送出預訂
 ************************************************/
async function onSubmit() {
  const house    = houseSelect.value;
  const roomType = roomTypeSelect.value;
  const adult    = parseInt(adultInput.value || "0", 10);
  const child    = parseInt(childInput.value || "0", 10);
  const name     = (nameInput.value || "").trim();
  const email    = (emailInput.value || "").trim();
  const phone    = (phoneInput.value || "").trim();
  const note     = (noteInput.value || "").trim();

  if (!house) {
    alert("請先選擇館別");
    return;
  }
  if (!roomType) {
    alert("請選擇房型");
    return;
  }
  if (!name) {
    alert("請輸入姓名");
    return;
  }
  if (!/^09\d{8}$/.test(phone)) {
    alert("手機格式必須為 09xxxxxxxx");
    return;
  }
  if (!fp || fp.selectedDates.length < 2) {
    alert("請選擇入住與退房日期");
    return;
  }
  if (nightsCount <= 0) {
    alert("日期區間有誤，請重新選擇");
    return;
  }

  const [checkin, checkout] = fp.selectedDates;
  const checkinStr = formatDate(checkin);
  const checkoutStr= formatDate(checkout);

  const totalPrice = lastPriceResult && lastPriceResult.total
    ? lastPriceResult.total
    : 0;

  // 組成 payload 送給 GAS（後端我們等一下會寫）
  const payload = {
    action: "createBooking",
    source: "webCalendar",
    uid: "",
    name,
    phone,
    email,
    house,
    roomType,
    checkin: checkinStr,
    checkout: checkoutStr,
    nights: nightsCount,
    adult,
    child,
    pet: "",
    note,
    totalPrice
  };

  btnSubmit.disabled = true;
  btnSubmit.textContent = "送出中…";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (!json.success) {
      alert("預訂失敗：" + (json.error || "未知錯誤"));
      btnSubmit.disabled = false;
      btnSubmit.textContent = "送出預訂";
      return;
    }

    // 成功 → 顯示摘要
    const id = json.id || "尚未提供";

    const summary =
`預訂成功！

訂單編號：${id}
姓名：${name}
手機：${phone}
Email：${email || "未填"}
館別：${house}
房型：${roomType}
入住日：${checkinStr}
退房日：${checkoutStr}
住宿晚數：${nightsCount} 晚
人數：大人 ${adult} 位 / 小孩 ${child} 位
預估總金額：${totalPrice ? totalPrice.toLocaleString() + " 元" : "由管家另行報價"}
備註：${note || "無"}`;

    formContainer.style.display = "none";
    resultArea.classList.remove("hidden");
    resultText.textContent = summary;

  } catch (err) {
    console.error("onSubmit error:", err);
    alert("系統錯誤，請稍後再試。" + err);
    btnSubmit.disabled = false;
    btnSubmit.textContent = "送出預訂";
  }
}

/************************************************
 * 工具：日期格式化 YYYY-MM-DD
 ************************************************/
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
