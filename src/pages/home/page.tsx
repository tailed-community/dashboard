import { Header } from "@/components/landing/header";
import { UnifiedJobBoard } from "@/components/unified-job-board";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Briefcase, Calendar, Sparkles, Building2, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section - Luma style */}
      <section className="container max-w-6xl px-6 pt-20 pb-12">
        <div className="space-y-6 text-center max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Find your next opportunity
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Discover internships and new grad positions from top companies.
            Built by students, for students.
          </p>
          {!user && (
            <div className="pt-4">
              <Link to="/sign-in">
                <Button size="lg" className="rounded-full px-8">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Quick Links - Card style like Luma */}
      <section className="container max-w-6xl px-6 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/jobs">
            <div className="p-6 bg-card rounded-2xl shadow-soft hover:shadow-soft-lg transition-all cursor-pointer border border-border">
              <Briefcase className="h-6 w-6 mb-3 text-foreground" />
              <h3 className="font-semibold text-foreground">Browse Jobs</h3>
              <p className="text-sm text-muted-foreground mt-1">1000+ positions</p>
            </div>
          </Link>
          <Link to="/companies">
            <div className="p-6 bg-card rounded-2xl shadow-soft hover:shadow-soft-lg transition-all cursor-pointer border border-border">
              <Building2 className="h-6 w-6 mb-3 text-foreground" />
              <h3 className="font-semibold text-foreground">Companies</h3>
              <p className="text-sm text-muted-foreground mt-1">Discover teams</p>
            </div>
          </Link>
          <Link to="/events">
            <div className="p-6 bg-card rounded-2xl shadow-soft hover:shadow-soft-lg transition-all cursor-pointer border border-border">
              <Calendar className="h-6 w-6 mb-3 text-foreground" />
              <h3 className="font-semibold text-foreground">Events</h3>
              <p className="text-sm text-muted-foreground mt-1">Upcoming</p>
            </div>
          </Link>
          <Link to="/spotlight">
            <div className="p-6 bg-card rounded-2xl shadow-soft hover:shadow-soft-lg transition-all cursor-pointer border border-border">
              <Sparkles className="h-6 w-6 mb-3 text-foreground" />
              <h3 className="font-semibold text-foreground">Spotlight</h3>
              <p className="text-sm text-muted-foreground mt-1">Student projects</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Featured Jobs Section */}
      <section className="container max-w-6xl px-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Featured Opportunities</h2>
          <Link to="/jobs">
            <Button variant="ghost" className="gap-2">
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <UnifiedJobBoard limit={6} />
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container max-w-6xl px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold mb-4">Community</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/association" className="hover:text-foreground transition-colors">Student Association</Link></li>
                <li><Link to="/spotlight" className="hover:text-foreground transition-colors">Student Spotlight</Link></li>
                <li><a href="https://github.com/tailed-community" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Opportunities</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/jobs" className="hover:text-foreground transition-colors">All Jobs</Link></li>
                <li><Link to="/companies" className="hover:text-foreground transition-colors">Companies</Link></li>
                <li><Link to="/events" className="hover:text-foreground transition-colors">Events</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:support@tailed.ca" className="hover:text-foreground transition-colors">Support</a></li>
                <li><a href="mailto:feedback@tailed.ca" className="hover:text-foreground transition-colors">Feedback</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Tail'ed Community. Built with ❤️ by students.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
