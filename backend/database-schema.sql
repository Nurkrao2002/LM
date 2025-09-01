-- Leave Management System Database Schema
-- PostgreSQL Database Setup

-- Database already exists, skipping CREATE DATABASE



-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Roles Enum
CREATE TYPE user_role AS ENUM ('employee', 'manager', 'admin');

-- Leave Types Enum - Updated for proper leave structure (only casual and health)
CREATE TYPE leave_type AS ENUM ('casual', 'health');

-- Leave Request Status Enum - Multi-level approval workflow
CREATE TYPE leave_status AS ENUM ('pending', 'hr_pending', 'manager_rejected', 'hr_rejected', 'admin_rejected', 'manager_approved', 'admin_approved', 'cancelled');

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    department VARCHAR(255),
    employee_id VARCHAR(50) UNIQUE,
    date_of_joining DATE,
    status VARCHAR(20) DEFAULT 'pending',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leave Types Configuration Table
CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type leave_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    annual_days INTEGER NOT NULL DEFAULT 0,
    carry_forward_days INTEGER DEFAULT 0,
    max_consecutive_days INTEGER,
    notice_period_days INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leave Balances Table
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    total_days DECIMAL(5,1) NOT NULL,
    used_days DECIMAL(5,1) DEFAULT 0,
    pending_days DECIMAL(5,1) DEFAULT 0,
    remaining_days DECIMAL(5,1) GENERATED ALWAYS AS (total_days - used_days - pending_days) STORED,
    carry_forward_days DECIMAL(5,1) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, leave_type_id, year)
);

-- Leave Requests Table
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(5,1) NOT NULL,
    reason TEXT,
    status leave_status DEFAULT 'pending',
    manager_id UUID REFERENCES users(id),
    admin_id UUID REFERENCES users(id),
    manager_approved_at TIMESTAMP WITH TIME ZONE,
    manager_rejected_at TIMESTAMP WITH TIME ZONE,
    manager_comments TEXT,
    admin_approved_at TIMESTAMP WITH TIME ZONE,
    admin_rejected_at TIMESTAMP WITH TIME ZONE,
    admin_comments TEXT,
    emergency BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT valid_total_days CHECK (total_days > 0)
);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_request_id UUID REFERENCES leave_requests(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'request_submitted', 'manager_review', 'admin_review', 'approved', 'rejected'
    is_read BOOLEAN DEFAULT false,
    email_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences Table
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'notifications', 'appearance', 'system'
    key VARCHAR(100) NOT NULL,
    value JSONB, -- Store different types of values (boolean, string, number, object)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category, key)
);

-- Monthly Leave Usage Table - for tracking monthly limits
CREATE TABLE monthly_leave_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    used_days DECIMAL(5,1) DEFAULT 0,
    max_allowed INTEGER DEFAULT 1, -- 1 day per month per leave type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, leave_type_id, year, month)
);

-- System Settings Table (admin-only)
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'leave_policy', 'notifications', 'ui', 'security'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Leave Types with proper balances
INSERT INTO leave_types (type, name, description, annual_days, carry_forward_days, max_consecutive_days, notice_period_days) VALUES
('casual', 'Casual Leave', 'General personal or short-term absences', 12, 2, 3, 1),
('health', 'Health Leave', 'Medical or health-related absences', 12, 2, 5, 1);

-- Note: Use the backend/scripts/create-admin.js script to create initial admin user

-- Insert default system settings updated for new leave types
INSERT INTO system_settings (key, value, description, category) VALUES
('max_casual_leave_days', '12', 'Maximum casual leave days per year', 'leave_policy'),
('max_health_leave_days', '12', 'Maximum health leave days per year', 'leave_policy'),
('notice_period_days', '1', 'Notice period required for leave requests', 'leave_policy'),
('auto_approval_enabled', 'false', 'Automatically approve requests under remaining balance', 'leave_policy'),
('weekend_inclusion', 'false', 'Count weekend days in leave calculations', 'leave_policy'),
('email_notifications_enabled', 'true', 'Enable email notifications system-wide', 'notifications'),
('push_notifications_enabled', 'false', 'Enable browser push notifications', 'notifications'),
('weekly_digest_enabled', 'true', 'Send weekly activity digests', 'notifications');

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_manager_id ON users(manager_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_date_range ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_balances_user_id ON leave_balances(user_id);
CREATE INDEX idx_leave_balances_year ON leave_balances(year);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_category ON user_preferences(category);
CREATE INDEX idx_system_settings_category ON system_settings(category);

-- Create indexes for monthly leave usage table
CREATE INDEX idx_monthly_leave_usage_user_id ON monthly_leave_usage(user_id);
CREATE INDEX idx_monthly_leave_usage_user_leave_type_year_month ON monthly_leave_usage(user_id, leave_type_id, year, month);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON leave_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_leave_usage_updated_at BEFORE UPDATE ON monthly_leave_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate leave balance when request is created/updated
CREATE OR REPLACE FUNCTION recalculate_pending_days()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update pending days for the user and leave type
        UPDATE leave_balances
        SET pending_days = (
            SELECT COALESCE(SUM(total_days), 0)
            FROM leave_requests
            WHERE user_id = NEW.user_id
            AND leave_type_id = NEW.leave_type_id
            AND status IN ('pending', 'manager_approved')
            AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
        )
        WHERE user_id = NEW.user_id
        AND leave_type_id = NEW.leave_type_id
        AND year = EXTRACT(YEAR FROM CURRENT_DATE);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate pending days
CREATE TRIGGER recalculate_pending_days_trigger
    AFTER INSERT OR UPDATE OR DELETE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION recalculate_pending_days();

COMMENT ON DATABASE leave_management_db IS 'Leave Management System Database';