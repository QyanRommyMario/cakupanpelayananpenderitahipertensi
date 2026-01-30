"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import PWAInstallPrompt, { IOSInstallInstructions } from "@/components/PWAInstallPrompt";

/**
 * ClientProviders - Wrapper untuk semua client-side providers
 * Termasuk Error Boundary dan PWA Install Prompt
 */
export default function ClientProviders({ children }) {
  return (
    <ErrorBoundary>
      {children}
      <PWAInstallPrompt />
      <IOSInstallInstructions />
    </ErrorBoundary>
  );
}
