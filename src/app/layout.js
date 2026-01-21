import "./globals.css";

export const metadata = {
  title: "Dashboard SPM - Cakupan Pelayanan Hipertensi",
  description:
    "Standar Pelayanan Minimal Kesehatan - Monitoring Cakupan Pelayanan Penderita Hipertensi",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="antialiased bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
