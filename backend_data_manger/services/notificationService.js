class NotificationService {
  constructor() {
    this.emailTransporter = null;
    console.log('📧 Email sending is disabled in backend_data_manger.');
  }

  async sendEmail(notification, user) {
    const recipient = user?.email || 'unknown';
    console.log(`📧 Email disabled: would have sent to ${recipient} | title: ${notification?.title}`);
    return false;
  }

  async processNotificationDelivery(notification, users = []) {
    console.log(`📧 Email delivery disabled: ${users.length} intended recipient(s) skipped.`);
    return {
      successCount: 0,
      failureCount: users.length,
      totalCount: users.length
    };
  }
}

export default new NotificationService();
