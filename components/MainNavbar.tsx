"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Telescope, Layout, LogOut, BugPlay } from "lucide-react";
import { signOutAction } from "@/actions/auth";

export function MainNavbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-outline-variant/50 bg-surface/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        
        {/* Logo area */}
        <Link href="/" className="flex items-center gap-2 group">
            <BugPlay size={24} color="#ffff" className="text-surface" />
          <span className="text-lg font-bold text-on-surface tracking-tight">Townhall</span>
        </Link>
        
        {/* Navigation links */}
        <div className="hidden md:flex items-center gap-8">
          <Link 
            href="/explore"
            className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-on-surface ${
              pathname.startsWith("/explore") || pathname.startsWith("/mission")
                ? "text-on-surface"
                : "text-secondary"
            }`}
          >
            <Telescope size={16} />
            Explore Missions
          </Link>

          <Link 
            href="/dashboard"
            className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-on-surface ${
              pathname.startsWith("/dashboard")
                ? "text-on-surface"
                : "text-secondary"
            }`}
          >
            <Layout size={16} />
            My Projects
          </Link>
        </div>

        {/* User actions */}
        <div className="flex items-center gap-4">
          <form action={signOutAction}>
            <button 
              type="submit"
              className="h-9 px-4 rounded border border-outline-variant text-secondary text-sm font-medium hover:bg-surface-variant hover:text-on-surface transition-colors flex items-center gap-2"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
