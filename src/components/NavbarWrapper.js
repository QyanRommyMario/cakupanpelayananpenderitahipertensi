"use client";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

export default function NavbarWrapper() {
  const pathname = usePathname();

  // Don't render Navbar on login page
  if (pathname === "/login") {
    return null;
  }

  return <Navbar />;
}
