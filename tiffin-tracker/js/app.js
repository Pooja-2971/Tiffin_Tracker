(function () {
  // ---------- Elements ----------
  const loginScreen = document.getElementById('login-screen');
  const appEl = document.getElementById('app');
  const regNameInput = document.getElementById('reg-name');
  const regPassInput = document.getElementById('reg-pass');
  const loginBtn = document.getElementById('login-btn');
  const signupBtn = document.getElementById('signup-btn');
  const loginError = document.getElementById('login-error');
  const registerLabel = document.getElementById('register-label');
  const switchBtn = document.getElementById('switch-btn');
  const accountBtn = document.getElementById('account-btn');
  const accountPanel = document.getElementById('account-panel');
  const accCurrentPass = document.getElementById('acc-current-pass');
  const accNewPass = document.getElementById('acc-new-pass');
  const savePassBtn = document.getElementById('save-pass-btn');
  const deleteAccountBtn = document.getElementById('delete-account-btn');
  const accountError = document.getElementById('account-error');
  const accountSuccess = document.getElementById('account-success');
  const colorDayInput = document.getElementById('color-day');
  const colorNightInput = document.getElementById('color-night');
  const applyColorsBtn = document.getElementById('apply-colors-btn');
  const resetColorsBtn = document.getElementById('reset-colors-btn');

  const priceInput = document.getElementById('price-input');
  const prevBtn = document.getElementById('prev-month');
  const nextBtn = document.getElementById('next-month');
  const monthLabelEl = document.getElementById('month-label');
  const monthCaptionEl = document.getElementById('month-caption');
  const listEl = document.getElementById('tiffin-list');
  const dayCountEl = document.getElementById('day-count');
  const nightCountEl = document.getElementById('night-count');
  const totalCountEl = document.getElementById('total-count');
  const amountEl = document.getElementById('amount');

  // ---------- Theme ----------
  const themeToggleBtn = document.getElementById('theme-toggle');
  const THEME_KEY = 'tiffin:theme';

  function applyTheme(theme) {
    document.body.classList.toggle('light-theme', theme === 'light');
    themeToggleBtn.textContent = theme === 'light' ? '☀' : '🌙';
    themeToggleBtn.title = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
  }

  async function loadTheme() {
    let theme = 'dark';
    try {
      const res = await storage.get(THEME_KEY, false);
      if (res && res.value) theme = res.value;
    } catch (e) { /* default dark */ }
    applyTheme(theme);
  }

  async function toggleTheme() {
    const next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
    applyTheme(next);
    try { await storage.set(THEME_KEY, next, false); }
    catch (e) { console.error('Failed to save theme', e); }
    if (typeof registerId !== 'undefined' && registerId) render();
  }

  themeToggleBtn.addEventListener('click', toggleTheme);
  loadTheme();

  // ---------- Custom accent colors ----------
  const COLORS_KEY = 'tiffin:colors';
  const DEFAULT_COLORS = { day: '#e7a93e', night: '#c0573e' };

  function shade(hex, percent) {
    // percent negative = darken, positive = lighten
    const num = parseInt(hex.replace('#', ''), 16);
    let r = (num >> 16) + Math.round(255 * percent);
    let g = ((num >> 8) & 0x00FF) + Math.round(255 * percent);
    let b = (num & 0x0000FF) + Math.round(255 * percent);
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }

  function applyColors(colors) {
    document.body.style.setProperty('--turmeric', colors.day);
    document.body.style.setProperty('--turmeric-deep', shade(colors.day, -0.18));
    document.body.style.setProperty('--spice', colors.night);
    document.body.style.setProperty('--spice-deep', shade(colors.night, -0.18));
    colorDayInput.value = colors.day;
    colorNightInput.value = colors.night;
  }

  async function loadColors() {
    let colors = DEFAULT_COLORS;
    try {
      const res = await storage.get(COLORS_KEY, false);
      if (res && res.value) colors = JSON.parse(res.value);
    } catch (e) { /* default */ }
    applyColors(colors);
  }

  async function saveColors(colors) {
    try { await storage.set(COLORS_KEY, JSON.stringify(colors), false); }
    catch (e) { console.error('Failed to save colors', e); }
  }

  applyColorsBtn.addEventListener('click', async () => {
    const colors = { day: colorDayInput.value, night: colorNightInput.value };
    applyColors(colors);
    await saveColors(colors);
    accountSuccess.textContent = 'Colors updated.';
    accountError.textContent = '';
    if (typeof registerId !== 'undefined' && registerId) render();
  });

  resetColorsBtn.addEventListener('click', async () => {
    applyColors(DEFAULT_COLORS);
    await saveColors(DEFAULT_COLORS);
    accountSuccess.textContent = 'Reset to default colors.';
    accountError.textContent = '';
    if (typeof registerId !== 'undefined' && registerId) render();
  });

  loadColors();

  // ---------- State ----------
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth(); // 0-indexed
  let price = 60;
  let monthData = { day: {}, night: {} };
  let registerId = null;
  let dailyChart = null;
  let splitChart = null;

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const WEEKDAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  // ---------- Key helpers ----------
  function normalizeName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  }
  const regKey = (id) => 'tiffin:register:' + id;
  const priceKey = (id) => 'tiffin:' + id + ':price';
  const monthKey = (id, y, m) => 'tiffin:' + id + ':' + y + '-' + String(m + 1).padStart(2, '0');
  const monthPrefix = (id) => 'tiffin:' + id + ':';

  // ---------- Auth ----------
  async function fetchRegister(id) {
    try {
      const res = await storage.get(regKey(id), true);
      return res ? JSON.parse(res.value) : null;
    } catch (e) {
      return null;
    }
  }

  function setBusy(busy) {
    loginBtn.disabled = busy;
    signupBtn.disabled = busy;
  }

  async function handleSignUp() {
    const rawName = regNameInput.value, rawPass = regPassInput.value;
    loginError.textContent = '';
    if (!rawName.trim() || !rawPass) { loginError.textContent = 'Enter both a register name and a password.'; return; }
    setBusy(true);
    try {
      const id = normalizeName(rawName);
      if (!id) { loginError.textContent = 'Use at least one letter or number in the register name.'; return; }
      const existing = await fetchRegister(id);
      if (existing) { loginError.textContent = 'That register name is already taken — try Log in instead.'; return; }
      const created = { passwordHash: simpleHash(rawPass), displayName: rawName.trim() };
      await storage.set(regKey(id), JSON.stringify(created), true);
      enterRegister(id, created, rawName);
      await bootAfterLogin();
    } catch (e) {
      console.error(e);
      loginError.textContent = 'Something went wrong — please try again.';
    } finally { setBusy(false); }
  }

  async function handleLogin() {
    const rawName = regNameInput.value, rawPass = regPassInput.value;
    loginError.textContent = '';
    if (!rawName.trim() || !rawPass) { loginError.textContent = 'Enter both a register name and a password.'; return; }
    setBusy(true);
    try {
      const id = normalizeName(rawName);
      const existing = await fetchRegister(id);
      if (!existing) { loginError.textContent = 'No register found with that name — try Sign up instead.'; return; }
      if (existing.passwordHash !== simpleHash(rawPass)) { loginError.textContent = "That password doesn't match this register."; return; }
      enterRegister(id, existing, rawName);
      await bootAfterLogin();
    } catch (e) {
      console.error(e);
      loginError.textContent = 'Something went wrong — please try again.';
    } finally { setBusy(false); }
  }

  function enterRegister(id, existing, rawName) {
    registerId = id;
    registerLabel.textContent = 'Register: ' + (existing.displayName || rawName.trim());
    loginScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
  }

  function logOut() {
    registerId = null;
    regPassInput.value = '';
    loginError.textContent = '';
    accountPanel.classList.add('hidden');
    appEl.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }

  async function bootAfterLogin() {
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    await loadPrice();
    await loadMonth();
  }

  // ---------- Account settings ----------
  accountBtn.addEventListener('click', () => {
    accountError.textContent = '';
    accountSuccess.textContent = '';
    accCurrentPass.value = '';
    accNewPass.value = '';
    accountPanel.classList.toggle('hidden');
  });

  savePassBtn.addEventListener('click', async () => {
    accountError.textContent = '';
    accountSuccess.textContent = '';
    const current = accCurrentPass.value;
    const next = accNewPass.value;
    if (!current) { accountError.textContent = 'Enter your current password to confirm changes.'; return; }
    try {
      const existing = await fetchRegister(registerId);
      if (!existing || existing.passwordHash !== simpleHash(current)) {
        accountError.textContent = 'Current password is incorrect.';
        return;
      }
      if (next) existing.passwordHash = simpleHash(next);
      await storage.set(regKey(registerId), JSON.stringify(existing), true);
      accountSuccess.textContent = next ? 'Password updated.' : 'No changes to save.';
      accCurrentPass.value = '';
      accNewPass.value = '';
    } catch (e) {
      console.error(e);
      accountError.textContent = 'Something went wrong — please try again.';
    }
  });

  deleteAccountBtn.addEventListener('click', async () => {
    accountError.textContent = '';
    accountSuccess.textContent = '';
    const current = accCurrentPass.value;
    if (!current) { accountError.textContent = 'Enter your current password to confirm deletion.'; return; }
    if (!confirm('This will permanently delete this register and all its tiffin data. Continue?')) return;
    try {
      const existing = await fetchRegister(registerId);
      if (!existing || existing.passwordHash !== simpleHash(current)) {
        accountError.textContent = 'Current password is incorrect.';
        return;
      }
      const idToDelete = registerId;
      let monthKeys = [];
      try {
        const listed = await storage.list(monthPrefix(idToDelete), true);
        monthKeys = (listed && listed.keys) ? listed.keys : [];
      } catch (e) { monthKeys = []; }
      for (const k of monthKeys) {
        try { await storage.delete(k, true); } catch (e) { /* ignore */ }
      }
      await storage.delete(regKey(idToDelete), true);
      alert('Register deleted.');
      logOut();
    } catch (e) {
      console.error(e);
      accountError.textContent = 'Something went wrong — please try again.';
    }
  });

  // ---------- Price ----------
  async function loadPrice() {
    price = 60;
    try {
      const res = await storage.get(priceKey(registerId), true);
      if (res && res.value) {
        const p = parseFloat(res.value);
        if (!isNaN(p)) price = p;
      }
    } catch (e) { /* keep default */ }
    priceInput.value = price;
  }
  async function savePrice() {
    try { await storage.set(priceKey(registerId), String(price), true); }
    catch (e) { console.error('Failed to save price', e); }
  }
  priceInput.addEventListener('change', () => {
    const p = parseFloat(priceInput.value);
    price = isNaN(p) || p < 0 ? 0 : p;
    priceInput.value = price;
    render();
    savePrice();
  });

  // ---------- Month data ----------
  async function loadMonth() {
    listEl.innerHTML = '<div class="empty-note">Loading…</div>';
    try {
      const res = await storage.get(monthKey(registerId, viewYear, viewMonth), true);
      monthData = res && res.value ? JSON.parse(res.value) : { day: {}, night: {} };
    } catch (e) {
      monthData = { day: {}, night: {} };
    }
    render();
  }
  async function saveMonth() {
    try { await storage.set(monthKey(registerId, viewYear, viewMonth), JSON.stringify(monthData), true); }
    catch (e) { console.error('Failed to save month data', e); }
  }

  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  // ---------- Ledger rendering ----------
  function render() {
    monthLabelEl.textContent = MONTH_NAMES[viewMonth] + ' ' + viewYear;
    monthCaptionEl.textContent = MONTH_NAMES[viewMonth] + "'s bill";

    const total = daysInMonth(viewYear, viewMonth);
    const todayStr = (viewYear === now.getFullYear() && viewMonth === now.getMonth()) ? String(now.getDate()) : null;

    const dailyTotals = [];
    let html = '';
    for (let d = 1; d <= total; d++) {
      const key = String(d);
      const date = new Date(viewYear, viewMonth, d);
      const weekday = WEEKDAY_NAMES[date.getDay()];
      const dayOn = !!monthData.day[key];
      const nightOn = !!monthData.night[key];
      dailyTotals.push((dayOn ? price : 0) + (nightOn ? price : 0));
      const isToday = key === todayStr;
      html += `
        <div class="row${isToday ? ' today' : ''}">
          <div class="datenum">${d}</div>
          <div class="weekday">${weekday}</div>
          <button class="toggle day${dayOn ? ' on' : ''}" data-date="${key}" data-slot="day">Day</button>
          <button class="toggle night${nightOn ? ' on' : ''}" data-date="${key}" data-slot="night">Night</button>
        </div>`;
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const date = btn.getAttribute('data-date');
        const slot = btn.getAttribute('data-slot');
        monthData[slot][date] = !monthData[slot][date];
        if (!monthData[slot][date]) delete monthData[slot][date];
        render();
        saveMonth();
      });
    });

    const dayCount = Object.values(monthData.day).filter(Boolean).length;
    const nightCount = Object.values(monthData.night).filter(Boolean).length;
    dayCountEl.textContent = dayCount;
    nightCountEl.textContent = nightCount;
    totalCountEl.textContent = dayCount + nightCount;
    amountEl.textContent = '₹' + ((dayCount + nightCount) * price).toLocaleString('en-IN');

    renderCharts(dailyTotals, dayCount, nightCount);
  }

  // ---------- Charts ----------
  function renderCharts(dailyTotals, dayCount, nightCount) {
    const styles = getComputedStyle(document.body);
    const inkDim = styles.getPropertyValue('--ink-dim').trim() || '#C9C2AE';
    const turmeric = styles.getPropertyValue('--turmeric').trim() || '#E7A93E';
    const spice = styles.getPropertyValue('--spice').trim() || '#C0573E';
    const gridColor = document.body.classList.contains('light-theme') ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';

    const dailyCtx = document.getElementById('daily-chart').getContext('2d');
    const splitCtx = document.getElementById('split-chart').getContext('2d');
    const labels = dailyTotals.map((_, i) => String(i + 1));

    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(dailyCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Spend (₹)',
          data: dailyTotals,
          backgroundColor: turmeric,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: inkDim, font: { size: 10 } } },
          y: { beginAtZero: true, ticks: { color: inkDim }, grid: { color: gridColor } }
        }
      }
    });

    if (splitChart) splitChart.destroy();
    splitChart = new Chart(splitCtx, {
      type: 'doughnut',
      data: {
        labels: ['Day', 'Night'],
        datasets: [{
          data: [dayCount, nightCount],
          backgroundColor: [turmeric, spice],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: inkDim } } }
      }
    });
  }

  // ---------- Navigation ----------
  prevBtn.addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    loadMonth();
  });
  nextBtn.addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    loadMonth();
  });

  // ---------- Wiring ----------
  loginBtn.addEventListener('click', handleLogin);
  signupBtn.addEventListener('click', handleSignUp);
  regPassInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  regNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') regPassInput.focus(); });
  switchBtn.addEventListener('click', logOut);
})();
