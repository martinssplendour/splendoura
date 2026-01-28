// app/page.tsx
"use client";

import { useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Sparkles, Users } from "lucide-react";
import { Sora, Playfair_Display } from "next/font/google";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export default function LandingPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user || accessToken) {
      router.replace("/groups");
    }
  }, [accessToken, router, user]);

  if (user || accessToken) {
    return null;
  }

  return (
    <div className={`${sora.variable} ${playfair.variable} min-h-screen bg-slate-950 text-white`}>
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: "url('/brand/hero.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/65 via-slate-900/35 to-slate-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_transparent_45%)]" />

        <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/30">
              <Image src="/brand/icon.png" alt="Splendoura icon" width={40} height={40} />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/auth/login" className="text-white/80 transition hover:text-white">
              Sign In
            </Link>
            <Button asChild className="rounded-full bg-blue-600 px-5 text-white hover:bg-blue-700">
              <Link href="/auth/register">Get Started</Link>
            </Button>
          </div>
        </header>

        <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-32 pt-10 text-center md:pt-16">
          <div className="mb-6 rounded-[30px] bg-white/10 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/25 backdrop-blur-md">
            <div className="relative overflow-hidden rounded-[22px]">
              <Image
                src="/brand/logo.png"
                alt="Splendoura logo"
                width={320}
                height={140}
                className="w-44 md:w-56"
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,_rgba(255,255,255,0.6),_transparent_55%)]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />
            </div>
          </div>
          <h1
            className="text-4xl font-semibold leading-tight md:text-6xl"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Plan Dates. Plan Vacations.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-white/80 md:text-lg">
            The social platform for connecting people through shared experiences. Find travel
            buddies, dinner groups, or club companions safely and transparently.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-slate-900/70 px-8 text-white shadow-lg shadow-slate-900/40 ring-1 ring-white/10 hover:bg-slate-900"
            >
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="rounded-full bg-white px-8 text-slate-900 shadow-lg shadow-emerald-500/30 hover:bg-white/90"
            >
              <Link href="/auth/register">Join Now</Link>
            </Button>
          </div>
        </section>
      </div>

      <section className="relative z-20 -mt-20 pb-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              title="Create"
              desc="Set your own rules, costs, and requirements."
              icon={<Sparkles className="h-6 w-6" />}
            />
            <FeatureCard
              title="Verify"
              desc="Browse verified profiles and safe communities."
              icon={<ShieldCheck className="h-6 w-6" />}
            />
            <FeatureCard
              title="Connect"
              desc="Meet in person and share the experience."
              icon={<Users className="h-6 w-6" />}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/40 bg-white/90 p-6 text-slate-900 shadow-2xl shadow-slate-900/20 backdrop-blur">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-900">
        {icon}
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}
