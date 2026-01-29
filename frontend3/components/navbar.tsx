// components/navbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  // Assuming your useAuth hook returns a user object and a logout function
  // If not, you can remove these lines for now
  const { user, logout } = useAuth() || {};
  const pathname = usePathname();
  const isGroups = pathname?.startsWith("/groups");

  const isActive = (href: string, aliases: string[] = []) =>
    pathname === href ||
    pathname?.startsWith(`${href}/`) ||
    aliases.some((alias) => pathname === alias || pathname?.startsWith(`${alias}/`));

  if (pathname === "/") {
    return null;
  }

  return (
    <nav className="bg-slate-50">
      <div className="container mx-auto flex items-start justify-between gap-2.5 px-4 py-4">
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 shadow-[0_2px_6px_rgba(99,102,241,0.15)]"
          >
            <Image
              src="/brand/icon.png"
              alt="Splendoure"
              width={18}
              height={18}
              className="h-[18px] w-[18px]"
            />
            <span className="text-[18px] font-extrabold uppercase leading-none tracking-[0.07em] text-indigo-700">
              Splendoure
            </span>
          </Link>
          {pathname?.startsWith("/groups") ? (
            <p className="text-[11px] font-semibold text-slate-600/70">
              Discover plans and swipe to join
            </p>
          ) : null}
        </div>

        {/* Right Side Actions */}
        <div className="mt-0.5 flex items-start gap-3">
          {isGroups ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Link
                  href="/groups?filters=open"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm sm:px-4 sm:py-2 sm:text-sm"
                >
                  Filters
                </Link>
                <Link
                  href="/groups/create"
                  className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 sm:px-4 sm:py-2 sm:text-sm"
                >
                  Create group
                </Link>
              </div>
              <Link
                href="/groups?findType=open"
                className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 sm:px-4 sm:py-2 sm:text-sm"
              >
                Find my type
              </Link>
            </div>
          ) : null}
          <div className={`items-center gap-3 ${user ? "hidden md:flex" : "flex"}`}>
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
                <Link href="/notifications">
                  <Button variant="ghost">Notifications</Button>
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
      </div>

      {user ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white md:hidden">
          <div className="flex h-[72px] items-center justify-around px-3">
            <Link
              href="/groups"
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                isActive("/groups") ? "bg-slate-200 text-slate-900" : "text-slate-500"
              }`}
            >
              Discover
            </Link>
            <Link
              href="/chat"
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                isActive("/chat") ? "bg-slate-200 text-slate-900" : "text-slate-500"
              }`}
            >
              Chats
            </Link>
            <Link
              href="/notifications"
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                isActive("/notifications", ["/requests"])
                  ? "bg-slate-200 text-slate-900"
                  : "text-slate-500"
              }`}
            >
              Notifications
            </Link>
            <Link
              href="/profile"
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                isActive("/profile") ? "bg-slate-200 text-slate-900" : "text-slate-500"
              }`}
            >
              Profile
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
