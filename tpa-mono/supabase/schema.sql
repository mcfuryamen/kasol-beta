-- ============================================================
-- KASIR SOLO - TPA | Database Schema
-- Supabase PostgreSQL
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'ustadz', 'wali');
CREATE TYPE gender AS ENUM ('L', 'P');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'partial', 'overdue');
CREATE TYPE payment_method AS ENUM ('tunai', 'transfer', 'qris');
CREATE TYPE cash_flow_type AS ENUM ('masuk', 'keluar');
CREATE TYPE attendance_status AS ENUM ('hadir', 'izin', 'sakit', 'alpha');
CREATE TYPE hafalan_type AS ENUM ('ziyadah', 'murajaah', 'tasmi');
CREATE TYPE hafalan_grade AS ENUM ('mumtaz', 'jayyid_jiddan', 'jayyid', 'maqbul', 'belum_lulus');
CREATE TYPE iqro_grade AS ENUM ('lancar', 'cukup', 'mengulang');
CREATE TYPE project_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE project_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'payment', 'progress', 'attendance');
CREATE TYPE day_of_week AS ENUM ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu');
CREATE TYPE academic_semester AS ENUM ('ganjil', 'genap');
CREATE TYPE certificate_type AS ENUM ('khatam_iqro', 'khatam_quran', 'hafalan', 'kelulusan', 'penghargaan');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Lokasi/Cabang TPA
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    head_name VARCHAR(255),
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tahun Ajaran
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g. "2024/2025"
    semester academic_semester NOT NULL DEFAULT 'ganjil',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE, -- Supabase auth.users.id
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    avatar_url TEXT,
    location_id UUID REFERENCES locations(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ustadz/Pengajar
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    nip VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    gender gender NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    photo_url TEXT,
    specialization TEXT, -- Hafalan, Iqro, Tajwid, dll
    join_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wali Santri
CREATE TABLE guardians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relation VARCHAR(50), -- ayah, ibu, wali
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    occupation VARCHAR(100),
    photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Santri
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    guardian_id UUID REFERENCES guardians(id) ON DELETE SET NULL,
    nis VARCHAR(50), -- Nomor Induk Santri
    name VARCHAR(255) NOT NULL,
    gender gender NOT NULL,
    birth_date DATE,
    birth_place VARCHAR(100),
    address TEXT,
    phone VARCHAR(20),
    photo_url TEXT,
    join_date DATE DEFAULT CURRENT_DATE,
    previous_education TEXT,
    health_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KELAS & JADWAL
-- ============================================================

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id),
    name VARCHAR(100) NOT NULL,
    level VARCHAR(50), -- Iqro 1-6, Juz Amma, Juz 1-30, dll
    description TEXT,
    max_students INTEGER DEFAULT 30,
    room VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assign guru ke kelas
CREATE TABLE class_teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, teacher_id)
);

-- Assign santri ke kelas
CREATE TABLE class_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    enrolled_at DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);

-- Jadwal kelas
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id),
    day day_of_week NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KURIKULUM & MATERI
-- ============================================================

CREATE TABLE curriculum_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- Hafalan, Iqro, Tajwid, Fiqh, Akhlak
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE curriculum_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES curriculum_categories(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT, -- Rich text content
    level VARCHAR(50), -- Beginner, Intermediate, Advanced
    sort_order INTEGER DEFAULT 0,
    duration_minutes INTEGER, -- Estimasi durasi
    attachments JSONB DEFAULT '[]', -- File attachments
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assign materi ke kelas
CREATE TABLE class_curriculum (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    material_id UUID REFERENCES curriculum_materials(id) ON DELETE CASCADE,
    target_date DATE,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ABSENSI
-- ============================================================

-- Sesi pertemuan
CREATE TABLE class_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id),
    session_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    topic TEXT,
    material_id UUID REFERENCES curriculum_materials(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    status attendance_status NOT NULL DEFAULT 'hadir',
    notes TEXT,
    check_in_time TIME,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, student_id)
);

-- Absensi guru
CREATE TABLE teacher_attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE,
    status attendance_status NOT NULL DEFAULT 'hadir',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(teacher_id, session_id)
);

-- ============================================================
-- PROGRES HAFALAN & IQRO
-- ============================================================

CREATE TABLE hafalan_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id),
    session_id UUID REFERENCES class_sessions(id),
    type hafalan_type NOT NULL,
    surah_number INTEGER NOT NULL, -- 1-114
    surah_name VARCHAR(100) NOT NULL,
    ayat_from INTEGER NOT NULL,
    ayat_to INTEGER NOT NULL,
    juz INTEGER, -- 1-30
    page INTEGER, -- Halaman mushaf
    grade hafalan_grade NOT NULL,
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE iqro_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id),
    session_id UUID REFERENCES class_sessions(id),
    jilid INTEGER NOT NULL, -- 1-6
    page INTEGER NOT NULL,
    grade iqro_grade NOT NULL,
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress kurikulum per santri
CREATE TABLE student_curriculum_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    material_id UUID REFERENCES curriculum_materials(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id),
    score DECIMAL(5,2),
    grade VARCHAR(20),
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PENILAIAN & CATATAN
-- ============================================================

CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id),
    academic_year_id UUID REFERENCES academic_years(id),
    category VARCHAR(100) NOT NULL, -- Hafalan, Tajwid, Akhlak, dll
    score DECIMAL(5,2),
    grade VARCHAR(20),
    notes TEXT,
    assessed_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id),
    title VARCHAR(255),
    content TEXT NOT NULL,
    is_shared_with_guardian BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KEUANGAN
-- ============================================================

-- Jenis tagihan SPP
CREATE TABLE spp_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- SPP Bulanan, Infaq, Seragam, dll
    amount DECIMAL(12,2) NOT NULL,
    is_recurring BOOLEAN DEFAULT true,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tagihan
CREATE TABLE spp_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    spp_type_id UUID REFERENCES spp_types(id),
    academic_year_id UUID REFERENCES academic_years(id),
    bill_month DATE NOT NULL, -- Bulan tagihan
    amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    status payment_status DEFAULT 'pending',
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pembayaran
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID REFERENCES spp_bills(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id),
    amount DECIMAL(12,2) NOT NULL,
    method payment_method NOT NULL DEFAULT 'tunai',
    receipt_number VARCHAR(50),
    paid_by VARCHAR(255),
    notes TEXT,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kas masuk/keluar
CREATE TABLE cash_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    type cash_flow_type NOT NULL,
    category VARCHAR(100) NOT NULL, -- Infaq, Donasi, Operasional, dll
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(50),
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERTIFIKAT & RAPOR
-- ============================================================

CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    type certificate_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    certificate_number VARCHAR(100),
    issued_date DATE DEFAULT CURRENT_DATE,
    issued_by VARCHAR(255),
    template JSONB DEFAULT '{}', -- Template config
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE report_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id),
    class_id UUID REFERENCES classes(id),
    attendance_summary JSONB DEFAULT '{}',
    hafalan_summary JSONB DEFAULT '{}',
    iqro_summary JSONB DEFAULT '{}',
    assessment_summary JSONB DEFAULT '{}',
    teacher_notes TEXT,
    head_notes TEXT,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MANAJEMEN PROYEK PENGEMBANGAN
-- ============================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status project_status DEFAULT 'planned',
    priority project_priority DEFAULT 'medium',
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    budget DECIMAL(12,2),
    spent DECIMAL(12,2) DEFAULT 0,
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status project_status DEFAULT 'planned',
    priority project_priority DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFIKASI
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type notification_type DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PENGATURAN
-- ============================================================

CREATE TABLE app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(location_id, key)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_students_location ON students(location_id);
CREATE INDEX idx_students_guardian ON students(guardian_id);
CREATE INDEX idx_teachers_location ON teachers(location_id);
CREATE INDEX idx_classes_location ON classes(location_id);
CREATE INDEX idx_class_students_class ON class_students(class_id);
CREATE INDEX idx_class_students_student ON class_students(student_id);
CREATE INDEX idx_attendances_session ON attendances(session_id);
CREATE INDEX idx_attendances_student ON attendances(student_id);
CREATE INDEX idx_hafalan_student ON hafalan_progress(student_id);
CREATE INDEX idx_iqro_student ON iqro_progress(student_id);
CREATE INDEX idx_spp_bills_student ON spp_bills(student_id);
CREATE INDEX idx_payments_bill ON payments(bill_id);
CREATE INDEX idx_cash_flows_location ON cash_flows(location_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = false;
CREATE INDEX idx_projects_location ON projects(location_id);
CREATE INDEX idx_sessions_class ON class_sessions(class_id);
CREATE INDEX idx_sessions_date ON class_sessions(session_date);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE hafalan_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE iqro_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE spp_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Admin can see everything in their location
CREATE POLICY admin_all_locations ON locations FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin'));

CREATE POLICY admin_all_users ON users FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role = 'admin'));

-- Teacher sees own location data
CREATE POLICY teacher_read_students ON students FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u WHERE u.auth_id = auth.uid()
            AND (u.role = 'admin' OR (u.role = 'ustadz' AND u.location_id = students.location_id))
        )
        OR EXISTS (
            SELECT 1 FROM guardians g
            JOIN users u ON u.id = g.user_id
            WHERE u.auth_id = auth.uid() AND g.id = students.guardian_id
        )
    );

-- Guardian sees own children
CREATE POLICY guardian_read_own ON students FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM guardians g
            JOIN users u ON u.id = g.user_id
            WHERE u.auth_id = auth.uid() AND g.id = students.guardian_id
        )
    );

-- Notifications: user sees own
CREATE POLICY own_notifications ON notifications FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.id = notifications.user_id));

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at' AND table_schema = 'public'
    LOOP
        EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
    END LOOP;
END;
$$;

-- Auto update payment status
CREATE OR REPLACE FUNCTION update_bill_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE spp_bills SET
        paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE bill_id = NEW.bill_id),
        status = CASE
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE bill_id = NEW.bill_id) >= amount THEN 'paid'
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE bill_id = NEW.bill_id) > 0 THEN 'partial'
            ELSE 'pending'
        END
    WHERE id = NEW.bill_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_status
AFTER INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION update_bill_status();

-- Notify guardian on progress update
CREATE OR REPLACE FUNCTION notify_hafalan_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_guardian_user_id UUID;
    v_student_name VARCHAR;
BEGIN
    SELECT g.user_id, s.name INTO v_guardian_user_id, v_student_name
    FROM students s
    JOIN guardians g ON g.id = s.guardian_id
    WHERE s.id = NEW.student_id;

    IF v_guardian_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
            v_guardian_user_id,
            'progress',
            'Update Hafalan ' || v_student_name,
            v_student_name || ' telah menyelesaikan hafalan ' || NEW.surah_name || ' ayat ' || NEW.ayat_from || '-' || NEW.ayat_to || ' dengan nilai ' || NEW.grade,
            jsonb_build_object('student_id', NEW.student_id, 'hafalan_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_hafalan
AFTER INSERT ON hafalan_progress
FOR EACH ROW EXECUTE FUNCTION notify_hafalan_progress();

-- Notify guardian on attendance
CREATE OR REPLACE FUNCTION notify_attendance()
RETURNS TRIGGER AS $$
DECLARE
    v_guardian_user_id UUID;
    v_student_name VARCHAR;
BEGIN
    IF NEW.status != 'hadir' THEN
        SELECT g.user_id, s.name INTO v_guardian_user_id, v_student_name
        FROM students s
        JOIN guardians g ON g.id = s.guardian_id
        WHERE s.id = NEW.student_id;

        IF v_guardian_user_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (
                v_guardian_user_id,
                'attendance',
                'Absensi ' || v_student_name,
                v_student_name || ' tercatat ' || NEW.status || ' pada pertemuan hari ini.',
                jsonb_build_object('student_id', NEW.student_id, 'attendance_id', NEW.id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_attendance
AFTER INSERT ON attendances
FOR EACH ROW EXECUTE FUNCTION notify_attendance();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default location
INSERT INTO locations (id, name, address, phone, head_name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'TPA Al-Hikmah', 'Jl. Masjid No. 1, Kampung Bahagia', '08816566935', 'Ustadz Ahmad');

-- Default curriculum categories
INSERT INTO curriculum_categories (location_id, name, sort_order) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Iqro / Baca Tulis Al-Quran', 1),
    ('00000000-0000-0000-0000-000000000001', 'Hafalan Al-Quran', 2),
    ('00000000-0000-0000-0000-000000000001', 'Tajwid', 3),
    ('00000000-0000-0000-0000-000000000001', 'Fiqh Ibadah', 4),
    ('00000000-0000-0000-0000-000000000001', 'Akhlak & Adab', 5),
    ('00000000-0000-0000-0000-000000000001', 'Doa Harian', 6),
    ('00000000-0000-0000-0000-000000000001', 'Sirah Nabi', 7);

-- Default SPP types
INSERT INTO spp_types (location_id, name, amount, is_recurring) VALUES
    ('00000000-0000-0000-0000-000000000001', 'SPP Bulanan', 50000, true),
    ('00000000-0000-0000-0000-000000000001', 'Infaq Bulanan', 10000, true),
    ('00000000-0000-0000-0000-000000000001', 'Seragam', 150000, false),
    ('00000000-0000-0000-0000-000000000001', 'Buku Iqro', 25000, false);
