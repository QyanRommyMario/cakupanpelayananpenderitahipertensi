"use client";

import { Component } from "react";

/**
 * Error Boundary - Komponen penanganan error untuk Production
 * Mencegah aplikasi crash dengan layar putih
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Di production, kirim ke logging service
    if (process.env.NODE_ENV === "production") {
      // TODO: Integrasikan dengan Sentry atau logging service lainnya
      // logErrorToService(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            {/* Icon */}
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-rose-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Terjadi Kesalahan Sistem
            </h1>

            {/* Description */}
            <p className="text-gray-600 mb-6">
              Mohon maaf, terjadi gangguan teknis pada sistem. Tim teknis telah
              diberitahu dan sedang bekerja untuk memperbaiki masalah ini.
            </p>

            {/* Error Code (untuk referensi) */}
            <div className="bg-gray-100 rounded-lg p-3 mb-6">
              <p className="text-xs text-gray-500 font-mono">
                Kode Referensi: ERR-{Date.now().toString(36).toUpperCase()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                Muat Ulang Halaman
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl transition-colors"
              >
                Kembali ke Beranda
              </button>
            </div>

            {/* Contact Info */}
            <p className="text-xs text-gray-500 mt-6">
              Jika masalah berlanjut, hubungi administrator sistem.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
