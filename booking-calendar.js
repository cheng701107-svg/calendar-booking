/************************************************
 * 設定
 ************************************************/
const API_URL =
  "https://script.google.com/macros/s/AKfycbxAhWFD3rLv2O1RSnmEA3EJjXIK5vFKja4IHGtL8EW3q-6ZD77K1Emc_ryFAK1fOZKA/exec";

let currentHouse = "";  // A館 / B館
let rooms = {
  "A館": ["包棟"],
  "B館": ["包棟"]
};

/************************************************
 * DOM 元件
 ************************************************/
const calArea = document.querySelector(".calendar-area");
const houseBtns = document.querySelectorAll(".house-btn");
const roomTypeSelect = document.getElementById("roomType");


/************************************************
 * 初始化
 ************************************************/
document.addEventListener("DOMContentLoaded", () => {
  bindHouseButtons();
});


/************************************************
 * 綁定館別按鈕
 ************************************************/
function bindHouseButtons() {
  houseBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      houseBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentHouse = btn.dataset.house;

      loadRoomType();
      loadThreeMonths();
    });
  });
}


/************************************************
 * 根據館別顯示房型（目前固定包棟）
 ************************************************/
function loadRoomType() {
  roomTypeSelect.innerHTML = "";
  rooms[currentHouse].forEach(r => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    roomTypeSelect.appendChild(opt);
  });
}


/************************************************
 * 載入 3 個月日曆
 ************************************************/
async function loadThreeMonths() {
  if (!currentHouse) {
    calArea.innerHTML = "<p>請先選擇館別</p>";
    return;
  }

  calArea.innerHTML = "載入中…";

  const months = [];
  const today = new Date();

  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1
    });
  }

  // 呼叫 API 並同時取得 3 個月的滿房資料
  const fullMap = {};

  for (const m of months) {
    const url = `${API_URL}?action=getCalendar&house=${currentHouse}&year=${m.year}&month=${m.month}`;
    const res = await fetch(url);
    const json = await res.json();
    fullMap[`${m.year}-${m.month}`] = json.fullDates || [];
  }

  renderCalendars(months, fullMap);
}


/************************************************
 * 渲染 3 個月日曆
 ************************************************/
function renderCalendars(months, fullMap) {
  calArea.innerHTML = "";

  months.forEach(m => {
    const fullDates = fullMap[`${m.year}-${m.month}`] || [];

    const cal = document.createElement("div");
    cal.className = "calendar";

    const title = document.createElement("div");
    title.className = "cal-title";
    title.textContent = `${m.year} 年 ${m.month} 月`;

    const grid = document.createElement("div");
    grid.className = "cal-grid";

    // 星期標題
    const week = ["日", "一", "二", "三", "四", "五", "六"];
    week.forEach(w => {
      const div = document.createElement("div");
      div.className = "weekday";
      div.textContent = w;
      grid.appendChild(div);
    });

    // 生成日期
    const first = new Date(m.year, m.month - 1, 1);
    const days = new Date(m.year, m.month, 0).getDate();
    const startDay = first.getDay();
    const today = new Date();

    // 前面空格
    for (let i = 0; i < startDay; i++) {
      grid.appendChild(document.createElement("div"));
    }

    // 日期
    for (let day = 1; day <= days; day++) {
      const d = document.createElement("div");
      const dateStr = `${m.year}-${String(m.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateObj = new Date(dateStr);

      d.textContent = day;

      // 過期
      if (dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        d.className = "day-past";
      }
      // 已滿房
      else if (fullDates.includes(dateStr)) {
        d.className = "day-full";
      }
      // 可預訂
      else {
        d.className = "day-available";
        d.addEventListener("click", () => selectDate(dateStr));
      }

      grid.appendChild(d);
    }

    cal.appendChild(title);
    cal.appendChild(grid);
    calArea.appendChild(cal);
  });
}


/************************************************
 * 點日期 → 跳轉到 booking-form.html（帶參數）
 ************************************************/
function selectDate(date) {
  const room = roomTypeSelect.value;
  if (!room) {
    alert("請先選擇房型");
    return;
  }

  const url =
    `booking-form.html?house=${encodeURIComponent(currentHouse)}&room=${encodeURIComponent(room)}&date=${date}`;

  location.href = url;
}
