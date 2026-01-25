// components/navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Inbox, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  // Assuming your useAuth hook returns a user object and a logout function
  // If not, you can remove these lines for now
  const { user, logout } = useAuth() || {};
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-blue-600">
          Splendoura
        </Link>

        {/* Right Side Actions */}
        <div
          className={`items-center gap-4 ${
            user ? "hidden md:flex" : "flex"
          }`}
        >
          {user ? (
            <>
              <span className="text-sm text-slate-600">
                Hello, {user.full_name || user.name || "User"}
              </span>
              <Link href="/profile">
                <Button variant="ghost">Profile</Button>
              </Link>
              <Link href="/chat">
                <Button variant="ghost">Chat</Button>
              </Link>
              <Link href="/requests">
                <Button variant="ghost">Requests</Button>
              </Link>
              {user.role === "admin" ? (
                <Link href="/admin/verification">
                  <Button variant="ghost">Admin</Button>
                </Link>
              ) : null}
              <Button variant="ghost" onClick={() => logout && logout()}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth/register">
                <Button>Get Started</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {user ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-6 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <Link
              href="/groups"
              className={`flex items-center justify-center ${
                isActive("/groups") ? "text-blue-600" : "text-slate-500"
              }`}
            >
              <Home className="h-6 w-6" />
              <span className="sr-only">Groups</span>
            </Link>
            <Link
              href="/chat"
              className={`flex items-center justify-center ${
                isActive("/chat") ? "text-blue-600" : "text-slate-500"
              }`}
            >
              <MessageCircle className="h-6 w-6" />
              <span className="sr-only">Chat</span>
            </Link>
            <Link
              href="/requests"
              className={`flex items-center justify-center ${
                isActive("/requests") ? "text-blue-600" : "text-slate-500"
              }`}
            >
              <Inbox className="h-6 w-6" />
              <span className="sr-only">Requests</span>
            </Link>
            <Link
              href="/profile"
              className={`flex items-center justify-center ${
                isActive("/profile") ? "text-blue-600" : "text-slate-500"
              }`}
            >
              <UserIcon className="h-6 w-6" />
              <span className="sr-only">Profile</span>
            </Link>
            <button
              type="button"
              onClick={() => logout && logout()}
              className="flex items-center justify-center text-slate-500 hover:text-blue-600"
              aria-label="Sign out"
            >
              <LogOut className="h-6 w-6" />
            </button>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
