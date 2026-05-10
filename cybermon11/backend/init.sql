CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin','analyst','security_engineer','user')),
    status VARCHAR(20) NOT NULL DEFAULT 'offline'
        CHECK (status IN ('active','offline','disabled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login  TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    VARCHAR(100),
    ip         VARCHAR(45) NOT NULL,
    action     VARCHAR(50) NOT NULL,
    status     VARCHAR(20) NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0,
    category   VARCHAR(20) NOT NULL,
    country    VARCHAR(5),
    details    JSONB DEFAULT '{}',
    sim_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blacklist (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip           VARCHAR(45) UNIQUE NOT NULL,
    reason       TEXT NOT NULL,
    threat_level VARCHAR(20) DEFAULT 'WARNING',
    auto_blocked BOOLEAN DEFAULT FALSE,
    event_type   VARCHAR(50),
    added_by     UUID REFERENCES users(id),
    expires_at   TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id),
    level    VARCHAR(20) NOT NULL CHECK (level IN ('WARNING','ATTACK','CRITICAL')),
    message  TEXT NOT NULL,
    ip       VARCHAR(45),
    is_read  BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    device      VARCHAR(255),
    ip          VARCHAR(45),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active   BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sim_config (
    id         SERIAL PRIMARY KEY,
    key        VARCHAR(50) UNIQUE NOT NULL,
    value      TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notif_prefs (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id) UNIQUE,
    alerts_enabled  BOOLEAN DEFAULT TRUE,
    email_enabled   BOOLEAN DEFAULT FALSE,
    critical_only   BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(sim_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_category  ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_ip        ON events(ip);
CREATE INDEX IF NOT EXISTS idx_events_risk      ON events(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_read      ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_blacklist_ip     ON blacklist(ip);

-- Default thresholds
INSERT INTO sim_config (key, value) VALUES
    ('threshold_normal',     '0'),
    ('threshold_suspicious', '30'),
    ('threshold_attack',     '60'),
    ('threshold_critical',   '85'),
    ('time_scale',           '60')
ON CONFLICT (key) DO NOTHING;

-- Admin account: azizarfaoui678@gmail.com / AzizArfa1234@@
INSERT INTO users (name, email, password_hash, role, status) VALUES
    ('Admin',
     'azizarfaoui678@gmail.com',
     '$2b$12$izmz1cLHSMj4u5Xsj1g8QOoRyAhUM.VKlGmwYayrFOFKLG09GBpG.',
     'admin',
     'offline')
ON CONFLICT (email) DO NOTHING;
