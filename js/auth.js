// CRM Authentication System
class CRMAuth {
  constructor() {
    this.sessionKey = 'crmLoggedIn';
    this.loginTimeKey = 'crmLoginTime';
    this.userIdKey = 'crmUserId';
    this.sessionDuration = 2 * 60 * 60 * 1000; // 2 hours
  }

  // Check if user is authenticated
  isAuthenticated() {
    const isLoggedIn = sessionStorage.getItem(this.sessionKey);
    const loginTime = sessionStorage.getItem(this.loginTimeKey);
    
    if (isLoggedIn === 'true' && loginTime) {
      const timeDiff = Date.now() - parseInt(loginTime);
      return timeDiff < this.sessionDuration;
    }
    
    return false;
  }

  // Get current user info
  getCurrentUser() {
    if (this.isAuthenticated()) {
      return {
        userId: sessionStorage.getItem(this.userIdKey),
        loginTime: parseInt(sessionStorage.getItem(this.loginTimeKey)),
        isLoggedIn: true
      };
    }
    return null;
  }

  // Logout user
  logout() {
    sessionStorage.removeItem(this.sessionKey);
    sessionStorage.removeItem(this.loginTimeKey);
    sessionStorage.removeItem(this.userIdKey);
    window.location.href = 'login.html';
  }

  // Protect page - redirect to login if not authenticated
  protectPage() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  // Check session and extend if needed
  extendSession() {
    if (this.isAuthenticated()) {
      sessionStorage.setItem(this.loginTimeKey, Date.now().toString());
    }
  }

  // Get session remaining time
  getSessionRemainingTime() {
    const loginTime = parseInt(sessionStorage.getItem(this.loginTimeKey));
    if (loginTime) {
      const remaining = this.sessionDuration - (Date.now() - loginTime);
      return Math.max(0, remaining);
    }
    return 0;
  }

  // Format remaining time
  formatRemainingTime() {
    const remaining = this.getSessionRemainingTime();
    if (remaining <= 0) return 'Session expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s remaining`;
    } else {
      return `${seconds}s remaining`;
    }
  }

  // Auto-logout when session expires
  startSessionMonitor() {
    setInterval(() => {
      if (!this.isAuthenticated()) {
        this.logout();
      }
    }, 1000); // Check every second
  }
}

// Global auth instance
window.crmAuth = new CRMAuth();

// Auto-protect CRM pages
document.addEventListener('DOMContentLoaded', function() {
  // Check if current page needs protection
  const protectedPages = ['crm.html'];
  const currentPage = window.location.pathname.split('/').pop();
  
  if (protectedPages.includes(currentPage)) {
    if (!window.crmAuth.protectPage()) {
      return; // Redirected to login
    }
    
    // Start session monitor
    window.crmAuth.startSessionMonitor();
    
    // Add logout functionality if logout button exists
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
          window.crmAuth.logout();
        }
      });
    }
    
    // Display session info if element exists
    const sessionInfo = document.getElementById('session-info');
    if (sessionInfo) {
      const updateSessionInfo = () => {
        const user = window.crmAuth.getCurrentUser();
        if (user) {
          sessionInfo.textContent = `User: ${user.userId} | ${window.crmAuth.formatRemainingTime()}`;
        }
      };
      
      updateSessionInfo();
      setInterval(updateSessionInfo, 1000);
    }
  }
});

console.log('CRM Authentication System initialized');
