# Deploy ke Vercel

## Langkah Deploy:

1. **Install Vercel CLI**

   ```bash
   npm i -g vercel
   ```

2. **Login ke Vercel**

   ```bash
   vercel login
   ```

3. **Deploy Project**

   ```bash
   vercel
   ```

   - Pilih scope/team
   - Link ke existing project atau buat baru
   - Nama project: `spm-dashboard` (atau sesuai keinginan)
   - Vercel akan otomatis detect Next.js

4. **Set Environment Variables di Vercel Dashboard**
   - Buka https://vercel.com/dashboard
   - Pilih project → Settings → Environment Variables
   - Tambahkan:
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://qatmxbelyqnevcwpoqsh.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_BQXURS64LDyIACS9q1piog_1PtBGEfV`
     - `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_D8bfREOJPWtqBWJkwfS82A_KWa0MnEn`
     - `SYNC_TOKEN` = `spm-dashboard-sync-token-2025`

5. **Redeploy**

   ```bash
   vercel --prod
   ```

6. **Update Google Apps Script**
   - Buka Code.gs
   - Update `CONFIG.API_URL` dengan URL production dari Vercel
   - Format: `https://your-project.vercel.app/api/sync`

---

## Alternatif: Test dengan Ngrok (Local)

Jika ingin test tanpa deploy dulu:

1. **Install Ngrok**

   ```bash
   choco install ngrok
   ```

   Atau download dari: https://ngrok.com/download

2. **Jalankan Dev Server**

   ```bash
   npm run dev
   ```

3. **Expose ke Internet**

   ```bash
   ngrok http 3001
   ```

4. **Copy URL Ngrok**
   - Contoh: `https://abc123.ngrok.io`
   - Update di Code.gs: `API_URL: "https://abc123.ngrok.io/api/sync"`

**Note**: Ngrok URL berubah setiap restart (free tier)
