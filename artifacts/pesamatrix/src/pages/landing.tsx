import { Link } from "wouter";
import {
  TrendingUp,
  Cloud,
  Zap,
  CreditCard,
  ShieldCheck,
  Users,
  BookOpen,
  Newspaper,
  CheckCircle2,
  Phone,
  MessageCircle,
  ExternalLink,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  { icon: Cloud, title: "Cloud-to-Cloud Trading", desc: "Trades are replicated automatically between MT5 accounts with zero manual intervention." },
  { icon: Zap, title: "MetaApi CopyFactory", desc: "Powered by MetaApi's enterprise-grade CopyFactory engine for fast, reliable signal delivery." },
  { icon: CreditCard, title: "M-Pesa Payments", desc: "Subscribe instantly using M-Pesa STK Push. No card required — pay from your phone." },
  { icon: ShieldCheck, title: "Admin-Approved Signals", desc: "Only vetted, approved master traders are allowed to publish signals on the platform." },
  { icon: Users, title: "Automated Management", desc: "Slave accounts are bound, suspended, and managed automatically based on subscription status." },
  { icon: BookOpen, title: "Education Resources", desc: "Access curated trading guides, videos, and articles to sharpen your edge." },
  { icon: Newspaper, title: "Market News", desc: "Stay updated with forex, crypto, and commodity news published by our team." },
];

const steps = [
  { num: "01", title: "Create an Account", desc: "Register with your name, email, and phone number in under a minute." },
  { num: "02", title: "Subscribe via M-Pesa", desc: "Choose the number of trading days you want and pay instantly using STK Push." },
  { num: "03", title: "Start Copying Trades", desc: "Link your MT5 slave account to an approved master and watch trades copy automatically." },
];

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.67a8.18 8.18 0 0 0 4.79 1.52V7.73a4.85 4.85 0 0 1-1.02-.04Z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">PESAMATRIX</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Get Started
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-green-600/5 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 text-center relative">
          <Badge className="mb-6 bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/20 text-xs px-3 py-1">
            Cloud-to-Cloud Copy Trading
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-tight mb-6">
            Copy Expert Trades
            <br />
            <span className="text-blue-400">Automatically</span> to Your MT5
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            PesaMatrix connects you with admin-approved signal providers. Subscribe via M-Pesa,
            link your account, and start copying profitable trades with zero manual effort.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 w-full sm:w-auto">
                Start Copying Trades
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-muted px-8 w-full sm:w-auto">
                Sign In to Dashboard
              </Button>
            </Link>
          </div>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-md mx-auto">
            {[
              { val: "MT5", label: "Compatible" },
              { val: "M-Pesa", label: "Payments" },
              { val: "24/7", label: "Automated" },
            ].map(({ val, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-blue-400">{val}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/20">
              Platform Features
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Everything you need to copy trade</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-sm">
              Built for both signal providers and subscribers on a single, secure platform.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-5 rounded-xl bg-card border border-border hover:border-blue-600/40 hover:bg-blue-600/5 transition-all group"
              >
                <div className="h-10 w-10 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center mb-4 group-hover:bg-blue-600/30 transition-colors">
                  <Icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
            {/* Filler card */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-600/10 to-green-600/10 border border-blue-600/20 flex flex-col items-start justify-between">
              <CheckCircle2 className="h-10 w-10 text-green-400 mb-4" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Ready to start?</h3>
                <p className="text-xs text-muted-foreground mb-4">Create your account and subscribe in minutes.</p>
                <Link href="/register">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                    Get Started
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/20">
              How it Works
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Three steps to automated trading</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map(({ num, title, desc }, i) => (
              <div key={num} className="relative flex flex-col items-start p-6 rounded-xl bg-card border border-border">
                <span className="text-5xl font-black text-blue-600/20 mb-4 leading-none">{num}</span>
                <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <div className="h-6 w-6 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
                      <ChevronRight className="h-3 w-3 text-blue-400" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/register">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-10">
                Create Free Account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/20">
              Get in Touch
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Contact us</h2>
            <p className="text-muted-foreground mt-3 text-sm">We are available via phone, WhatsApp, and TikTok.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {/* Phone */}
            <a
              href="tel:+254717434943"
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card border border-border hover:border-blue-600/40 hover:bg-blue-600/5 transition-all group text-center"
            >
              <div className="h-12 w-12 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Phone className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Phone</p>
                <p className="text-sm font-semibold text-foreground group-hover:text-blue-400 transition-colors">+254 717 434 943</p>
                <p className="text-xs text-muted-foreground mt-0.5">+254 781 585 319</p>
              </div>
            </a>

            {/* WhatsApp */}
            <a
              href="https://wa.me/254717434943"
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card border border-border hover:border-green-600/40 hover:bg-green-600/5 transition-all group text-center"
            >
              <div className="h-12 w-12 rounded-xl bg-green-600/20 border border-green-600/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MessageCircle className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">WhatsApp</p>
                <p className="text-sm font-semibold text-foreground group-hover:text-green-400 transition-colors">+254 717 434 943</p>
                <p className="text-xs text-muted-foreground mt-0.5">Chat with us directly</p>
              </div>
            </a>

            {/* TikTok */}
            <a
              href="https://tiktok.com/@pesamatrixsignals"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card border border-border hover:border-blue-600/40 hover:bg-blue-600/5 transition-all group text-center"
            >
              <div className="h-12 w-12 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <TikTokIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">TikTok</p>
                <p className="text-sm font-semibold text-foreground group-hover:text-blue-400 transition-colors">@pesamatrixsignals</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                  Follow us <ExternalLink className="h-3 w-3" />
                </p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/40 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight">PESAMATRIX</span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
              <Link href="/register" className="hover:text-foreground transition-colors">Register</Link>
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            </div>

            {/* Contact strip */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="tel:+254717434943" className="hover:text-blue-400 transition-colors">+254717434943</a>
              <a href="https://wa.me/254717434943" className="hover:text-green-400 transition-colors">WhatsApp</a>
              <a
                href="https://tiktok.com/@pesamatrixsignals"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 transition-colors"
              >
                @pesamatrixsignals
              </a>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            PesaMatrix — Secure, Automated, Professional Copy Trading
          </div>
        </div>
      </footer>
    </div>
  );
}
