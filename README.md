# 📊 SMART PTM - Sistem Monitoring Aktual dan Real Time Penyakit Tidak Menular

Dashboard monitoring **Standar Pelayanan Minimal (SPM)** untuk Dinas Kesehatan Daerah Kabupaten Morowali Utara.

## 🏥 4 Program SPM yang Dimonitor

1. **Pelayanan Kesehatan Pada Usia Produktif** 👤
2. **Pelayanan Kesehatan Penderita Hipertensi** ❤️
3. **Pelayanan Kesehatan Penderita Diabetes Melitus** 🩸
4. **Pelayanan Kesehatan ODGJ Berat** 🧠

## 📊 Standar SPM

- **Target Aman**: ≥ 80%
- **Target Ideal**: 100%
- **Rumus**: `(Realisasi / Sasaran) × 100%`

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Charts**: Recharts
- **Export**: xlsx (Excel), jsPDF (PDF)

---

## 📋 Setup Instructions

### 1️⃣ Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com)
2. Buka **SQL Editor** dan jalankan script dari `schema.sql`:
   ```sql
   -- Copy semua isi file schema.sql dan jalankan di SQL Editor
   ```
3. Buka **Settings > API** dan copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

4. Buat user untuk login:
   - Buka **Authentication > Users**
   - Klik **Add User** > **Create New User**
   - Isi email dan password

### 2️⃣ Setup Environment Variables

Edit file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SYNC_TOKEN=spm-dashboard-sync-token-2025
```

### 3️⃣ Run Development Server

```bash
npm install
npm run dev
```

Buka http://localhost:3000 dan login dengan user Supabase.

---

## 🔗 Setup Google Apps Script

### Step 1: Buka Google Sheets

Buka spreadsheet data pivot table:
https://docs.google.com/spreadsheets/d/1RrqiFWkys-8cBcsOQwSnPHSO8HdC3zjAu_7pB1gyv7U/edit

### Step 2: Buka Apps Script

1. Buka menu **Extensions > Apps Script**
2. Atau buka langsung: https://script.google.com/u/0/home/projects/17kZsyj4YgkgkyGzjmhNTwL0P5S4EdjnDMhu-q9dRA_ofOnZWsw7rcGEY/edit

### Step 3: Update Configuration

Edit `CONFIG` di `Code.gs`:

```javascript
const CONFIG = {
  // Untuk development lokal:
  API_URL: "http://localhost:3000/api/sync",

  // Untuk production (setelah deploy ke Vercel):
  // API_URL: "https://your-app.vercel.app/api/sync",

  // Harus sama dengan SYNC_TOKEN di .env.local
  SYNC_TOKEN: "spm-dashboard-sync-token-2025",

  // Nama sheet dengan data pivot
  SHEET_NAME: "Capaian PKM",

  // Periode pelaporan
  PERIOD: "TW4-2025",

  // ...
};
```

### Step 4: Jalankan Sync

1. Refresh Google Sheets (F5)
2. Akan muncul menu **📊 SPM Dashboard** di toolbar
3. Klik **🔄 Sync Data to Dashboard**
4. Data akan masuk ke Supabase dan tampil di dashboard

---

## 📊 Struktur Data Pivot Table

Sheet harus memiliki struktur berikut:

| Kolom            | Isi                               |
| ---------------- | --------------------------------- |
| A                | Nama Indikator                    |
| B-P (15 kolom)   | **Sasaran** per Puskesmas         |
| Q-AE (15 kolom)  | **Terlayani** per Puskesmas       |
| AF-AT (15 kolom) | **Belum Terlayani** per Puskesmas |

Urutan Puskesmas (harus konsisten):

1. ANT - Antapani
2. BTR - Batununggal
3. BTL - Buahbatu
4. CBI - Cibiru
5. CBL - Cibeunying
6. CDG - Cidadap
7. CGR - Cigereleng
8. CKL - Cikutra
9. CMH - Cimahi
10. GDJ - Gede Bage
11. KBN - Kiaracondong
12. LBK - Lembang
13. MJL - Majalaya
14. RCG - Rancaekek
15. SBR - Soreang

---

## 🗂️ Struktur Project

```
├── src/
│   ├── app/
│   │   ├── api/sync/route.js    # API endpoint untuk sync
│   │   ├── data/page.js         # Halaman kelola data
│   │   ├── login/page.js        # Halaman login
│   │   ├── page.js              # Dashboard utama
│   │   ├── layout.js            # Root layout
│   │   └── globals.css          # Tailwind CSS
│   ├── components/
│   │   └── DashboardLayout.js   # Sidebar layout
│   ├── lib/
│   │   └── supabase.js          # Supabase client
│   └── middleware.js            # Auth middleware
├── google-apps-script/
│   └── Code.gs                  # ETL script
├── schema.sql                   # Database schema
├── .env.local                   # Environment variables
└── package.json
```

---

## 🔐 API Endpoint

### POST /api/sync

Endpoint untuk menerima data dari Google Apps Script.

**Headers:**

```
Content-Type: application/json
x-sync-token: spm-dashboard-sync-token-2025
```

**Body:**

```json
{
  "period": "TW4-2025",
  "data": [
    {
      "puskesmas_code": "ANT",
      "indicator_name": "Pelayanan Hipertensi",
      "target_qty": 100,
      "realization_qty": 85,
      "unserved_qty": 15
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "period": "TW4-2025",
  "upserted": 150,
  "total": 150
}
```

---

## 🚀 Deploy ke Vercel

1. Push code ke GitHub
2. Import project di [vercel.com](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SYNC_TOKEN`
4. Deploy!
5. Update `API_URL` di Google Apps Script dengan URL Vercel

---

## 📝 License

MIT
