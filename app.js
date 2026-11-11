(() => {
  'use strict';
  const form = document.querySelector('#repair-form');
  const submitButton = document.querySelector('#submit-button');
  const refreshButton = document.querySelector('#refresh-button');
  const formMessage = document.querySelector('#form-message');
  const listMessage = document.querySelector('#list-message');
  const list = document.querySelector('#request-list');
  let client;
  let submitting = false;

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

  async function loadRequests() {
    refreshButton.disabled = true;
    list.setAttribute('aria-busy', 'true');
    message(listMessage, '正在載入報修紀錄…');
    try {
      const { data, error } = await client.from('repair_requests')
        .select('id,reporter_name,location,category,description,urgency,status,created_at')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
      if (error) throw error;
      list.replaceChildren(...data.map(renderRequest));
      message(listMessage, data.length ? '' : '目前還沒有報修紀錄，歡迎填寫第一筆。');
    } catch (error) {
      message(listMessage, `無法載入清單，請按「重新整理」重試。${list.children.length ? '下方保留上次載入的紀錄。' : ''} 錯誤：${error.message || '連線失敗'}`, 'error');
    } finally {
      refreshButton.disabled = false;
      list.setAttribute('aria-busy', 'false');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
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
      submitButton.disabled = false;
      submitButton.textContent = '送出報修 ↗';
    }
  });

  try {
    const config = window.REPAIR_CONFIG;
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    refreshButton.addEventListener('click', loadRequests);
    loadRequests();
  } catch {
    submitButton.disabled = true;
    refreshButton.disabled = true;
    list.setAttribute('aria-busy', 'false');
    message(formMessage, '服務初始化失敗，請檢查網路連線與 config.js，重新載入頁面。', 'error');
    message(listMessage, '清單尚未載入。');
  }
})();
