// Activity tracking service for frontend
class ActivityTracker {
  private static instance: ActivityTracker;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private sessionId: string | null = null;
  private isTracking = false;

  private constructor() {}

  static getInstance(): ActivityTracker {
    if (!ActivityTracker.instance) {
      ActivityTracker.instance = new ActivityTracker();
    }
    return ActivityTracker.instance;
  }

  // Start tracking activity
  startTracking(sessionId: string) {
    this.sessionId = sessionId;
    this.isTracking = true;
    this.startHeartbeat();
    
    // Track page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Track user activity
    ['mousedown', 'keydown', 'scroll', 'click'].forEach(event => {
      document.addEventListener(event, this.trackActivity);
    });
  }

  // Stop tracking activity
  stopTracking() {
    this.isTracking = false;
    this.stopHeartbeat();
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    ['mousedown', 'keydown', 'scroll', 'click'].forEach(event => {
      document.removeEventListener(event, this.trackActivity);
    });
  }

  // Start heartbeat interval
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      if (this.isTracking && this.sessionId) {
        try {
          const response = await fetch('/api/heartbeat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ session_id: this.sessionId })
          });

          if (!response.ok) {
            console.warn('Heartbeat failed, stopping tracking');
            this.stopTracking();
          }
        } catch (error) {
          console.error('Heartbeat error:', error);
        }
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  // Stop heartbeat interval
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Handle page visibility changes
  private handleVisibilityChange = () => {
    if (document.hidden) {
      // Page is hidden, pause tracking
      this.isTracking = false;
    } else {
      // Page is visible, resume tracking
      this.isTracking = true;
      if (this.sessionId) {
        this.startHeartbeat();
      }
    }
  };

  // Track user activity
  private trackActivity = () => {
    if (!this.isTracking) {
      this.isTracking = true;
    }
  };

  // Logout with proper session cleanup
  async logout() {
    if (this.sessionId) {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ session_id: this.sessionId })
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    
    this.stopTracking();
    this.sessionId = null;
    
    // Note: The redirect will be handled by the App component
    // This allows for proper state cleanup before redirect
  }
}

export default ActivityTracker;
