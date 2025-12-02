const API_URL = "https://script.google.com/macros/s/AKfycbzbJVv5esMv7ltwoXq4FAKoDR9GDwPVREzp4XW7MzRGnhr46gjoFDADfSsUYxoI7Fja/exec";

// 館別對應房型
const houseRooms = {
  "A館": ["包棟"],
  "B館": ["包棟"]
};

// 日期選擇器
flatpickr("#dateRange", {
  mode: "range",
  dateFormat: "Y-m-d",
  locale: "zh_tw",
  minDate: "today",
  onClose: calcPrice
});

// 切換館別帶出房型
document.getElementById("house").addEventListener("change", () => {
  const h = houseRooms[document.getElementById("house").value];
  const roomSel = document.getElementById("roomType");

  roomSel.innerHTML = `<option value="">請選擇</option>`;
  if (h) {
    h.forEach(r => roomSel.innerHTML += `<option value="${r}">${r}</option>`);
  }
});

// 計算房價 + 訂金
async function calcPrice() {
  const range = document.getElementById("dateRange").value;
  const house = document.getElementById("house").value;
  const room = document.getElementById("roomType").value;

  if (!range || !house || !room) return;

  const [start, end] = range.split(" 至 ");

  let nights = (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24);
  if (nights < 1) nights = 1;

  let res = await fetch(
    `${API_URL}?action=getPrice&house=${house}&room=${room}&start=${start}&end=${end}`
  );
  res = await res.json();

  if (!res.success) {
    document.getElementById("priceDetail").innerHTML = "系統無法取得房價";
    return;
  }

  const total = res.total;
  const deposit = Math.round(total * 0.5);

  document.getElementById("priceDetail").innerHTML = `
      住宿 ${nights} 晚<br><br>
      房價總額：<b>NT$${total}</b><br><br>
      訂金需付款：<span style="color:red;">NT$${deposit}</span>
  `;
}

// 送出預訂
document.getElementById("btnSubmit").addEventListener("click", async () => {
  const range = document.getElementById("dateRange").value;
  const house = document.getElementById("house").value;
  const room = document.getElementById("roomType").value;

  if (!range || !house || !room) {
    alert("請完整填寫資料");
    return;
  }

  const [start] = range.split(" 至 ");

  const data = {
    action: "createBooking",
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    email: document.getElementById("email").value,
    house,
    date: start,
    nights: 1,
    adult: document.getElementById("adult").value,
    child: document.getElementById("child").value,
    note: document.getElementById("note").value,
  };

  let res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(data)
  });

  res = await res.json();

  if (res.success) {
    document.querySelector(".container").style.display = "none";
    document.getElementById("resultArea").classList.remove("hidden");
    document.getElementById("resultText").innerText = `訂房成功！訂單編號：${res.id}`;
  } else {
    alert("系統錯誤，請稍後再試。" + res.error);
  }
});
