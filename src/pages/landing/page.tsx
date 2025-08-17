import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  Github,
  Star,
  Users,
  BookOpen,
  Rocket,
  HeartHandshake,
  Globe,
  Puzzle,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/landing/header";

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background text-foreground">
      <Header />
      {/* Background accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-8rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-[-10rem] bottom-[-10rem] h-[28rem] w-[28rem] rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute left-[-10rem] bottom-[10%] h-[22rem] w-[22rem] rounded-full bg-amber-400/20 blur-3xl" />
      </div>

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-6 py-16 sm:py-24 text-center">
        <div className="mb-4 flex justify-center">
          <Badge variant="secondary" className="gap-2 px-3 py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5" /> Open Source • Student-first
          </Badge>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-r from-primary via-amber-500 to-pink-500 bg-clip-text text-transparent">
          Tail’ed Community
        </h1>
        <p className="mt-6 mx-auto max-w-2xl text-muted-foreground">
          Build together. Learn together. Get recognized. A modern, open-source
          community for students and early-career technologists.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/tailed-community"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="gap-2">
              <Github className="h-4 w-4" /> Star on GitHub
            </Button>
          </a>
          <Link to="/sign-in">
            <Button size="lg" variant="outline" className="gap-2">
              <Users className="h-4 w-4" /> Join the community
            </Button>
          </Link>
          <a
            href="https://github.com/tailed-community/dashboard#roadmap"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" variant="ghost" className="gap-2">
              <Rocket className="h-4 w-4" /> View roadmap
            </Button>
          </a>
        </div>

        {/* Badges (shields) */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 opacity-80">
          {/* redirect to https://github.com/tailed-community/dashboard/stargazers */}
          <a
            href="https://github.com/tailed-community/dashboard/stargazers"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              alt="GitHub stars"
              className="h-6"
              src="https://img.shields.io/github/stars/tailed-community/dashboard?style=social"
            />
          </a>
          <img
            alt="GitHub forks"
            className="h-6"
            src="https://img.shields.io/github/forks/tailed-community/dashboard?style=social"
          />
          <img
            alt="License"
            className="h-6"
            src="https://img.shields.io/badge/license-MIT-green"
          />
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
