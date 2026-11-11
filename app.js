(() => {
  'use strict';
  const form = document.querySelector('#repair-form');
  const submitButton = document.querySelector('#submit-button');
  const refreshButton = document.querySelector('#refresh-button');
  const formMessage = document.querySelector('#form-message');
  const listMessage = document.querySelector('#list-message');
  const list = document.querySelector('#request-list');
  const filters = document.querySelector('#urgency-filters');
  const filterMessage = document.querySelector('#filter-message');
  const connectionMessage = document.querySelector('#connection-message');
  let requests = [];
  let selectedUrgency = '全部';
  let client;
  let submitting = false;

  function updateConnection() {
    const offline = !navigator.onLine;
    submitButton.disabled = offline || submitting || !client;
    refreshButton.disabled = offline || !client;
    message(connectionMessage, offline ? '目前離線：可填寫表單，連線後請自行送出；不會自動補送。報修內容不會儲存到裝置，重新載入會清除。' : '', 'error');
  }

  function message(element, text, type = '') {
    element.textContent = text;
    element.className = type ? `message ${type}` : '';
    element.hidden = !text;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  function renderRequest(request) {
    const card = element('article', 'request-card', '');
    const heading = element('div', 'card-heading', '');
    heading.append(element('h3', 'card-title', request.location));
    const badges = element('div', 'badges', '');
    const urgencyClass = { 低: 'low', 中: 'medium', 高: 'high' }[request.urgency] || 'medium';
    badges.append(element('span', 'badge', request.category), element('span', `badge urgency-${urgencyClass}`, `緊急程度：${request.urgency}`), element('span', 'badge', request.status));
    heading.append(badges);
    const meta = element('div', 'request-meta', '');
    meta.append(element('span', '', `報修人：${request.reporter_name}`));
    const date = new Date(request.created_at);
    const time = element('time', '', Number.isNaN(date.getTime()) ? '登記時間不明' : new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Taipei' }).format(date));
    if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString();
    meta.append(time);
    card.append(heading, element('p', 'request-description', request.description), meta);
    return card;
  }

  function renderRequests() {
    const visibleRequests = requests.filter(request => selectedUrgency === '全部' || request.urgency === selectedUrgency);
    list.replaceChildren(...visibleRequests.map(renderRequest));
    message(filterMessage, requests.length && !visibleRequests.length ? `最近 20 筆中沒有緊急程度為「${selectedUrgency}」的報修。` : '');
  }

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-urgency]');
    if (!button) return;
    selectedUrgency = button.dataset.urgency;
    for (const option of filters.querySelectorAll('button')) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    renderRequests();
  });

  async function loadRequests() {
    if (!navigator.onLine) {
      list.setAttribute('aria-busy', 'false');
      message(listMessage, requests.length ? '目前離線，下方為本頁先前載入的紀錄，可能不是最新。' : '目前離線，連線後才能讀取報修清單。');
      updateConnection();
      return;
    }
    refreshButton.disabled = true;
    list.setAttribute('aria-busy', 'true');
    message(listMessage, '正在載入報修紀錄…');
    try {
      const { data, error } = await client.from('repair_requests')
        .select('id,reporter_name,location,category,description,urgency,status,created_at')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
      if (error) throw error;
      requests = data;
      renderRequests();
      message(listMessage, data.length ? '' : '目前還沒有報修紀錄，歡迎填寫第一筆。');
    } catch (error) {
      message(listMessage, `無法載入清單，請按「重新整理」重試。${list.children.length ? '下方保留上次載入的紀錄。' : ''} 錯誤：${error.message || '連線失敗'}`, 'error');
    } finally {
      refreshButton.disabled = !navigator.onLine;
      list.setAttribute('aria-busy', 'false');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!navigator.onLine) {
      updateConnection();
      return;
    }
    if (submitting || !client || !form.reportValidity()) return;
    const values = new FormData(form);
    // Only insert permitted form columns; status, id and created_at use database defaults.
    const payload = Object.fromEntries(['reporter_name', 'location', 'category', 'description', 'urgency'].map(key => [key, String(values.get(key) || '').trim()]));
    if (Object.values(payload).some(value => !value)) {
      message(formMessage, '請完整填寫所有欄位，內容不可只有空白。', 'error');
      return;
    }
    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = '送出中…';
    message(formMessage, '正在送出報修…');
    try {
      const { error } = await client.from('repair_requests').insert(payload);
      if (error) throw error;
      form.reset();
      message(formMessage, '報修已成功登記！', 'success');
      await loadRequests();
    } catch (error) {
      message(formMessage, `送出失敗，已保留填寫內容。請確認連線後再試。錯誤：${error.message || '連線失敗'}`, 'error');
    } finally {
      submitting = false;
      submitButton.disabled = !navigator.onLine;
      submitButton.textContent = '送出報修 ↗';
    }
  });

  try {
    const config = window.REPAIR_CONFIG;
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    refreshButton.addEventListener('click', loadRequests);
    window.addEventListener('offline', () => {
      updateConnection();
      message(listMessage, requests.length ? '目前離線，下方為本頁先前載入的紀錄，可能不是最新。' : '目前離線，連線後才能讀取報修清單。');
    });
    window.addEventListener('online', () => {
      updateConnection();
      loadRequests();
    });
    updateConnection();
    loadRequests();
  } catch {
    submitButton.disabled = true;
    refreshButton.disabled = true;
    list.setAttribute('aria-busy', 'false');
    message(formMessage, '服務初始化失敗，請檢查網路連線與 config.js，重新載入頁面。', 'error');
    message(listMessage, '清單尚未載入。');
  }
})();
