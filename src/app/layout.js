import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

export const metadata = {
  title: {
    default: "SMART PTM - Dinas Kesehatan Kabupaten Morowali Utara",
    template: "%s | SMART PTM Morowali Utara",
  },
  description:
    "Sistem Monitoring Aktual dan Real Time Penyakit Tidak Menular (SMART PTM) - Dinas Kesehatan Kabupaten Morowali Utara. Memantau capaian pelayanan Hipertensi, Diabetes Melitus, ODGJ, dan Usia Produktif.",
  keywords: [
    "SMART PTM",
    "Dinas Kesehatan",
    "Morowali Utara",
    "SPM Kesehatan",
    "Hipertensi",
    "Diabetes Melitus",
    "ODGJ",
    "Penyakit Tidak Menular",
    "PTM",
  ],
  authors: [{ name: "Dinas Kesehatan Kabupaten Morowali Utara" }],
  creator: "Dinas Kesehatan Kabupaten Morowali Utara",
  publisher: "Pemerintah Kabupaten Morowali Utara",
  applicationName: "SMART PTM",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SMART PTM",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "SMART PTM Morowali Utara",
    title: "SMART PTM - Sistem Monitoring Penyakit Tidak Menular",
    description:
      "Sistem Monitoring Aktual dan Real Time Penyakit Tidak Menular Dinas Kesehatan Kabupaten Morowali Utara",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e40af",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-512x512.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SMART PTM" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1e40af" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="antialiased bg-gray-50 font-sans">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
