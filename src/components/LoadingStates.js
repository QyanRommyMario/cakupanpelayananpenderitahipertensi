"use client";

/**
 * Loading Skeleton - Komponen loading state yang profesional
 * Digunakan untuk menggantikan spinner yang generik
 */

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse p-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded-lg mb-2"></div>
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
        </div>
        <div className="h-10 w-40 bg-gray-200 rounded-lg"></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="h-4 w-24 bg-gray-200 rounded mb-3"></div>
            <div className="h-8 w-32 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 w-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
        <div className="h-6 w-48 bg-gray-200 rounded mb-6"></div>
        <div className="h-64 bg-gray-100 rounded-lg"></div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="h-12 bg-gray-100 flex items-center px-4 gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-4 bg-gray-200 rounded"
              style={{ width: `${Math.random() * 80 + 60}px` }}
            ></div>
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-14 border-b border-gray-100 flex items-center px-4 gap-4"
          >
            {[...Array(5)].map((_, j) => (
              <div
                key={j}
                className="h-4 bg-gray-200 rounded"
                style={{ width: `${Math.random() * 80 + 40}px` }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="animate-pulse">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="h-12 bg-gray-100 flex items-center px-4 gap-4">
          {[...Array(cols)].map((_, i) => (
            <div
              key={i}
              className="h-4 bg-gray-200 rounded flex-1"
            ></div>
          ))}
        </div>
        {[...Array(rows)].map((_, i) => (
          <div
            key={i}
            className="h-14 border-b border-gray-100 flex items-center px-4 gap-4"
          >
            {[...Array(cols)].map((_, j) => (
              <div
                key={j}
                className="h-4 bg-gray-200 rounded flex-1"
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-xl p-5 shadow-sm">
      <div className="h-4 w-24 bg-gray-200 rounded mb-3"></div>
      <div className="h-8 w-32 bg-gray-200 rounded mb-2"></div>
      <div className="h-3 w-20 bg-gray-200 rounded"></div>
    </div>
  );
}

export function ChartSkeleton({ height = 256 }) {
  return (
    <div className="animate-pulse bg-white rounded-xl p-6 shadow-sm">
      <div className="h-6 w-48 bg-gray-200 rounded mb-6"></div>
      <div
        className="bg-gray-100 rounded-lg"
        style={{ height: `${height}px` }}
      ></div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i}>
          <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
          <div className="h-10 w-full bg-gray-200 rounded-lg"></div>
        </div>
      ))}
      <div className="h-10 w-32 bg-gray-200 rounded-lg mt-6"></div>
    </div>
  );
}

/**
 * Empty State - Tampilan ketika data kosong
 */
export function EmptyState({
  title = "Belum Ada Data Rekaman",
  description = "Data belum tersedia atau dalam proses sinkronisasi.",
  icon = "inbox",
  action = null,
}) {
  const icons = {
    inbox: (
      <svg
        className="w-12 h-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
    ),
    chart: (
      <svg
        className="w-12 h-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    search: (
      <svg
        className="w-12 h-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        {icons[icon] || icons.inbox}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 text-center max-w-sm mb-4">{description}</p>
      {action && action}
    </div>
  );
}

/**
 * Loading Spinner - Spinner sederhana untuk tombol/inline
 */
export function Spinner({ size = "md", color = "blue" }) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const colors = {
    blue: "border-blue-600",
    white: "border-white",
    gray: "border-gray-600",
  };

  return (
    <div
      className={`${sizes[size]} border-2 ${colors[color]} border-t-transparent rounded-full animate-spin`}
    ></div>
  );
}
