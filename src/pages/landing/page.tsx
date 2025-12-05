import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  Github,
  Star,
  Users,
  Rocket,
  Sparkles,
  Briefcase,
  Code2,
  TrendingUp,
  ArrowRight,
  HeartHandshake,
  BookOpen,
  Globe,
  Puzzle,
} from "lucide-react";
import { Header } from "@/components/landing/header";
import { UnifiedJobBoard } from "@/components/unified-job-board";

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-secondary/20 text-foreground">
      <Header />
      
      {/* Dynamic background elements with brand colors */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-5rem] h-[35rem] w-[35rem] rounded-full bg-gradient-to-br from-[#EB7A24]/30 to-[#FFD37D]/20 blur-3xl animate-pulse" />
        <div className="absolute right-[-8rem] top-[15%] h-[32rem] w-[32rem] rounded-full bg-gradient-to-tr from-[#8ec4f3]/30 to-[#c0bbff]/20 blur-3xl animate-pulse [animation-delay:2s]" />
        <div className="absolute left-[-5rem] bottom-[20%] h-[28rem] w-[28rem] rounded-full bg-gradient-to-tl from-[#ef4441]/20 to-[#FFD37D]/25 blur-3xl animate-pulse [animation-delay:4s]" />
        <div className="absolute right-[15%] bottom-[-8rem] h-[30rem] w-[30rem] rounded-full bg-gradient-to-bl from-[#c0bbff]/25 to-[#8ec4f3]/20 blur-3xl animate-pulse [animation-delay:1s]" />
      </div>

      {/* Hero Section - Asymmetrical Layout */}
      <header className="mx-auto max-w-7xl px-6 pt-12 pb-8 sm:pt-20 sm:pb-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Main Content */}
          <div className="space-y-6">
            <Badge 
              variant="secondary" 
              className="gap-2 px-4 py-2 text-sm bg-gradient-to-r from-primary/20 to-secondary/20 border-primary/30 inline-flex"
            >
              <Sparkles className="h-4 w-4 text-primary" /> 
              <span className="bg-gradient-to-r from-primary to-[#ef4441] bg-clip-text text-transparent font-semibold">
                Built by Students, For Students
              </span>
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              <span className="block">Empower Your</span>
              <span className="block bg-gradient-to-r from-[#EB7A24] via-[#ef4441] to-[#c0bbff] bg-clip-text text-transparent">
                Growth Journey
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
              A world where every student with talent and grit can access meaningful opportunities—and where creativity meets recognition.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link to="/jobs">
                <Button 
                  size="lg" 
                  className="gap-2 bg-gradient-to-r from-primary to-[#ef4441] hover:opacity-90 text-lg px-8 shadow-lg"
                >
                  <Briefcase className="h-5 w-5" /> Explore Opportunities
                </Button>
              </Link>
              <Link to="/sign-in">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="gap-2 text-lg px-8 border-2 border-primary/50 hover:bg-primary/10"
                >
                  <Users className="h-5 w-5" /> Join Community
                </Button>
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap items-center gap-6 pt-6">
              <a
                href="https://github.com/tailed-community/dashboard/stargazers"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Star className="h-4 w-4 fill-[#FFD37D] text-[#FFD37D]" />
                <span className="font-semibold">Open Source</span>
              </a>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-[#8ec4f3]" />
                <span className="font-semibold">1000+ Opportunities</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-[#c0bbff]" />
                <span className="font-semibold">Student-First</span>
              </div>
            </div>
          </div>

          {/* Right side - Visual Element */}
          <div className="relative lg:ml-auto">
            <div className="relative rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/10 to-background p-8 border-2 border-primary/20 shadow-2xl backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-background/80 rounded-xl border border-primary/20 transform hover:scale-105 transition-transform">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#EB7A24] to-[#FFD37D] flex items-center justify-center">
                    <Code2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Student Creator</div>
                    <div className="text-sm text-muted-foreground">Build & Share Projects</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-background/80 rounded-xl border border-primary/20 transform hover:scale-105 transition-transform">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#8ec4f3] to-[#c0bbff] flex items-center justify-center">
                    <Rocket className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Get Recognized</div>
                    <div className="text-sm text-muted-foreground">Showcase Your Talent</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-background/80 rounded-xl border border-primary/20 transform hover:scale-105 transition-transform">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#ef4441] to-[#EB7A24] flex items-center justify-center">
                    <Briefcase className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Find Opportunities</div>
                    <div className="text-sm text-muted-foreground">Your Dream Job Awaits</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            What makes Tail’ed different
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<HeartHandshake className="h-5 w-5" />}
              title="Built by and for students"
              description="A community where your voice, projects, and ambitions truly matter."
            />
            <Feature
              icon={<Puzzle className="h-5 w-5" />}
              title="Modern stack"
              description="React + TypeScript, shadcn/ui, Tailwind, Firebase, Stripe, and Paraglide i18n."
            />
            <Feature
              icon={<BookOpen className="h-5 w-5" />}
              title="Documentation"
              description="Clear, actionable docs and examples to help you contribute fast."
            />
            <Feature
              icon={<Globe className="h-5 w-5" />}
              title="Internationalized"
              description="First-class localization so the community can thrive worldwide."
            />
            <Feature
              icon={<Users className="h-5 w-5" />}
              title="Community-first"
              description="Hackathons, challenges, and spotlights to help you grow and get noticed."
            />
            <Feature
              icon={<Star className="h-5 w-5" />}
              title="Open source"
              description="MIT licensed. Transparent, collaborative, and welcoming to newcomers."
            />
          </div>
        </div>
      </section>

      {/* Job Board Showcase Section */}
      <section className="relative py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6">
          {/* Section Header */}
          <div className="text-center mb-12">
            <Badge 
              variant="outline" 
              className="mb-4 gap-2 px-4 py-2 border-primary/30 bg-primary/5"
            >
              <Briefcase className="h-4 w-4 text-primary" />
              <span className="text-primary font-semibold">Live Opportunities</span>
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-[#EB7A24] to-[#ef4441] bg-clip-text text-transparent">
                Latest Opportunities
              </span>
              <span className="text-foreground"> for Student Creators</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover internships and new grad positions from top companies. No gatekeeping, just opportunities.
            </p>
          </div>

          {/* Job Board Component */}
          <div className="relative">
              <UnifiedJobBoard limit={8} />
          </div>

          {/* CTA to full job board */}
          <div className="text-center mt-8">
            <Link to="/jobs">
              <Button 
                size="lg" 
                variant="outline"
                className="gap-2 text-lg px-8 border-2 border-primary hover:bg-primary hover:text-primary-foreground"
              >
                View All Opportunities 
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Student Impact Section */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background to-transparent" />
        
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Built for <span className="bg-gradient-to-r from-[#8ec4f3] to-[#c0bbff] bg-clip-text text-transparent">Student Creators</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A platform where your talent, grit, and creativity are celebrated and rewarded.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <ImpactCard
              icon={<Code2 className="h-6 w-6" />}
              title="Showcase Your Work"
              description="Build your portfolio and highlight your projects, hackathon wins, and open source contributions."
              gradient="from-[#EB7A24] to-[#FFD37D]"
            />
            <ImpactCard
              icon={<Rocket className="h-6 w-6" />}
              title="Get Discovered"
              description="Connect with companies looking for talented students like you. Your next opportunity is here."
              gradient="from-[#8ec4f3] to-[#c0bbff]"
            />
            <ImpactCard
              icon={<Users className="h-6 w-6" />}
              title="Join the Community"
              description="Network with fellow student creators, collaborate on projects, and grow together."
              gradient="from-[#ef4441] to-[#EB7A24]"
            />
            <ImpactCard
              icon={<Star className="h-6 w-6" />}
              title="Open Source"
              description="Contribute to our MIT-licensed platform and make it better for everyone."
              gradient="from-[#FFD37D] to-[#8ec4f3]"
            />
            <ImpactCard
              icon={<Sparkles className="h-6 w-6" />}
              title="No Gatekeeping"
              description="Access opportunities without barriers. If you have the talent and grit, you belong here."
              gradient="from-[#c0bbff] to-[#ef4441]"
            />
            <ImpactCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Track Your Growth"
              description="Monitor your applications, achievements, and progress all in one place."
              gradient="from-[#EB7A24] to-[#c0bbff]"
            />
          </div>
        </div>
      </section>

      {/* Contribute */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">
                Contribute in 3 steps
              </h2>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>Fork the repository on GitHub</li>
                <li>Create a feature branch</li>
                <li>Open a pull request — we'll review and help you land it</li>
              </ol>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base">
                    Suggested workflow
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                    <code>
                      {`# 1) Fork & clone
git clone https://github.com/tailed-community/dashboard
cd dashboard

# 2) Install & run
npm install
npm run dev

# 3) Create your branch
git checkout -b feat/amazing-contribution

# 4) Commit & push
git commit -m "feat: add awesome thing"
git push origin feat/amazing-contribution

# 5) Open a PR on GitHub`}
                    </code>
                  </pre>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Github className="h-4 w-4" /> Good first issues
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  New to the project? Pick up a starter task and make your first
                  meaningful contribution.
                  <div className="mt-4">
                    <a
                      className="text-primary underline underline-offset-4"
                      href="https://github.com/tailed-community/dashboard/labels/good%20first%20issue"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Browse good first issues →
                    </a>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HeartHandshake className="h-4 w-4" /> Code of Conduct
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  We’re committed to a welcoming, inclusive community.
                  <div className="mt-4">
                    <a
                      className="text-primary underline underline-offset-4"
                      href="/docs/CODE_OF_CONDUCT.md"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read our Code of Conduct →
                    </a>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4" /> Contribution Guide
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Learn how to set up your environment, run the app, and submit
                  great pull requests.
                  <div className="mt-4">
                    <a
                      className="text-primary underline underline-offset-4"
                      href="/CONTRIBUTING.md"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read CONTRIBUTING.md →
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Get involved CTA */}
      <section className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Ready to get involved?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Whether you’re fixing a typo or building a feature, you’re welcome
            here. Star the repo, join the community, and let’s build the future
            of early‑career tech together.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://github.com/tailed-community/dashboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="gap-2">
                <Star className="h-4 w-4" /> Star the repo
              </Button>
            </a>
            <Link to="/sign-in">
              <Button size="lg" variant="outline" className="gap-2">
                <Users className="h-4 w-4" /> Join now
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="relative rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/10 to-background p-12 sm:p-16 border-2 border-primary/30 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#EB7A24]/10 via-[#8ec4f3]/10 to-[#c0bbff]/10 animate-pulse" />
            
            <div className="relative z-10">
              <Badge 
                variant="secondary" 
                className="mb-6 gap-2 px-4 py-2 bg-primary/20 border-primary/40"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-primary font-semibold">Start Your Journey Today</span>
              </Badge>
              
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
                Ready to Lead Your Own <span className="bg-gradient-to-r from-[#EB7A24] via-[#ef4441] to-[#c0bbff] bg-clip-text text-transparent">Growth</span>?
              </h2>
              
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of student creators who are building their future, one opportunity at a time. No barriers, just possibilities.
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link to="/sign-in">
                  <Button 
                    size="lg" 
                    className="gap-2 bg-gradient-to-r from-primary to-[#ef4441] hover:opacity-90 text-lg px-10 shadow-xl"
                  >
                    <Rocket className="h-5 w-5" /> Get Started Free
                  </Button>
                </Link>
                <a
                  href="https://github.com/tailed-community/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="gap-2 text-lg px-10 border-2 border-primary/50 hover:bg-primary/10"
                  >
                    <Github className="h-5 w-5" /> Star on GitHub
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Impact Card Component
interface ImpactCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

function ImpactCard({ icon, title, description, gradient }: ImpactCardProps) {
  return (
    <div className="relative group">
      <div className={`absolute -inset-px bg-gradient-to-r ${gradient} rounded-xl opacity-75 group-hover:opacity-100 blur transition duration-300`} />
      <div className="relative h-full bg-background p-6 rounded-xl border border-border">
        <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${gradient} text-white mb-4`}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
