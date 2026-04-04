-- Insert test data into whitelist table
-- Execute this in Supabase SQL Editor

INSERT INTO whitelist (email, status) VALUES
('brunoamaral202@gmail.com', 'active'),
('gabriel.amaral@manualdedonos.com.br', 'active'),
('gabriel.bechi@manualdedonos.com.br', 'active'),
('acessos@manualdedonos.com.br', 'active'),
('test@example.com', 'active'),
('inactive@example.com', 'inactive')
ON CONFLICT (email) DO UPDATE
SET status = EXCLUDED.status;

-- Verify data was inserted
SELECT * FROM whitelist ORDER BY created_at DESC;
