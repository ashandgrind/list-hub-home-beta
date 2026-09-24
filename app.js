(function () {
  const SUPABASE_URL = 'https://dphkvcdohqsvefbdhsfx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGt2Y2RvaHFzdmVmYmRoc2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTcxMjIsImV4cCI6MjA5OTU3MzEyMn0.Ts8vvKm8VuOYCgmtKxNQe71Ga2qjUH5jiCSlOe9vxSo';
  const HOUSEHOLD_ID = 'a0000000-0000-4000-8000-000000000001';
  const ACCESS_CODE = 'pollock-beta';
  const GATE_KEY = 'list-hub-gate-v1';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const state = {
    who: localStorage.getItem('list-hub-who') || 'chris',
    slug: localStorage.getItem('list-hub-slug') || 'grocery',
    stores: [], lists: [], items: [], loading: false,
  };
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  function setStatus(msg, isError) {
    const el = $('#status');
    el.textContent = msg || '';
    el.style.color = isError ? 'var(--danger)' : 'var(--muted)';
  }
  function storeById(id) { return state.stores.find((s) => s.id === id) || null; }
  function currentList() { return state.lists.find((l) => l.slug === state.slug) || null; }
  function unlocked() { return sessionStorage.getItem(GATE_KEY) === '1'; }
  function showApp() { $('#gate').classList.add('hidden'); $('#app').classList.remove('hidden'); }
  function showGate() { $('#app').classList.add('hidden'); $('#gate').classList.remove('hidden'); }
  async function loadStores() {
    const { data, error } = await sb.from('lh_stores').select('*').eq('active', true).order('sort_order');
    if (error) throw error;
    state.stores = data || [];
    const sel = $('#item-store');
    sel.innerHTML = '<option value="">Store…</option>' +
      state.stores.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  }
  async function loadLists() {
    const { data, error } = await sb.from('lh_lists').select('*').eq('household_id', HOUSEHOLD_ID).order('slug');
    if (error) throw error;
    state.lists = data || [];
  }
  async function loadItems() {
    const list = currentList();
    if (!list) { state.items = []; return; }
    const { data, error } = await sb.from('lh_items').select('*').eq('list_id', list.id)
      .neq('status', 'dropped').order('sort_order').order('created_at');
    if (error) throw error;
    state.items = data || [];
  }
  async function refresh() {
    state.loading = true; setStatus('Loading…');
    try {
      await Promise.all([loadStores(), loadLists()]);
      await loadItems(); render(); setStatus('');
    } catch (err) {
      console.error(err); setStatus(err.message || 'Failed to load', true);
    } finally { state.loading = false; }
  }
  function escapeHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function render() {
    const list = currentList();
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.slug === state.slug));
    $$('.chip').forEach((c) => c.classList.toggle('active', c.dataset.who === state.who));
    $('#who-line').textContent = list ? `${list.name} · adding as ${cap(state.who)}` : `Adding as ${cap(state.who)}`;
    const finalized = list && list.status === 'finalized';
    $('#finalized-banner').classList.toggle('hidden', !finalized);
    $('#finalize-btn').classList.toggle('hidden', !!finalized);
    $('#reopen-btn').classList.toggle('hidden', !finalized);
    $('#add-form').classList.toggle('hidden', !!finalized);
    const root = $('#items');
    if (!state.items.length) {
      root.innerHTML = '<div class="empty">No items yet. Add something above.</div>';
      return;
    }
    const open = state.items.filter((i) => i.status !== 'checked' && i.status !== 'have');
    const done = state.items.filter((i) => i.status === 'checked' || i.status === 'have');
    if (finalized) {
      const groups = groupByStore([...open, ...done]);
      root.innerHTML = groups.map(([label, items]) =>
        `<section class="group"><div class="group-title">${escapeHtml(label)} · ${items.length}</div>${items.map(renderItem).join('')}</section>`
      ).join('');
    } else {
      root.innerHTML = [
        open.length ? open.map(renderItem).join('') : '<div class="empty">Nothing open on this list.</div>',
        done.length ? `<section class="group"><div class="group-title">Checked · ${done.length}</div>${done.map(renderItem).join('')}</section>` : '',
      ].join('');
    }
    bindItemEvents();
  }
  function groupByStore(items) {
    const map = new Map();
    for (const item of items) {
      const store = storeById(item.preferred_store_id);
      const label = store ? store.name : 'Unassigned';
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(item);
    }
    const order = [...state.stores.map((s) => s.name), 'Unassigned'];
    return order.filter((n) => map.has(n)).map((n) => [n, map.get(n)]);
  }
  function renderItem(item) {
    const store = storeById(item.preferred_store_id);
    const checked = item.status === 'checked' || item.status === 'have';
    const storeOpts = '<option value="">Store…</option>' +
      state.stores.map((s) =>
        `<option value="${s.id}" ${item.preferred_store_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
      ).join('');
    return `<article class="item ${checked ? 'checked' : ''}" data-id="${item.id}">
      <div class="item-main">
        <button class="check-btn" type="button" data-action="toggle" aria-label="Check off">${checked ? '✓' : ''}</button>
        <div class="item-body">
          <div class="item-name">${escapeHtml(item.name)}</div>
          <div class="item-meta">
            ${item.qty ? `<span class="badge">${escapeHtml(item.qty)}</span>` : ''}
            <span class="badge">${escapeHtml(cap(item.created_by || 'chris'))}</span>
            ${item.discreet ? '<span class="badge discreet">Discreet</span>' : ''}
            ${store && !checked ? `<span class="badge">${escapeHtml(store.name)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="item-actions">
        <select data-action="store">${storeOpts}</select>
        <button class="btn danger sm" type="button" data-action="delete">Delete</button>
      </div>
    </article>`;
  }
  function bindItemEvents() {
    $$('.item').forEach((el) => {
      const id = el.dataset.id;
      el.querySelector('[data-action="toggle"]').onclick = () => toggleItem(id);
      el.querySelector('[data-action="delete"]').onclick = () => deleteItem(id);
      el.querySelector('[data-action="store"]').onchange = (e) => setStore(id, e.target.value || null);
    });
  }
  async function addItem(e) {
    e.preventDefault();
    const list = currentList();
    if (!list) return setStatus('No list selected', true);
    if (list.status === 'finalized') return setStatus('List is finalized — re-open to add', true);
    const name = $('#item-name').value.trim();
    if (!name) return;
    const qty = $('#item-qty').value.trim() || null;
    const preferred_store_id = $('#item-store').value || null;
    const discreet = $('#item-discreet').checked;
    setStatus('Adding…');
    const { error } = await sb.from('lh_items').insert({
      list_id: list.id, name, qty, preferred_store_id, discreet,
      status: 'needed', created_by: state.who,
    });
    if (error) return setStatus(error.message, true);
    $('#item-name').value = ''; $('#item-qty').value = '';
    $('#item-store').value = ''; $('#item-discreet').checked = false;
    await loadItems(); render(); setStatus('Added'); $('#item-name').focus();
  }
  async function toggleItem(id) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    const next = (item.status === 'checked' || item.status === 'have') ? 'needed' : 'checked';
    const { error } = await sb.from('lh_items').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return setStatus(error.message, true);
    await loadItems(); render();
  }
  async function setStore(id, storeId) {
    const { error } = await sb.from('lh_items').update({ preferred_store_id: storeId, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return setStatus(error.message, true);
    await loadItems(); render();
  }
  async function deleteItem(id) {
    if (!confirm('Delete this item?')) return;
    const { error } = await sb.from('lh_items').delete().eq('id', id);
    if (error) return setStatus(error.message, true);
    await loadItems(); render(); setStatus('Deleted');
  }
  async function finalizeList() {
    const list = currentList();
    if (!list) return;
    if (!confirm(`Finalize ${list.name}? You can still check items and group by store.`)) return;
    const { error } = await sb.from('lh_lists').update({
      status: 'finalized', finalized_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', list.id);
    if (error) return setStatus(error.message, true);
    await loadLists(); render(); setStatus('List finalized');
  }
  async function reopenList() {
    const list = currentList();
    if (!list) return;
    const { error } = await sb.from('lh_lists').update({
      status: 'open', finalized_at: null, updated_at: new Date().toISOString(),
    }).eq('id', list.id);
    if (error) return setStatus(error.message, true);
    await loadLists(); render(); setStatus('List re-opened');
  }
  function wire() {
    $('#gate-btn').onclick = () => {
      const val = ($('#access-code').value || '').trim();
      if (val === ACCESS_CODE) {
        sessionStorage.setItem(GATE_KEY, '1');
        $('#gate-error').classList.add('hidden');
        showApp(); refresh();
      } else {
        const err = $('#gate-error');
        err.textContent = 'Wrong access code';
        err.classList.remove('hidden');
      }
    };
    $('#access-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#gate-btn').click(); });
    $('#lock-btn').onclick = () => {
      sessionStorage.removeItem(GATE_KEY); showGate();
      $('#access-code').value = ''; $('#access-code').focus();
    };
    $$('.tab').forEach((t) => {
      t.onclick = () => {
        state.slug = t.dataset.slug;
        localStorage.setItem('list-hub-slug', state.slug);
        loadItems().then(render).catch((err) => setStatus(err.message, true));
      };
    });
    $$('.chip').forEach((c) => {
      c.onclick = () => {
        state.who = c.dataset.who;
        localStorage.setItem('list-hub-who', state.who);
        render();
      };
    });
    $('#add-form').onsubmit = addItem;
    $('#finalize-btn').onclick = finalizeList;
    $('#reopen-btn').onclick = reopenList;
  }
  wire();
  if (unlocked()) { showApp(); refresh(); }
  else { showGate(); setTimeout(() => $('#access-code').focus(), 50); }
})();
