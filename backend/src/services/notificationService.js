const { query } = require('../../config/database');

// Email configuration (optional - remove if not using email notifications)
const nodemailer = require('nodemailer');

// Email transporter (configure in .env)
const createEmailTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  };

  return nodemailer.createTransporter(config);
};

// Send email notification
const sendEmailNotification = async (to, subject, htmlContent) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email credentials not configured, skipping email notification');
      return false;
    }

    const transporter = createEmailTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || `'Leave Management' <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
};

// Create in-app notification
const createInAppNotification = async (userId, leaveRequestId, title, message, type) => {
  try {
    const result = await query(`
      INSERT INTO notifications (user_id, leave_request_id, title, message, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `, [userId, leaveRequestId, title, message, type]);

    return result.rows[0];
  } catch (error) {
    console.error('Failed to create in-app notification:', error);
    throw error;
  }
};

// Notify user about leave request status change
const notifyLeaveRequestStatus = async (leaveRequest, newStatus, approver, comments) => {
  try {
    const notifications = [];

    // Get leave request details with user info
    const requestDetails = await query(`
      SELECT lr.*, u.email, u.first_name, u.last_name,
             lt.name as leave_type_name,
             m.first_name as manager_first_name, m.last_name as manager_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users m ON lr.manager_id = m.id
      WHERE lr.id = $1
    `, [leaveRequest.id]);

    if (requestDetails.rows.length === 0) {
      throw new Error('Leave request not found');
    }

    const request = requestDetails.rows[0];
    const employeeName = `${request.first_name} ${request.last_name}`;
    const approverName = `${approver.firstName} ${approver.lastName}`;

    let notificationTitle = '';
    let notificationMessage = '';
    let htmlContent = '';

    const dateRange = `${new Date(request.start_date).toLocaleDateString()} to ${new Date(request.end_date).toLocaleDateString()}`;

    // Generate notification content based on status
    switch (newStatus) {
      case 'manager_approved':
        notificationTitle = 'Leave Request Approved by Manager';
        notificationMessage = `Your ${request.leave_type_name} leave request (${dateRange}) has been approved by ${approverName}`;
        htmlContent = generateApprovalEmailTemplate(employeeName, request, approverName, 'Manager', dateRange, comments);
        break;

      case 'manager_rejected':
        notificationTitle = 'Leave Request Rejected by Manager';
        notificationMessage = `Your ${request.leave_type_name} leave request (${dateRange}) has been rejected by ${approverName}`;
        htmlContent = generateRejectionEmailTemplate(employeeName, request, approverName, 'Manager', dateRange, comments);
        break;

      case 'admin_approved':
        notificationTitle = 'Leave Request Finally Approved';
        notificationMessage = `Your ${request.leave_type_name} leave request (${dateRange}) has been finally approved`;
        htmlContent = generateApprovalEmailTemplate(employeeName, request, approverName, 'Administrator', dateRange, comments);
        break;

      case 'admin_rejected':
        notificationTitle = 'Leave Request Rejected by Administrator';
        notificationMessage = `Your ${request.leave_type_name} leave request (${dateRange}) has been rejected by ${approverName}`;
        htmlContent = generateRejectionEmailTemplate(employeeName, request, approverName, 'Administrator', dateRange, comments);
        break;

      case 'cancelled':
        notificationTitle = 'Leave Request Cancelled';
        notificationMessage = `Your ${request.leave_type_name} leave request (${dateRange}) has been cancelled`;
        htmlContent = generateCancellationEmailTemplate(employeeName, request, dateRange);
        break;

      default:
        return; // No notification for other status changes
    }

    // Create in-app notification
    const inAppNotification = await createInAppNotification(
      request.user_id,
      request.id,
      notificationTitle,
      notificationMessage,
      newStatus.includes('approved') ? 'approved' : 'rejected'
    );

    notifications.push({ type: 'in-app', notification: inAppNotification });

    // Send email notification if configured
    if (request.email) {
      const emailSent = await sendEmailNotification(
        request.email,
        notificationTitle,
        htmlContent
      );

      if (emailSent) {
        notifications.push({ type: 'email', sent: true });
      }
    }

    // Update notification record to mark email as sent
    if (inAppNotification && notifications.find(n => n.type === 'email')) {
      await query(
        'UPDATE notifications SET email_sent = true WHERE id = $1',
        [inAppNotification.id]
      );
    }

    return notifications;

  } catch (error) {
    console.error('Failed to send leave request status notification:', error);
    throw error;
  }
};

// Notify manager/admin about new request
const notifyNewLeaveRequest = async (leaveRequest, submitter) => {
  try {
    const notifications = [];

    // Get manager details
    if (leaveRequest.manager_id) {
      const managerDetails = await query(
        'SELECT email, first_name FROM users WHERE id = $1',
        [leaveRequest.manager_id]
      );

      if (managerDetails.rows.length > 0) {
        const manager = managerDetails.rows[0];
        const submitterName = `${submitter.firstName} ${submitter.lastName}`;
        const dateRange = `${new Date(leaveRequest.start_date).toLocaleDateString()} to ${new Date(leaveRequest.end_date).toLocaleDateString()}`;

        const notificationTitle = 'New Leave Request Submitted';
        const notificationMessage = `${submitterName} has submitted a leave request for review (${dateRange})`;
        const htmlContent = generateNewRequestEmailTemplate(manager.first_name, submitterName, leaveRequest, dateRange);

        // Create in-app notification for manager
        const inAppNotification = await createInAppNotification(
          leaveRequest.manager_id,
          leaveRequest.id,
          notificationTitle,
          notificationMessage,
          'request_submitted'
        );

        notifications.push({ type: 'in-app', notification: inAppNotification, recipient: 'manager' });

        // Send email to manager if configured
        if (manager.email) {
          const emailSent = await sendEmailNotification(
            manager.email,
            notificationTitle,
            htmlContent
          );

          if (emailSent) {
            notifications.push({ type: 'email', sent: true, recipient: 'manager' });
          }
        }
      }
    }

    // Get admin for notification if no manager (auto-approve scenario)
    if (!leaveRequest.manager_id) {
      const adminResult = await query(
        "SELECT id, email, first_name FROM users WHERE role = 'admin' LIMIT 1"
      );

      if (adminResult.rows.length > 0) {
        const admin = adminResult.rows[0];
        const submitterName = `${submitter.firstName} ${submitter.lastName}`;

        const notificationTitle = 'Leave Request Auto-Approved';
        const notificationMessage = `${submitterName}'s leave request has been auto-approved (no manager assigned)`;

        const inAppNotification = await createInAppNotification(
          admin.id,
          leaveRequest.id,
          notificationTitle,
          notificationMessage,
          'approved'
        );

        notifications.push({ type: 'in-app', notification: inAppNotification, recipient: 'admin' });
      }
    }

    return notifications;

  } catch (error) {
    console.error('Failed to send new request notification:', error);
    throw error;
  }
};

// Email template generators
const generateApprovalEmailTemplate = (employeeName, request, approverName, approverRole, dateRange, comments) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
        <h2 style="color: #28a745; margin: 0;">Leave Request Approved</h2>
      </div>
      <div style="padding: 20px;">
        <p>Dear ${employeeName},</p>
        <p>Your leave request has been approved!</p>
        <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Leave Type:</strong> ${request.leave_type_name}</p>
          <p><strong>Duration:</strong> ${dateRange}</p>
          <p><strong>Total Days:</strong> ${request.total_days} day(s)</p>
          <p><strong>Approved by:</strong> ${approverName} (${approverRole})</p>
          ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
        </div>
        <p>Please ensure proper handoff of your responsibilities during your absence.</p>
        <p>Best regards,<br>Leave Management System</p>
      </div>
    </div>
  `;
};

const generateRejectionEmailTemplate = (employeeName, request, approverName, approverRole, dateRange, comments) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
        <h2 style="color: #dc3545; margin: 0;">Leave Request Rejected</h2>
      </div>
      <div style="padding: 20px;">
        <p>Dear ${employeeName},</p>
        <p>We regret to inform you that your leave request has been rejected.</p>
        <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Leave Type:</strong> ${request.leave_type_name}</p>
          <p><strong>Requested Dates:</strong> ${dateRange}</p>
          <p><strong>Rejected by:</strong> ${approverName} (${approverRole})</p>
          <p><strong>Reason:</strong> ${comments}</p>
        </div>
        <p>Please consider submitting a new request if needed.</p>
        <p>Best regards,<br>Leave Management System</p>
      </div>
    </div>
  `;
};

const generateNewRequestEmailTemplate = (managerName, submitterName, request, dateRange) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
        <h2 style="color: #007bff; margin: 0;">New Leave Request</h2>
      </div>
      <div style="padding: 20px;">
        <p>Dear ${managerName},</p>
        <p>A new leave request has been submitted for your review.</p>
        <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Employee:</strong> ${submitterName}</p>
          <p><strong>Leave Type:</strong> ${request.leave_type_name}</p>
          <p><strong>Duration:</strong> ${dateRange}</p>
          <p><strong>Total Days:</strong> ${request.total_days} day(s)</p>
          ${request.reason ? `<p><strong>Reason:</strong> ${request.reason}</p>` : ''}
          ${request.emergency ? '<p style="color: #dc3545;"><strong>⚠️ This is marked as an emergency request</strong></p>' : ''}
        </div>
        <p>Please review and approve/reject this request through the system.</p>
        <p>Best regards,<br>Leave Management System</p>
      </div>
    </div>
  `;
};

const generateCancellationEmailTemplate = (employeeName, request, dateRange) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
        <h2 style="color: #6c757d; margin: 0;">Leave Request Cancelled</h2>
      </div>
      <div style="padding: 20px;">
        <p>Dear ${employeeName},</p>
        <p>Your leave request has been cancelled.</p>
        <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Leave Type:</strong> ${request.leave_type_name}</p>
          <p><strong>Cancelled Dates:</strong> ${dateRange}</p>
        </div>
        <p>If this was not intentional, please submit a new request.</p>
        <p>Best regards,<br>Leave Management System</p>
      </div>
    </div>
  `;
};

// Notify managers about new user registration
const notifyNewUserRegistration = async (user) => {
  try {
    const notifications = [];

    // Get all managers and admins for notification
    const managersResult = await query(
      "SELECT id, email, first_name, role FROM users WHERE role IN ('manager', 'admin') AND is_active = true"
    );

    for (const manager of managersResult.rows) {
      const managerName = manager.first_name;
      const userName = `${user.first_name} ${user.last_name}`;

      const notificationTitle = 'New User Registration Pending Approval';
      const notificationMessage = `${userName} has registered and is waiting for account approval`;
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h2 style="color: #007bff; margin: 0;">New User Registration</h2>
          </div>
          <div style="padding: 20px;">
            <p>Dear ${managerName},</p>
            <p>A new user has registered and requires approval to access the system.</p>
            <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>Role:</strong> ${user.role}</p>
              <p><strong>Department:</strong> ${user.department || 'Not specified'}</p>
            </div>
            <p>Please review and approve this account through the admin panel.</p>
            <p>Best regards,<br>Leave Management System</p>
          </div>
        </div>
      `;

      // Create in-app notification
      const inAppNotification = await createInAppNotification(
        manager.id,
        null, // No leave request ID
        notificationTitle,
        notificationMessage,
        'new_registration'
      );

      notifications.push({ type: 'in-app', notification: inAppNotification, recipient: manager });

      // Send email to manager if configured
      if (manager.email) {
        const emailSent = await sendEmailNotification(
          manager.email,
          notificationTitle,
          htmlContent
        );

        if (emailSent) {
          notifications.push({ type: 'email', sent: true, recipient: manager });
          await query(
            'UPDATE notifications SET email_sent = true WHERE id = $1',
            [inAppNotification.id]
          );
        }
      }
    }

    return notifications;
  } catch (error) {
    console.error('Failed to send new user registration notification:', error);
    throw error;
  }
};

// Notify user about account approval/rejection
const notifyUserStatusUpdate = async (user, newStatus, approver) => {
  try {
    const notifications = [];
    const userName = `${user.first_name} ${user.last_name}`;
    const approverName = `${approver.first_name} ${approver.last_name}`;

    let notificationTitle = '';
    let notificationMessage = '';
    let htmlContent = '';

    if (newStatus === 'approved') {
      notificationTitle = 'Account Approved';
      notificationMessage = `Your account has been approved. You can now log in to the Leave Management System.`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h2 style="color: #28a745; margin: 0;">Account Approved</h2>
          </div>
          <div style="padding: 20px;">
            <p>Dear ${userName},</p>
            <p>Congratulations! Your account has been approved and you can now access the Leave Management System.</p>
            <p>Approved by: ${approverName} (${approver.role})</p>
            <p>You can now log in with your registered email and start managing your leave requests.</p>
            <p>Best regards,<br>Leave Management System Support</p>
          </div>
        </div>
      `;
    } else if (newStatus === 'rejected') {
      notificationTitle = 'Account Request Rejected';
      notificationMessage = `Your account registration has been rejected. Please contact your administrator for more information.`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h2 style="color: #dc3545; margin: 0;">Account Request Rejected</h2>
          </div>
          <div style="padding: 20px;">
            <p>Dear ${userName},</p>
            <p>We regret to inform you that your account registration has been rejected.</p>
            <p>Please contact ${approverName} (${approver.role}) or system administrator for further details.</p>
            <p>Best regards,<br>Leave Management System Support</p>
          </div>
        </div>
      `;
    } else {
      return; // No notification for other status updates
    }

    // Create in-app notification
    const inAppNotification = await createInAppNotification(
      user.id,
      null, // No leave request ID
      notificationTitle,
      notificationMessage,
      newStatus === 'approved' ? 'approved' : 'rejected'
    );

    notifications.push({ type: 'in-app', notification: inAppNotification });

    // Send email notification if configured
    if (user.email) {
      const emailSent = await sendEmailNotification(
        user.email,
        notificationTitle,
        htmlContent
      );

      if (emailSent) {
        notifications.push({ type: 'email', sent: true });
        await query(
          'UPDATE notifications SET email_sent = true WHERE id = $1',
          [inAppNotification.id]
        );
      }
    }

    return notifications;
  } catch (error) {
    console.error('Failed to send user status update notification:', error);
    throw error;
  }
};

module.exports = {
  createInAppNotification,
  notifyLeaveRequestStatus,
  notifyNewLeaveRequest,
  sendEmailNotification,
  notifyNewUserRegistration,
  notifyUserStatusUpdate
};