import Link from "next/link";
import Image from "next/image";
import { Camera, ShieldCheck, SplitSquareHorizontal, ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";

const benefits = [
  {
    title: "Repeatable angles",
    description: "Five standard facial views, stored as a versioned protocol so later sessions match the baseline.",
    icon: Camera,
  },
  {
    title: "Honest comparison",
    description: "A thoughtful foundation for reviewing photographs without beauty filters or reshaping. Comparison tools are planned.",
    icon: SplitSquareHorizontal,
  },
  {
    title: "Clinic isolation",
    description: "A clinic-first workspace designed to keep patient records within the right organization.",
    icon: ShieldCheck,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <p className="text-xl font-semibold tracking-tight">◌ {APP_NAME}<span className="text-primary">.</span></p>
        <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Sign in
        </Link>
      </header>
      <main><div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-10 lg:flex-row lg:items-center lg:gap-16 lg:py-20">
        <div className="flex flex-1 flex-col gap-6">
          <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">A clearer picture of care</p>
          <h1 className="max-w-xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Every detail tells a story.
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">{APP_DESCRIPTION}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
              Get started <ArrowRight aria-hidden="true" className="ml-2 size-4" />
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
              Sign in
            </Link>
          </div>
        </div>
        <div className="flex-1 rounded-[2rem] bg-[#e7e2d9] p-3 shadow-xl shadow-stone-900/5 sm:p-5">
          <div className="overflow-hidden rounded-[1.4rem] bg-white">
            <div className="relative aspect-[3/2] bg-stone-200">
              <Image src="/demo-portraits.png" alt="Two fictional studio portraits illustrating consistent facial photography" fill sizes="(min-width: 1024px) 50vw, 100vw" priority className="object-cover" />
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm font-medium"><span>Baseline</span><span>Follow-up</span></div>
          </div>
          <p className="px-2 pt-3 text-xs leading-5 text-stone-700">AI-generated illustration. Not a real patient or treatment result.</p>
        </div>
        </div>
      <section aria-label="Designed for thoughtful documentation" className="mx-auto grid w-full max-w-6xl gap-4 px-5 pb-16 md:grid-cols-3">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <article key={benefit.title} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
              <Icon aria-hidden="true" className="size-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{benefit.title}</h2>
              <p className="mt-2 text-base leading-7 text-muted-foreground">{benefit.description}</p>
            </article>
          );
        })}
      </section>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-sm leading-6 text-muted-foreground">
        Prototype for development only. Do not upload real patient photographs or other health information.
      </footer>
    </div>
  );
}
