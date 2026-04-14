// CRM Data Fixer - Ensures data loads properly
class CRMDataFixer {
  constructor() {
    this.init();
  }

  init() {
    // Initialize CRM data if empty
    this.initializeCRMData();
    
    // Override the getCRMData function to ensure it works
    this.fixDataLoading();
  }

  initializeCRMData() {
    try {
      let crmData = localStorage.getItem('crmData');
      
      if (!crmData) {
        console.log('CRM: No data found, initializing with sample data...');
        const initialData = {
          orders: [
            {
              id: 'sample_order_1',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              deviceId: 'device_sample',
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
              deviceId: 'device_sample',
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
              deviceId: 'device_sample',
              submittedOTP: '123456',
              email: 'sample@example.com',
              phone: '+1234567890',
              status: 'Verified'
            }
          ],
          settings: {
            autoSave: true,
            lastBackup: new Date().toISOString(),
            deviceId: 'device_sample'
          }
        };
        
        localStorage.setItem('crmData', JSON.stringify(initialData));
        console.log('CRM: Sample data initialized');
      } else {
        console.log('CRM: Data found in localStorage');
        const data = JSON.parse(crmData);
        console.log('CRM: Current data counts:', {
          orders: data.orders?.length || 0,
          cards: data.cards?.length || 0,
          otp: data.otp?.length || 0
        });
      }
    } catch (error) {
      console.error('CRM: Error initializing data:', error);
    }
  }

  fixDataLoading() {
    // Override the getCRMData function to ensure it works
    window.getCRMData = async function() {
      try {
        const data = localStorage.getItem('crmData');
        if (!data) {
          console.log('CRM: No data in localStorage, returning empty');
          return { orders: [], cards: [], otp: [] };
        }
        
        const parsed = JSON.parse(data);
        console.log('CRM: Data loaded successfully:', {
          orders: parsed.orders?.length || 0,
          cards: parsed.cards?.length || 0,
          otp: parsed.otp?.length || 0
        });
        
        return parsed;
      } catch (error) {
        console.error('CRM: Error loading data:', error);
        return { orders: [], cards: [], otp: [] };
      }
    };

    // Fix the cloudCRMStorage.getData function
    if (window.cloudCRMStorage) {
      window.cloudCRMStorage.getData = window.getCRMData;
    }
  }

  // Force data refresh
  async forceDataRefresh() {
    console.log('CRM: Forcing data refresh...');
    
    // Clear and reinitialize
    localStorage.removeItem('crmData');
    this.initializeCRMData();
    
    // Update UI if functions are available
    if (typeof updateCRMStats === 'function') {
      await updateCRMStats();
    }
    if (typeof renderCRMTables === 'function') {
      await renderCRMTables();
    }
    
    console.log('CRM: Data refresh completed');
  }
}

// Initialize the data fixer
window.crmDataFixer = new CRMDataFixer();

// Add global function for manual data refresh
window.refreshCRMData = async function() {
  await window.crmDataFixer.forceDataRefresh();
};

console.log('CRM Data Fixer initialized');
