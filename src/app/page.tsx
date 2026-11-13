import Link from "next/link";
import { Camera, ShieldCheck, SplitSquareHorizontal } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { FramingMark } from "@/components/layout/framing-mark";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";

const benefits = [
  {
    title: "Repeatable angles",
    description: "Five standard facial views, stored as a versioned protocol so later sessions match the baseline.",
    icon: Camera,
  },
  {
    title: "Honest comparison",
    description: "Side-by-side and slider review of the original photographs, without beauty filters or reshaping.",
    icon: SplitSquareHorizontal,
  },
  {
    title: "Clinic isolation",
    description: "Each clinic sees only its own records. Patients see only what a professional explicitly releases.",
    icon: ShieldCheck,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <p className="text-lg font-semibold tracking-tight">{APP_NAME}</p>
        <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Sign in
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 lg:flex-row lg:items-center lg:py-16">
        <div className="flex flex-1 flex-col gap-6">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Medical aesthetics</p>
          <h1 className="max-w-xl text-4xl leading-tight font-semibold tracking-tight text-balance">
            Before and after photographs you can compare with confidence.
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">{APP_DESCRIPTION}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
              Create a professional account
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
              Sign in
            </Link>
          </div>
        </div>
        <div className="flex flex-1 justify-center">
          <FramingMark />
        </div>
        </div>
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 md:grid-cols-3">
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
      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-sm leading-6 text-muted-foreground">
        Prototype for development only. Do not upload real patient photographs or other health information.
      </footer>
    </div>
  );
}
