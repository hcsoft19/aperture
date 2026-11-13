import Link from "next/link";
import { Aperture, ArrowRight, Camera, Check, Layers2, ShieldCheck } from "lucide-react";

import { PhotographyPreview } from "@/components/layout/photography-preview";
import { APP_NAME } from "@/lib/brand";
import "./landing.css";

const workflow = [
  { number: "01", icon: Camera, title: "A consistent starting point.", description: "Follow guided photographic views for a repeatable record, from the first visit onward.", detail: "Guided capture" },
  { number: "02", icon: Layers2, title: "Progress, in perspective.", description: "Bring sessions together for side-by-side review. Alignment leaves original photographs unchanged.", detail: "Session comparisons" },
  { number: "03", icon: ShieldCheck, title: "A story you can share.", description: "Choose when to release photographs to linked patients, with sharing access you can revoke.", detail: "Patient sharing" },
];

const questions = [
  { question: "Who is Aperture for?", answer: "Aperture is built for aesthetic clinics and the professionals documenting their patients’ treatment journeys. Each clinic has its own workspace for patient charts and photography." },
  { question: "Are the original photographs edited?", answer: "Original photographs stay unchanged. Comparison tools store alignment separately so you can review sessions while preserving the source record." },
  { question: "When can a patient see their photographs?", answer: "A professional decides which photographs to release to a linked patient account. Sharing access can be revoked by the clinic." },
];

export default function LandingPage() {
  return (
    <div className="aperture-landing">
      <div className="landing-note">A fresh perspective on clinical photography <span aria-hidden="true">↗</span></div>
      <header className="landing-header landing-container">
        <Link href="/" aria-label="Aperture home" className="landing-brand"><Aperture aria-hidden="true" />{APP_NAME}<span>.</span></Link>
        <nav aria-label="Main" className="landing-nav">
          <a href="#workflow" className="landing-nav-section">How it works</a>
          <a href="#questions" className="landing-nav-section">Questions</a>
          <Link href="/login" className="landing-signin">Sign in</Link>
          <span className="landing-desktop-cta"><Link href="/register" className="landing-button landing-button-small">Get started <ArrowRight aria-hidden="true" size={16} /></Link></span>
        </nav>
      </header>

      <section className="landing-hero landing-container" aria-labelledby="hero-title">
        <p className="landing-kicker"><span /> Made for aesthetic practices</p>
        <h1 id="hero-title">Great care.<br /><span>Clearly captured.</span></h1>
        <p className="landing-intro">The photography workspace for your practice.<br className="landing-wide-break" /> Capture consistently, compare thoughtfully, and keep every patient journey connected.</p>
        <div className="landing-hero-actions"><Link href="/register" className="landing-button">Create your clinic <ArrowRight aria-hidden="true" size={18} /></Link><a href="#preview" className="landing-text-link">Take a closer look <span aria-hidden="true">↓</span></a></div>
        <ul className="landing-assurances" aria-label="Key features">{["Guided photography", "Originals preserved", "Controlled sharing"].map((item) => <li key={item}><Check aria-hidden="true" size={15} />{item}</li>)}</ul>
      </section>

      <section id="preview" className="landing-preview-section landing-container" aria-label="Explore the photography preview">
        <div className="preview-surround"><div className="preview-surround-heading"><span>A little clarity changes everything.</span><Aperture aria-hidden="true" size={26} /></div><PhotographyPreview /><span className="preview-surround-caption">YOUR PRACTICE. A CLEARER PICTURE.</span></div>
      </section>

      <section id="workflow" className="landing-workflow landing-container" aria-labelledby="workflow-title">
        <div className="landing-section-heading"><p className="landing-kicker">One connected workflow</p><h2 id="workflow-title">From the first photo<br />to the bigger picture.</h2><p>Designed around the way you care for patients.<br />Simple at every step. Considered in every detail.</p></div>
        <div className="landing-feature-grid">{workflow.map(({ number, icon: Icon, title, description, detail }) => <article key={number} className="landing-feature"><div className="landing-feature-top"><span className="landing-feature-icon"><Icon aria-hidden="true" size={23} /></span><span>{number}</span></div><p className="landing-feature-label">{detail}</p><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <section className="landing-principle" aria-labelledby="principle-title"><div className="landing-container landing-principle-inner"><ShieldCheck aria-hidden="true" size={36} /><div><p className="landing-kicker">Care extends to the record</p><h2 id="principle-title">Your patients’ stories,<br />handled with intention.</h2></div><div className="landing-principle-copy"><p>Patient records belong in the right workspace. Photographs stay connected to their charts, and your clinic decides what to share.</p><Link href="/register" className="landing-text-link">Build your workspace <ArrowRight aria-hidden="true" size={18} /></Link></div></div></section>

      <section id="questions" className="landing-questions landing-container" aria-labelledby="questions-title"><div><p className="landing-kicker">A few things to know</p><h2 id="questions-title">A clearer view.</h2></div><div>{questions.map(({ question, answer }) => <details key={question} className="landing-question"><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section className="landing-final landing-container" aria-labelledby="final-title"><p className="landing-kicker">Make space for what matters</p><h2 id="final-title">Your next chapter<br />starts with a clearer picture.</h2><Link href="/register" className="landing-button">Create your clinic <ArrowRight aria-hidden="true" size={18} /></Link></section>
      <footer className="landing-footer landing-container"><Link href="/" className="landing-brand"><Aperture aria-hidden="true" />{APP_NAME}.</Link><p>Development prototype. Do not upload real patient photographs or health information.</p><Link href="/login" className="landing-signin">Sign in <ArrowRight aria-hidden="true" size={16} /></Link></footer>
    </div>
  );
}
