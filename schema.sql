-- ============================================
-- SMART PTM - DATABASE SCHEMA
-- Sistem Monitoring Aktual dan Real Time PTM
-- Dinas Kesehatan Daerah Kab. Morowali Utara
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create PUSKESMAS Table
CREATE TABLE IF NOT EXISTS puskesmas (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create ACHIEVEMENTS Table (with program_type for 4 programs)
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    puskesmas_code TEXT NOT NULL,
    program_type TEXT NOT NULL, -- USIA_PRODUKTIF, HIPERTENSI, DIABETES, ODGJ
    indicator_name TEXT NOT NULL,
    unit TEXT DEFAULT 'Orang',
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
        UNIQUE (puskesmas_code, indicator_name, period, program_type)
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_achievements_period ON achievements(period);
CREATE INDEX IF NOT EXISTS idx_achievements_puskesmas ON achievements(puskesmas_code);
CREATE INDEX IF NOT EXISTS idx_achievements_program_type ON achievements(program_type);

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

-- 5. Seed Puskesmas Data - Kabupaten Morowali Utara
-- Hapus data lama jika ada
DELETE FROM puskesmas WHERE code NOT IN ('KAB');

INSERT INTO puskesmas (code, name) VALUES
    ('KAB', 'Dinas Kesehatan Daerah Kab. Morowali Utara'),
    ('MLT', 'Puskesmas Molotabu'),
    ('BNT', 'Puskesmas Bunta'),
    ('LMB', 'Puskesmas Lembo'),
    ('PTN', 'Puskesmas Petasia'),
    ('PTS', 'Puskesmas Petasia Selatan'),
    ('PTB', 'Puskesmas Petasia Barat'),
    ('PTT', 'Puskesmas Petasia Timur'),
    ('MRI', 'Puskesmas Mori'),
    ('MRA', 'Puskesmas Mori Atas'),
    ('MRU', 'Puskesmas Mori Utara'),
    ('SOY', 'Puskesmas Soyo Jaya'),
    ('BUG', 'Puskesmas Bungku Utara'),
    ('MAM', 'Puskesmas Mamosalato')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

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

-- 7. Sample Data for Testing (4 Programs x Multiple Puskesmas)
-- Program: USIA_PRODUKTIF
INSERT INTO achievements (puskesmas_code, program_type, indicator_name, unit, target_qty, realization_qty, unserved_qty, period) VALUES
    ('MLT', 'USIA_PRODUKTIF', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 1500, 1200, 300, 'TW4-2025'),
    ('BNT', 'USIA_PRODUKTIF', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 1800, 1500, 300, 'TW4-2025'),
    ('LMB', 'USIA_PRODUKTIF', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 1200, 1000, 200, 'TW4-2025'),
    ('PTN', 'USIA_PRODUKTIF', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 1600, 1400, 200, 'TW4-2025'),
    ('MRI', 'USIA_PRODUKTIF', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 1400, 1100, 300, 'TW4-2025')
ON CONFLICT (puskesmas_code, indicator_name, period, program_type) DO NOTHING;

-- Program: HIPERTENSI
INSERT INTO achievements (puskesmas_code, program_type, indicator_name, unit, target_qty, realization_qty, unserved_qty, period) VALUES
    ('MLT', 'HIPERTENSI', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 500, 425, 75, 'TW4-2025'),
    ('BNT', 'HIPERTENSI', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 600, 500, 100, 'TW4-2025'),
    ('LMB', 'HIPERTENSI', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 400, 350, 50, 'TW4-2025'),
    ('PTN', 'HIPERTENSI', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 550, 480, 70, 'TW4-2025'),
    ('MRI', 'HIPERTENSI', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 480, 400, 80, 'TW4-2025')
ON CONFLICT (puskesmas_code, indicator_name, period, program_type) DO NOTHING;

-- Program: DIABETES
INSERT INTO achievements (puskesmas_code, program_type, indicator_name, unit, target_qty, realization_qty, unserved_qty, period) VALUES
    ('MLT', 'DIABETES', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 200, 170, 30, 'TW4-2025'),
    ('BNT', 'DIABETES', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 250, 200, 50, 'TW4-2025'),
    ('LMB', 'DIABETES', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 180, 160, 20, 'TW4-2025'),
    ('PTN', 'DIABETES', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 220, 190, 30, 'TW4-2025'),
    ('MRI', 'DIABETES', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 190, 150, 40, 'TW4-2025')
ON CONFLICT (puskesmas_code, indicator_name, period, program_type) DO NOTHING;

-- Program: ODGJ
INSERT INTO achievements (puskesmas_code, program_type, indicator_name, unit, target_qty, realization_qty, unserved_qty, period) VALUES
    ('MLT', 'ODGJ', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 50, 45, 5, 'TW4-2025'),
    ('BNT', 'ODGJ', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 60, 50, 10, 'TW4-2025'),
    ('LMB', 'ODGJ', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 40, 38, 2, 'TW4-2025'),
    ('PTN', 'ODGJ', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 55, 48, 7, 'TW4-2025'),
    ('MRI', 'ODGJ', 'JUMLAH YANG HARUS DILAYANI', 'Orang', 45, 40, 5, 'TW4-2025')
ON CONFLICT (puskesmas_code, indicator_name, period, program_type) DO NOTHING;
