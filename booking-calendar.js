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
/************************************************
 * 房價 API：同時回傳 price + deposit
 ************************************************/
function getPrice(p) {
  const house = p.house;
  const roomType = p.roomType;
  const dateStr = p.date;

  if (!house || !roomType || !dateStr) {
    return jsonOutput({ success: false, error: "缺少參數" });
  }

  const priceSheet = SpreadsheetApp.getActive().getSheetByName("房價表");
  const rows = priceSheet.getDataRange().getValues();

  const targetDate = Utilities.formatDate(new Date(dateStr), "Asia/Taipei", "yyyy-MM-dd");

  let found = null;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];

    const rHouse = r[0];
    const rRoom = r[1];
    const rType = r[2];
    const rSpecialDate = r[3];
    const rPrice = r[4];
    const rDeposit = r[5];

    if (rHouse !== house || rRoom !== roomType) continue;

    // 特殊日
    if (rType === "特殊日" && rSpecialDate === targetDate) {
      found = { price: rPrice, deposit: rDeposit };
      break;
    }

    // 平日/假日/旺季
    if (rType !== "特殊日") {
      const day = new Date(targetDate).getDay();
      let dateType = "平日";

      if (day === 5) dateType = "旺季";
      if (day === 6 || day === 0) dateType = "假日";

      if (dateType === rType) {
        found = { price: rPrice, deposit: rDeposit };
      }
    }
  }

  if (!found) {
    return jsonOutput({ success: false, error: "查無價格" });
  }

  return jsonOutput({
    success: true,
    price: found.price,
    deposit: found.deposit
  });
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


