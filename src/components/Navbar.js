"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PROGRAMS, PROGRAM_TYPES_LIST } from "@/utils/constants";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Command Center - Link ke halaman utama (Overview)
  const commandCenterItem = {
    href: "/",
    label: "Command Center",
    shortLabel: "Overview",
    icon: "🏢",
  };

  // Dashboard submenu items - Dinamis dari PROGRAMS config
  const dashboardItems = PROGRAM_TYPES_LIST.map((program) => ({
    href: PROGRAMS[program.value].path,
    label: program.label,
    shortLabel: program.shortLabel,
    icon: program.icon,
    theme: program.theme,
  }));

  const otherNavItems = [
    { href: "/indikator", label: "Analisa Indikator", icon: "🔬" },
    { href: "/input", label: "Input / Edit Data", icon: "📝" },
    { href: "/laporan", label: "Laporan & Ekspor", icon: "📊" },
  ];

  // Check if current path is command center
  const isCommandCenterActive = pathname === "/";
  
  // Check if current path is one of the dashboard pages
  const isDashboardActive = dashboardItems.some(
    (item) => pathname === item.href
  );

  // Get current dashboard label for mobile
  const currentDashboard = dashboardItems.find((item) => pathname === item.href);

  return (
    <nav className="sticky top-0 z-50 bg-slate-900 shadow-md">
      <div className="max-w-full mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand with Official Logo */}
          <div className="flex items-center gap-3">
            {/* Logo Kabupaten Morowali Utara */}
            <div className="flex-shrink-0">
              <Image
                src="/logo-morowali-utara.svg"
                alt="Logo Kabupaten Morowali Utara"
                width={40}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-base tracking-tight leading-tight">
                SMART PTM
              </span>
              <span className="hidden sm:block text-slate-400 text-xs leading-tight">
                Dinas Kesehatan Daerah Kab. Morowali Utara
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-1">
            {/* Command Center Link */}
            <Link
              href={commandCenterItem.href}
              className={`
                px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 flex items-center gap-1
                ${
                  isCommandCenterActive
                    ? "text-white border-blue-500"
                    : "text-slate-400 border-transparent hover:text-white hover:border-slate-600"
                }
              `}
            >
              <span>{commandCenterItem.icon}</span>
              {commandCenterItem.label}
            </Link>

            {/* Dashboard Dropdown */}
            <div className="relative group">
              <button
                className={`
                  px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 flex items-center gap-1
                  ${
                    isDashboardActive
                      ? "text-white border-blue-500"
                      : "text-slate-400 border-transparent hover:text-white hover:border-slate-600"
                  }
                `}
              >
                📈 Dashboard
                <svg
                  className="w-4 h-4 transition-transform group-hover:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="absolute left-0 mt-0 w-56 bg-slate-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-2">
                  {dashboardItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`
                          flex items-center gap-2 px-4 py-2 text-sm transition-colors
                          ${
                            isActive
                              ? `${item.theme.bg} text-white`
                              : "text-slate-300 hover:bg-slate-700 hover:text-white"
                          }
                        `}
                      >
                        <span>{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Other Nav Items */}
            {otherNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 flex items-center gap-1
                    ${
                      isActive
                        ? "text-white border-blue-500"
                        : "text-slate-400 border-transparent hover:text-white hover:border-slate-600"
                    }
                  `}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-400 hover:text-white p-2"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden pb-4 border-t border-slate-700 mt-2 pt-4">
            <div className="space-y-1">
              {/* Command Center */}
              <Link
                href={commandCenterItem.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm rounded-lg mx-2
                  ${
                    isCommandCenterActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }
                `}
              >
                <span>{commandCenterItem.icon}</span>
                {commandCenterItem.label}
              </Link>
              
              <div className="border-t border-slate-700 my-2"></div>
              <p className="px-4 py-1 text-xs text-slate-500 uppercase tracking-wider">
                Dashboard Program SPM
              </p>
              {dashboardItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-2 px-4 py-2 text-sm rounded-lg mx-2
                      ${
                        isActive
                          ? `${item.theme.bg} text-white`
                          : "text-slate-300 hover:bg-slate-800"
                      }
                    `}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
              
              <div className="border-t border-slate-700 my-2"></div>
              <p className="px-4 py-1 text-xs text-slate-500 uppercase tracking-wider">
                Menu Lainnya
              </p>
              
              {otherNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-2 px-4 py-2 text-sm rounded-lg mx-2
                      ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-slate-300 hover:bg-slate-800"
                      }
                    `}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
