import { Link } from "react-router-dom";
import { Target, Eye, Users, Rocket, Heart, TrendingUp, Globe } from "lucide-react";
import { SiYoutube, SiInstagram, SiDiscord, SiGithub } from "react-icons/si";
import { FaLinkedinIn } from "react-icons/fa";
import { Seo } from "@/components/seo";
import { PlaygroundButton } from "@/components/playground/playground-button";

interface SocialLink {
  type: "linkedin" | "instagram" | "portfolio" | "github" | "twitter";
  url: string;
}

interface TeamMember {
  name: string;
  title: string;
  image: string;
  gradient: string;
  hoverColor: string;
  links: SocialLink[];
}

const teamMembers: TeamMember[] = [
  {
    name: "Toshi",
    title: "Community Manager",
    image: "https://via.placeholder.com/150",
    gradient: "from-joy-grass to-joy-grass-bright",
    hoverColor: "joy-grass/40",
    links: [
      { type: "linkedin", url: "https://www.linkedin.com/in/toshi" }
    ]
  },
  {
    name: "Elise",
    title: "Community Ambassador",
    image: "https://via.placeholder.com/150",
    gradient: "from-joy-sky to-joy-sky-ink",
    hoverColor: "joy-sky/40",
    links: [
      { type: "linkedin", url: "https://www.linkedin.com/in/elise" }
    ]
  },
  {
    name: "Vipul",
    title: "Community Ambassador",
    image: "https://via.placeholder.com/150",
    gradient: "from-joy-sun to-joy-sun-ink",
    hoverColor: "joy-sun/50",
    links: [
      { type: "linkedin", url: "https://www.linkedin.com/in/vipul" }
    ]
  }
];

const getSocialIcon = (type: SocialLink["type"]) => {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "linkedin":
      return <FaLinkedinIn className={iconClass} />;
    case "instagram":
      return <SiInstagram className={iconClass} />;
    case "github":
      return <SiGithub className={iconClass} />;
    case "twitter":
      return <SiYoutube className={iconClass} />;
    case "portfolio":
      return <Globe className={iconClass} />;
    default:
      return null;
  }
};

export default function AboutPage() {
  return (
    <div style={{ colorScheme: "light" }}>
      <Seo
        title="About Tail'ed Community — a Non-Profit Built by Students"
        noSuffix
        description="Tail'ed Community is a non-profit platform built by students, for students: thousands of job listings, hackathons, and communities. Free forever."
        path="/about"
      />
      <main className="w-full">
        {/* Hero Section */}
        <section className="pt-20 pb-16 md:pt-28 md:pb-24 px-4 md:px-6 max-w-7xl mx-auto flex flex-col items-center text-center relative isolate">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-gradient-to-tr from-joy-grass/20 via-joy-sun/25 to-joy-sky/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-joy-grass/10 border border-joy-grass/20 mb-8 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-joy-grass">About Us</span>
          </div>

          <h1 className="joy-display text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-joy-ink mb-6 max-w-5xl mx-auto leading-[1.05]">
            Building the Future of <span className="text-joy-grass">Student Communities</span>
          </h1>

          <p className="text-xl text-joy-ink-muted max-w-3xl mx-auto leading-relaxed">
            Tail'ed Community is where student communities come together to create opportunities, share knowledge, and grow together.
          </p>
        </section>

        {/* Mission & Vision Section */}
        <section className="px-4 pb-24 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Mission Card */}
            <div className="relative bg-white rounded-[2.5rem] p-8 md:p-12 overflow-hidden border border-joy-ink/8 shadow-sm group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[300px] h-[300px] bg-joy-grass/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-joy-grass to-joy-grass-bright flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-8 h-8 text-white" />
                </div>

                <h2 className="joy-display text-3xl md:text-4xl font-extrabold text-joy-ink mb-6 tracking-tight">
                  Our Mission
                </h2>

                <p className="text-lg text-joy-ink-muted leading-relaxed">
                  To empower students all over the world to lead their own growth through peer-driven initiatives, leveraging Tail'ed's network to create opportunities and recognition.
                </p>
              </div>
            </div>

            {/* Vision Card */}
            <div className="relative bg-white rounded-[2.5rem] p-8 md:p-12 overflow-hidden border border-joy-ink/8 shadow-sm group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[300px] h-[300px] bg-joy-sky/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-joy-sky to-joy-sky-ink flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Eye className="w-8 h-8 text-white" />
                </div>

                <h2 className="joy-display text-3xl md:text-4xl font-extrabold text-joy-ink mb-6 tracking-tight">
                  Our Vision
                </h2>

                <p className="text-lg text-joy-ink-muted leading-relaxed">
                  A world where every student with talent and grit can access meaningful opportunities—and where every company can discover and invest in the leaders of tomorrow.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-24 bg-joy-surface-alt/60">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="joy-display text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-joy-ink">
                Our Values
              </h2>
              <p className="text-joy-ink-muted text-lg">
                The principles that guide everything we do at Tail'ed Community.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 rounded-3xl bg-white hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-joy-ink/8 hover:border-joy-grass/40">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-joy-grass to-joy-grass-bright flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="joy-display text-xl font-extrabold text-joy-ink mb-3 text-center md:text-left">
                  Community First
                </h3>
                <p className="text-joy-ink-muted leading-relaxed text-center md:text-left">
                  We believe in the power of peer-driven communities to create lasting impact and meaningful connections.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-white hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-joy-ink/8 hover:border-joy-sun/60">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-joy-sun to-joy-sun-ink flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <Rocket className="w-8 h-8" />
                </div>
                <h3 className="joy-display text-xl font-extrabold text-joy-ink mb-3 text-center md:text-left">
                  Student Empowerment
                </h3>
                <p className="text-joy-ink-muted leading-relaxed text-center md:text-left">
                  We empower students to take ownership of their growth and create their own opportunities.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-white hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-joy-ink/8 hover:border-joy-sky/50">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-joy-sky to-joy-sky-ink flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <Heart className="w-8 h-8" />
                </div>
                <h3 className="joy-display text-xl font-extrabold text-joy-ink mb-3 text-center md:text-left">
                  Inclusivity
                </h3>
                <p className="text-joy-ink-muted leading-relaxed text-center md:text-left">
                  Every student with talent and grit deserves access to meaningful opportunities, regardless of background.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-white hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-joy-ink/8 hover:border-joy-grass/40">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-joy-grass to-joy-grass-bright flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <h3 className="joy-display text-xl font-extrabold text-joy-ink mb-3 text-center md:text-left">
                  Continuous Growth
                </h3>
                <p className="text-joy-ink-muted leading-relaxed text-center md:text-left">
                  We foster a culture of learning, improvement, and pushing boundaries together.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-white hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-joy-ink/8 hover:border-joy-sun/60">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-joy-sun to-joy-sun-ink flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="joy-display text-xl font-extrabold text-joy-ink mb-3 text-center md:text-left">
                  Innovation
                </h3>
                <p className="text-joy-ink-muted leading-relaxed text-center md:text-left">
                  We constantly innovate to create better tools and experiences for student communities.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-white hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-joy-ink/8 hover:border-joy-sky/50">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-joy-sky to-joy-sky-ink flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="joy-display text-xl font-extrabold text-joy-ink mb-3 text-center md:text-left">
                  Transparency
                </h3>
                <p className="text-joy-ink-muted leading-relaxed text-center md:text-left">
                  We build trust through open communication and honest relationships with our community.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="joy-display text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-joy-ink">
              The Team
            </h2>
            <p className="text-joy-ink-muted text-lg">
              Meet the people building Tail'ed Community and supporting our community.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className="group relative bg-white rounded-3xl p-8 text-center border border-joy-ink/8 hover:shadow-md hover:-translate-y-2 transition-all duration-300 hover:border-joy-grass/40"
              >
                <div className="relative inline-block mb-6">
                  <div className={`size-32 rounded-full bg-gradient-to-br ${member.gradient} p-1 shadow-lg`}>
                    <div className="size-full rounded-full bg-joy-surface-sunk overflow-hidden">
                      <img
                        src={member.image}
                        alt={member.name}
                        className="size-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <h3 className="joy-display text-2xl font-extrabold text-joy-ink mb-2">
                  {member.name}
                </h3>
                <p className="text-joy-ink-muted font-medium mb-4">
                  {member.title}
                </p>

                {/* Social Links */}
                <div className="flex items-center justify-center gap-3">
                  {member.links.map((link, linkIndex) => (
                    <a
                      key={linkIndex}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-joy-ink-muted hover:text-joy-grass transition-colors"
                      aria-label={link.type}
                    >
                      {getSocialIcon(link.type)}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 px-6">
          <div className="max-w-5xl mx-auto bg-joy-ink rounded-[2.5rem] p-12 md:p-24 text-center relative overflow-hidden group">
            <div className="relative z-10 space-y-8">
              <h2 className="joy-display text-4xl md:text-6xl font-extrabold text-white tracking-tight max-w-3xl mx-auto leading-tight">
                Join us in building the future
              </h2>
              <p className="text-lg text-white/70 max-w-xl mx-auto">
                Be part of a global community of students creating opportunities and shaping tomorrow.
              </p>
              <div className="flex justify-center pt-4">
                <PlaygroundButton to="/sign-in" className="px-10 py-4 text-lg">
                  Get Started
                </PlaygroundButton>
              </div>
            </div>
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] bg-joy-sky rounded-full blur-[100px] opacity-40 group-hover:opacity-60 transition-opacity duration-1000"></div>
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-joy-grass rounded-full blur-[100px] opacity-40 group-hover:opacity-60 transition-opacity duration-1000"></div>
          </div>
        </section>
      </main>

            <footer className="border-t border-joy-ink/8 py-8 bg-joy-surface-alt/60">
              <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-8">
                  <Link to="/discover" className="text-sm font-medium text-joy-ink-muted hover:text-joy-ink transition-colors">Discover</Link>
                  <Link to="/about" className="text-sm font-medium text-joy-ink-muted hover:text-joy-ink transition-colors">About</Link>
                  <a href="mailto:community@tailed.ca" className="text-sm font-medium text-joy-ink-muted hover:text-joy-ink transition-colors">Help</a>
                </div>
                <div className="flex items-center gap-6">
                  <Link to="https://www.youtube.com/@tailedcommunity" target="_blank" rel="noopener noreferrer" className="text-joy-ink-muted hover:text-joy-grass transition-colors">
                    <SiYoutube className="w-5 h-5" />
                  </Link>
                  <Link to="https://www.instagram.com/tailed.community" target="_blank" rel="noopener noreferrer" className="text-joy-ink-muted hover:text-joy-grass transition-colors">
                    <SiInstagram className="w-5 h-5" />
                  </Link>
                  <Link to="https://discord.gg/gpbtFXTgNQ" target="_blank" rel="noopener noreferrer" className="text-joy-ink-muted hover:text-joy-grass transition-colors">
                    <SiDiscord className="w-5 h-5" />
                  </Link>
                  <Link to="https://github.com/tailed-community" target="_blank" rel="noopener noreferrer" className="text-joy-ink-muted hover:text-joy-grass transition-colors">
                    <SiGithub className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </footer>
    </div>
  );
}
