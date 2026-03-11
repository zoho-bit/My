// ------------------ Instance अलग करने के लिए नाम ------------------
let INSTANCE_NAME = localStorage.getItem('hp_instance_name');

if (!INSTANCE_NAME) {
  let nameInput = prompt(
    "इस टैब/इंस्टेंस का नाम डालो (उदाहरण: tab1, phoneA, mypanel2, insta1 आदि)\n" +
    "अलग-अलग टैब में अलग नाम डालना जरूरी है वरना conflict होगा!\n" +
    "(खाली छोड़ने पर रैंडम नाम बन जाएगा)",
    ""
  );

  if (!nameInput || nameInput.trim() === "") {
    nameInput = "default_" + Math.random().toString(36).substring(2, 9);
  } else {
    nameInput = nameInput.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  INSTANCE_NAME = nameInput;
  localStorage.setItem('hp_instance_name', INSTANCE_NAME);
  alert("इस इंस्टेंस का नाम सेट हो गया: " + INSTANCE_NAME + "\nअब अलग टैब में दूसरा नाम डालकर चलाओ");
}

const getKey = (base) => `hp_${base}_${INSTANCE_NAME}`;

const STATE_KEY   = getKey('isOn');
const USED_KEY    = getKey('used_numbers');
const ACTIVE_KEY  = getKey('active_numbers');

// ----------------------------------------------------

const API_KEY    = "9f67f5ed7e8eef95214e93e2da6b3465";
const BASE_URL   = "https://api.grizzlysms.com/stubs/handler_api.php";
const SERVICE    = "swr";
const COUNTRY    = "22";
const MAX_PRICE  = "80";

let isOn = localStorage.getItem(STATE_KEY) === 'true';
let usedNumbers = JSON.parse(localStorage.getItem(USED_KEY) || '[]');
let activeNumbers = JSON.parse(localStorage.getItem(ACTIVE_KEY) || '[]');

const toggleBtn   = document.getElementById('toggleBtn');
const statusDiv   = document.getElementById('status');
const numbersDiv  = document.getElementById('numbers');

let interval = null;

function updateUI() {
  toggleBtn.textContent = isOn ? 'OFF Karo' : 'ON Karo';
  toggleBtn.classList.toggle('off', !isOn);
  statusDiv.textContent = isOn ? 'Auto buy fast mode...' : 'Off hai → ON dabao';
}

toggleBtn.onclick = () => {
  isOn = !isOn;
  localStorage.setItem(STATE_KEY, isOn ? 'true' : 'false');
  updateUI();
  if (isOn) startFetching();
  else stopFetching();
};

function saveActive() {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeNumbers));
}

function isValid(phone) {
  if (!phone || phone.length !== 12) return false;
  if (!phone.startsWith("91")) return false;
  if (!/^\d{12}$/.test(phone)) return false;
  if (usedNumbers.includes(phone)) return false;

  usedNumbers.push(phone);
  localStorage.setItem(USED_KEY, JSON.stringify(usedNumbers));
  return true;
}

function cleanStorage() {
  const now = Date.now();
  activeNumbers = activeNumbers.filter(item =>
    item.phone && item.phone.length === 12 &&
    item.phone.startsWith("91") &&
    (now - item.startTime) < 300000
  );
  saveActive();
}

function renderSaved() {
  cleanStorage();
  numbersDiv.innerHTML = '';

  activeNumbers
    .sort((a, b) => b.startTime - a.startTime)
    .forEach(item => {
      const box = createNumberBox(item.phone.slice(2), item.id, item.startTime, item.otp);
      numbersDiv.appendChild(box);

      // Timer और Polling दोनों refresh के बाद भी सही से चालू रहें
      startTimer(box, item.startTime);
      if (!item.otp) {
        startPolling(box, item.id);
      }
    });
}

function flashBoxRed(box) {
  box.classList.add('copied-flash');
  setTimeout(() => box.classList.remove('copied-flash'), 1500);
}

function createNumberBox(num10, id, startTime, otp = null) {
  const box = document.createElement('div');
  box.className = 'numbox';
  box.dataset.id = id;

  const clickedKey = `copy_${id}_${INSTANCE_NAME}`;
  const clickedClass = localStorage.getItem(clickedKey) === 'once' ? 'clicked-once' : '';

  box.innerHTML = `
    <div class="top-row">
      <div class="phone10">${num10}</div>
      <button class="copy-number-btn ${clickedClass}">Copy No.</button>
    </div>

    <div class="otp-area ${otp ? '' : 'rotating'}">
      <div class="otp ${otp ? 'success' : 'waiting'}">
        ${otp || 'Waiting for OTP...'}
      </div>
      <button class="copy-otp-btn">Copy OTP</button>
    </div>

    <div class="timer">05:00</div>
  `;

  const phoneEl = box.querySelector('.phone10');
  const copyNumBtn = box.querySelector('.copy-number-btn');

  const copyNumberAction = () => {
    navigator.clipboard.writeText(num10).catch(() => {});
    flashBoxRed(box);

    if (copyNumBtn.classList.contains('clicked-once')) {
      copyNumBtn.classList.remove('clicked-once');
      localStorage.removeItem(clickedKey);
    } else {
      copyNumBtn.classList.add('clicked-once');
      localStorage.setItem(clickedKey, 'once');
    }
  };

  phoneEl.onclick = copyNumberAction;
  copyNumBtn.onclick = copyNumberAction;

  const copyOtpBtn = box.querySelector('.copy-otp-btn');
  copyOtpBtn.onclick = () => {
    const otpText = box.querySelector('.otp').textContent.trim();
    if (otpText && !otpText.includes('Waiting') && !otpText.includes('wait')) {
      navigator.clipboard.writeText(otpText).catch(() => {});
      copyOtpBtn.textContent = "Copied!";
      setTimeout(() => copyOtpBtn.textContent = "Copy OTP", 1800);
    }
  };

  return box;
}

function startTimer(box, startTime) {
  const timerEl = box.querySelector('.timer');

  function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    let remaining = 300 - elapsed;

    if (remaining <= 0) {
      box.remove();
      activeNumbers = activeNumbers.filter(i => i.id !== box.dataset.id);
      saveActive();
      return;
    }

    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }

  updateTimer(); // तुरंत अपडेट
  const timerInterval = setInterval(updateTimer, 980);

  // Cleanup (page छोड़ने पर)
  const cleanup = () => clearInterval(timerInterval);
  window.addEventListener('beforeunload', cleanup, { once: true });
  // box हटने पर भी रोक दो
  const observer = new MutationObserver(() => {
    if (!document.body.contains(box)) {
      clearInterval(timerInterval);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function startPolling(box, id) {
  const otpEl = box.querySelector('.otp');
  const otpArea = box.querySelector('.otp-area');

  const poll = setInterval(async () => {
    const params = new URLSearchParams({ api_key: API_KEY, action: 'getStatus', id });
    try {
      const res = await fetch(BASE_URL + '?' + params);
      const text = (await res.text()).trim();

      if (text.startsWith('STATUS_OK')) {
        const code = text.split(':')[1];
        otpEl.textContent = code;
        otpEl.classList.add('success');
        otpArea.classList.remove('rotating');
        clearInterval(poll);

        const itemIndex = activeNumbers.findIndex(i => i.id === id);
        if (itemIndex !== -1) {
          activeNumbers[itemIndex].otp = code;
          saveActive();
        }
      }
    } catch {
      // silent
    }
  }, 1800);

  // Cleanup
  const cleanup = () => clearInterval(poll);
  window.addEventListener('beforeunload', cleanup, { once: true });

  const observer = new MutationObserver(() => {
    if (!document.body.contains(box)) {
      clearInterval(poll);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

async function fetchNumber() {
  if (!isOn) return;

  const params = new URLSearchParams({
    api_key: API_KEY,
    action: 'getNumber',
    service: SERVICE,
    country: COUNTRY,
    maxPrice: MAX_PRICE
  });

  try {
    const res = await fetch(BASE_URL + '?' + params);
    const text = (await res.text()).trim();

    if (text.startsWith('ACCESS_NUMBER')) {
      const [, id, full] = text.split(':');
      if (!isValid(full)) return;

      const startTime = Date.now();
      const item = { id, phone: full, startTime, otp: null };
      activeNumbers.unshift(item);
      saveActive();

      const box = createNumberBox(full.slice(2), id, startTime);
      numbersDiv.prepend(box);

      startTimer(box, startTime);
      startPolling(box, id);
    }
  } catch {
    // silent
  }
}

function startFetching() {
  fetchNumber();
  interval = setInterval(fetchNumber, 1200);
}

function stopFetching() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

// Initialize
updateUI();
renderSaved();
if (isOn) startFetching();
