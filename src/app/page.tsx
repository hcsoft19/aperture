import Link from "next/link";
import Image from "next/image";
import { Aperture, ArrowRight, Camera, ScanLine, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

const steps = [
  { number: "01", icon: Camera, title: "Capture with intention.", description: "Let guided views bring consistency to every session, from the first photograph to the next visit." },
  { number: "02", icon: ScanLine, title: "See the whole story.", description: "Review sessions side by side with alignment tools that leave original photographs unchanged." },
  { number: "03", icon: ShieldCheck, title: "Share with care.", description: "Release photographs to linked patients when you’re ready, with access you can revoke." },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6 lg:px-12">
        <Link href="/" aria-label="Aperture home" className="flex min-h-11 items-center gap-2.5 text-xl font-medium tracking-tight"><Aperture aria-hidden="true" className="size-7 text-primary" />{APP_NAME}<span className="text-primary">.</span></Link>
        <nav aria-label="Main" className="flex items-center gap-3 sm:gap-7">
          <a href="#approach" className="hidden min-h-11 items-center text-base text-muted-foreground hover:text-primary sm:flex">The approach</a>
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "lg" })}>Sign in</Link>
          <span className="hidden sm:block"><Link href="/register" className={buttonVariants({ size: "lg" })}>Create your clinic <ArrowRight aria-hidden="true" /></Link></span>
        </nav>
      </header>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pt-10 pb-16 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:px-12 lg:pt-16 lg:pb-24" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow mb-6 text-primary">A clearer picture of care</p>
          <h1 id="hero-title" className="editorial-title max-w-xl text-5xl leading-[1.06] sm:text-6xl lg:text-7xl">The art of care.<br /><em className="text-primary">Beautifully</em><br />documented.</h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-muted-foreground">A considered space for aesthetic clinics to capture progress, see every detail, and tell each patient’s story with clarity.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className={buttonVariants({ size: "lg", className: "h-12 px-6" })}>Create your clinic <ArrowRight aria-hidden="true" /></Link>
            <a href="#approach" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-6" })}>Explore Aperture</a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-4 text-primary" />Purpose-built for clinical photography</p>
        </div>
        <figure className="relative rounded-t-[8rem] rounded-b-3xl border border-border bg-secondary p-4 pt-8 sm:p-6 sm:pt-10">
          <div className="mb-6 flex items-center justify-between gap-3 px-2"><span className="eyebrow text-primary">A study in consistency</span><Aperture aria-hidden="true" className="size-5 text-primary" /></div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-t-[5rem] rounded-b-xl bg-card"><Image src="/demo-portraits.png" alt="Two fictional studio portraits demonstrating consistent facial photography" fill sizes="(min-width: 1024px) 45vw, 100vw" priority className="object-cover" /></div>
          <div className="flex justify-between border-b border-border px-2 py-4 text-sm font-medium"><span>01 / Baseline</span><span>02 / Follow-up</span></div>
          <figcaption className="px-2 pt-4 text-sm leading-6 text-muted-foreground">AI-generated illustration. Not a real patient or treatment result.</figcaption>
        </figure>
      </section>
      <section id="approach" aria-labelledby="approach-title" className="border-y border-border bg-card/60">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-12 lg:py-20">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow mb-4 text-primary">Thoughtful by design</p><h2 id="approach-title" className="editorial-title text-4xl sm:text-5xl">Less friction. More focus.</h2></div><p className="max-w-sm text-base leading-7 text-muted-foreground">A calm, connected workflow for the details that matter in your practice.</p></div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">{steps.map(({ number, icon: Icon, title, description }) => <article key={number} className="border-t border-border pt-6"><div className="flex items-center justify-between"><span className="eyebrow text-muted-foreground">{number}</span><Icon aria-hidden="true" className="size-6 text-primary" /></div><h3 className="mt-7 text-xl font-medium tracking-tight">{title}</h3><p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p></article>)}</div>
        </div>
      </section>
      <section className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-14 sm:flex-row sm:items-center lg:px-12"><div><p className="eyebrow mb-3 text-primary">Your next chapter</p><h2 className="editorial-title text-4xl">Make room for better documentation.</h2></div><Link href="/register" className={buttonVariants({ size: "lg", className: "h-12 px-6" })}>Get started <ArrowRight aria-hidden="true" /></Link></section>
      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-4 border-t border-border px-6 py-7 text-sm leading-6 text-muted-foreground sm:flex-row lg:px-12"><span>{APP_NAME} · A clearer picture of care.</span><p className="max-w-md">Development prototype. Do not upload real patient photographs or health information.</p></footer>
    </div>
  );
}
