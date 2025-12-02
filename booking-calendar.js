/************************************************
 * 設定
 ************************************************/
const API_URL =
  "https://script.google.com/macros/s/AKfycby4WqoKwtVFcbBMk_B13RXQD1bW3XUaC57FPqmvsqStvCzGUuXwh2wxANdNp9zMcUt9/exec";

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

let fullDates = [];
let priceTable = {};
let selectedDates = [];
let calcPrice = 0;
let calcDeposit = 0;

// flatpickr 實例
let fpInstance = null;

/************************************************
 * ① 館別 change：載入房價 + 滿房日
 ************************************************/
houseEl.addEventListener("change", async () => {
  const house = houseEl.value;

  if (!house) {
    roomTypeEl.innerHTML = `<option value="">請先選擇館別</option>`;
    priceTable = {};
    priceDetailEl.innerHTML = "請先選擇館別";
    if (fpInstance) {
      fpInstance.clear();
      fpInstance.set("disable", []);
    }
    return;
  }

  // 目前只做包棟
  roomTypeEl.innerHTML = `<option value="包棟">包棟</option>`;

  await loadPriceTable(house);
  await loadFullDates(house);
});

/************************************************
 * ② 初始化 Flatpickr
 ************************************************/
fpInstance = flatpickr(dateRangeEl, {
  mode: "range",
  minDate: "today",
  locale: "zh_tw",
  dateFormat: "Y-m-d",
  onChange: function (dates) {
    selectedDates = dates;
    updatePrice();
  },
});

/************************************************
 * ③ 從 GAS 讀房價
 ************************************************/
async function loadPriceTable(house) {
  try {
    const res = await fetch(`${API_URL}?action=getPrice&house=${encodeURIComponent(house)}`);
    const data = await res.json();

    if (data.success) {
      priceTable = data.priceTable || {};
      console.log("載入房價", priceTable);
    } else {
      priceDetailEl.innerHTML = "房價讀取失敗，請稍後再試";
    }
  } catch (e) {
    console.error("房價讀取錯誤", e);
    priceDetailEl.innerHTML = "房價讀取錯誤，請稍後再試";
  }
}

/************************************************
 * ④ 讀滿房日，設定 disable
 ************************************************/
async function loadFullDates(house) {
  try {
    const today = new Date();
    const res = await fetch(
      `${API_URL}?action=getCalendar&house=${encodeURIComponent(house)}&year=${today.getFullYear()}&month=${today.getMonth() + 1}`
    );

    const data = await res.json();
    if (data.success && Array.isArray(data.fullDates)) {
      fullDates = data.fullDates;
    } else {
      fullDates = [];
    }

    if (fpInstance) {
      fpInstance.set("disable", fullDates);
      fpInstance.clear();
    }
  } catch (e) {
    console.error("滿房日讀取錯誤", e);
  }
}

/************************************************
 * ⑤ 計算金額（含特殊日 / 旺季 / 平假日）
 ************************************************/
function updatePrice() {
  // 尚未載入館別 / 房價
  if (!houseEl.value) {
    priceDetailEl.innerHTML = "請先選擇館別";
    return;
  }

  if (!priceTable["平日"] && !priceTable["假日"] && !priceTable["旺季"] && !priceTable["特殊日"]) {
    priceDetailEl.innerHTML = "房價尚未載入完成，請稍候再試";
    return;
  }

  if (selectedDates.length !== 2) {
    priceDetailEl.innerHTML = "請先選擇入住與退房日期";
    return;
  }

  const [start, end] = selectedDates;
  const nights = Math.round((end - start) / 86400000);
  if (nights <= 0) {
    priceDetailEl.innerHTML = "退房日必須大於入住日";
    return;
  }

  let total = 0;
  let lines = [];

  for (let i = 0; i < nights; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);

    const yyyy = d.getFullYear();
    const mm = ("0" + (d.getMonth() + 1)).slice(-2);
    const dd = ("0" + d.getDate()).slice(-2);
    const dateStr = `${yyyy}-${mm}-${dd}`;

    let priceObj = null;

    // 🔥 1. 特殊日優先
    if (priceTable["特殊日"] && priceTable["特殊日"][dateStr]) {
      priceObj = priceTable["特殊日"][dateStr];

      // 🔥 2. 旺季（例：7、8 月）
    } else if (priceTable["旺季"] && (mm === "07" || mm === "08")) {
      priceObj = priceTable["旺季"];

      // 🔥 3. 平日 / 假日
    } else {
      const weekday = d.getDay(); // 0=日 5=五 6=六
      if (weekday === 5 || weekday === 6) {
        priceObj = priceTable["假日"];
      } else {
        priceObj = priceTable["平日"];
      }
    }

    if (!priceObj || typeof priceObj.price !== "number") {
      priceDetailEl.innerHTML = `找不到 ${dateStr} 的房價設定，請確認房價表`;
      return;
    }

    total += priceObj.price;
    lines.push(`${dateStr}：$${priceObj.price}`);
  }

  calcPrice = total;
  calcDeposit = Math.round(total * 0.5);

  priceDetailEl.innerHTML = `
    <div>${lines.join("<br>")}</div>
    <hr>
    <div class="price-total">總金額：$${calcPrice}</div>
    <div class="price-deposit">訂金（50%）：$${calcDeposit}</div>
  `;
}

/************************************************
 * ⑥ 表單驗證
 ************************************************/
function validate() {
  if (!houseEl.value) {
    alert("請先選擇館別");
    return false;
  }

  if (!roomTypeEl.value) {
    alert("請先選擇房型");
    return false;
  }

  if (selectedDates.length !== 2) {
    alert("請先選擇入住與退房日期");
    return false;
  }

  const name = nameEl.value.trim();
  if (!name) {
    alert("請輸入姓名");
    return false;
  }

  const phone = phoneEl.value.trim();
  if (!/^09\d{8}$/.test(phone)) {
    alert("請輸入正確的手機號碼（需為 09 開頭，共 10 碼）");
    return false;
  }

  // Email 非必填，但如果有填就做基本檢查
  const email = emailEl.value.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    alert("Email 格式不正確");
    return false;
  }

  if (!calcPrice || !calcDeposit) {
    alert("金額尚未計算完成，請重新選擇日期");
    return false;
  }

  return true;
}

/************************************************
 * ⑦ 送出預訂
 ************************************************/
btnSubmit.addEventListener("click", async () => {
  if (!validate()) return;

  const [start, end] = selectedDates;
  const nights = Math.round((end - start) / 86400000);

  const payload = {
    action: "createBooking",
    house: houseEl.value,
    roomType: roomTypeEl.value,
    date: start.toISOString().split("T")[0],
    nights,
    name: nameEl.value.trim(),
    email: emailEl.value.trim(),
    phone: phoneEl.value.trim(),
    adult: Number(adultEl.value || 0),
    child: Number(childEl.value || 0),
    note: noteEl.value.trim(),
    price: calcPrice,
    deposit: calcDeposit,
  };

  try {
    btnSubmit.textContent = "送出中…";
    btnSubmit.disabled = true;

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    btnSubmit.textContent = "送出預訂";
    btnSubmit.disabled = false;

    if (data.success) {
      alert("預訂成功！訂單編號：" + data.id);
      // 可以視需要：清空畫面 / 導向其他頁面
    } else {
      alert("送出失敗：" + (data.error || "未知錯誤"));
    }
  } catch (err) {
    console.error(err);
    btnSubmit.textContent = "送出預訂";
    btnSubmit.disabled = false;
    alert("系統錯誤，請稍後再試");
  }
});

