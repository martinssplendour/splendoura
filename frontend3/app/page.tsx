// app/page.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

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
    <div className="flex flex-col items-center justify-center space-y-12 py-20 text-center">
      <section className="max-w-3xl space-y-6">
        <h1 className="text-6xl font-extrabold tracking-tight lg:text-7xl">
          Go Out. <span className="text-blue-600">Together.</span>
        </h1>
        <p className="text-xl text-slate-600">
          The social platform for connecting people through shared experiences. 
          Find travel buddies, dinner groups, or club companions safely and transparently.
        </p>
        <div className="flex justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-black px-8 text-white hover:bg-black/90"
          >
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="rounded-full bg-blue-600 px-8 text-white hover:bg-blue-700"
          >
            <Link href="/auth/register">Join Now</Link>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <FeatureCard title="Create" desc="Set your own rules, costs, and requirements." />
        <FeatureCard title="Verify" desc="Browse verified profiles and safe communities." />
        <FeatureCard title="Connect" desc="Meet in person and share the experience." />
      </div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="p-6 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-500">{desc}</p>
    </div>
  );
}
