-- ============================================
-- SPM HEALTH DASHBOARD - DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create PUSKESMAS Table
CREATE TABLE IF NOT EXISTS puskesmas (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create ACHIEVEMENTS Table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    puskesmas_code TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    target_qty NUMERIC DEFAULT 0,
    realization_qty NUMERIC DEFAULT 0,
    unserved_qty NUMERIC DEFAULT 0,
    period TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_puskesmas 
        FOREIGN KEY (puskesmas_code) 
        REFERENCES puskesmas(code) 
        ON DELETE CASCADE,
    
    CONSTRAINT unique_achievement 
        UNIQUE (puskesmas_code, indicator_name, period)
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_achievements_period ON achievements(period);
CREATE INDEX IF NOT EXISTS idx_achievements_puskesmas ON achievements(puskesmas_code);

-- 4. Auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON achievements;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 5. Seed Puskesmas Data
INSERT INTO puskesmas (code, name) VALUES
    ('ANT', 'Puskesmas Antapani'),
    ('BTR', 'Puskesmas Batununggal'),
    ('BTL', 'Puskesmas Buahbatu'),
    ('CBI', 'Puskesmas Cibiru'),
    ('CBL', 'Puskesmas Cibeunying'),
    ('CDG', 'Puskesmas Cidadap'),
    ('CGR', 'Puskesmas Cigereleng'),
    ('CKL', 'Puskesmas Cikutra'),
    ('CMH', 'Puskesmas Cimahi'),
    ('GDJ', 'Puskesmas Gede Bage'),
    ('KBN', 'Puskesmas Kiaracondong'),
    ('LBK', 'Puskesmas Lembang'),
    ('MJL', 'Puskesmas Majalaya'),
    ('RCG', 'Puskesmas Rancaekek'),
    ('SBR', 'Puskesmas Soreang')
ON CONFLICT (code) DO NOTHING;

-- 6. RLS Policies
ALTER TABLE puskesmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read puskesmas" ON puskesmas;
DROP POLICY IF EXISTS "Public read achievements" ON achievements;
DROP POLICY IF EXISTS "Auth insert achievements" ON achievements;
DROP POLICY IF EXISTS "Auth update achievements" ON achievements;
DROP POLICY IF EXISTS "Auth delete achievements" ON achievements;
DROP POLICY IF EXISTS "Service all achievements" ON achievements;

CREATE POLICY "Public read puskesmas" ON puskesmas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read achievements" ON achievements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth insert achievements" ON achievements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update achievements" ON achievements FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete achievements" ON achievements FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service all achievements" ON achievements FOR ALL TO service_role USING (true);

-- 7. Sample Data
INSERT INTO achievements (puskesmas_code, indicator_name, target_qty, realization_qty, unserved_qty, period) VALUES
    ('ANT', 'Pelayanan Hipertensi', 100, 85, 15, 'TW4-2025'),
    ('ANT', 'Pelayanan Diabetes', 80, 65, 15, 'TW4-2025'),
    ('BTR', 'Pelayanan Hipertensi', 120, 100, 20, 'TW4-2025'),
    ('BTR', 'Pelayanan Diabetes', 90, 75, 15, 'TW4-2025'),
    ('BTL', 'Pelayanan Hipertensi', 110, 95, 15, 'TW4-2025'),
    ('CBI', 'Pelayanan Hipertensi', 95, 80, 15, 'TW4-2025'),
    ('CBL', 'Pelayanan Hipertensi', 105, 90, 15, 'TW4-2025')
ON CONFLICT (puskesmas_code, indicator_name, period) DO NOTHING;
