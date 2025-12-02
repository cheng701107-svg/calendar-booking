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

let fullDates = [];
let priceTable = {};
let selectedDates = [];
let calcPrice = 0;
let calcDeposit = 0;

/************************************************
 * ① 載入房價
 ************************************************/
houseEl.addEventListener("change", async () => {
  const house = houseEl.value;

  if (!house) {
    roomTypeEl.innerHTML = `<option value="">請先選擇館別</option>`;
    return;
  }

  roomTypeEl.innerHTML = `<option value="包棟">包棟</option>`;

  await loadPriceTable(house);
  await loadFullDates(house);
});

/************************************************
 * ② Flatpickr
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
});

/************************************************
 * ③ 從 GAS 讀房價
 ************************************************/
async function loadPriceTable(house) {
  try {
    const res = await fetch(`${API_URL}?action=getPrice&house=${house}`);
    const data = await res.json();

    if (data.success) {
      priceTable = data.priceTable;
      console.log("載入房價", priceTable);
    }
  } catch (e) {
    console.error("房價讀取錯誤", e);
  }
}

/************************************************
 * ④ 讀滿房日
 ************************************************/
async function loadFullDates(house) {
  try {
    const today = new Date();
    const res = await fetch(
      `${API_URL}?action=getCalendar&house=${house}&year=${today.getFullYear()}&month=${today.getMonth() + 1}`
    );

    const data = await res.json();
    if (data.success) fullDates = data.fullDates;

    flatpickr(dateRangeEl).set("disable", fullDates);
  } catch (e) {
    console.error(e);
  }
}

/************************************************
 * ⑤ 計算金額（含特殊日 / 旺季 / 平假日）
 ************************************************/
function updatePrice() {
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

    // 🔥 2. 旺季
    } else if (priceTable["旺季"] &&
               (mm === "07" || mm === "08")) {
      priceObj = priceTable["旺季"];

    // 🔥 3. 平日 / 假日
    } else {
      const weekday = d.getDay(); // 0=日 5=五 6=六
      priceObj = (weekday === 5 || weekday === 6)
        ? priceTable["假日"]
        : priceTable["平日"];
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
    date: start.toISOString().split("T")[0],
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
  btnSubmit.textContent = "送出預訂";
  btnSubmit.disabled = false;

  if (data.success) {
    alert("預訂成功！訂單編號：" + data.id);
  } else {
    alert("送出失敗：" + data.error);
  }
});
