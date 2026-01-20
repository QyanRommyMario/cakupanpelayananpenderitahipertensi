"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/input", label: "Input / Edit Data" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-slate-900 shadow-md">
      <div className="max-w-full mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Brand */}
          <div className="flex items-center">
            <span className="text-white font-semibold text-lg tracking-tight">
              SPM Hipertensi
            </span>
            <span className="hidden sm:inline-block ml-3 text-slate-400 text-sm border-l border-slate-700 pl-3">
              Dinas Kesehatan Kabupaten
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2
                    ${
                      isActive
                        ? "text-white border-blue-500"
                        : "text-slate-400 border-transparent hover:text-white hover:border-slate-600"
                    }
                  `}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
