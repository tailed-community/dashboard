import { Link } from "react-router-dom";
import { Header } from "@/components/landing/header";
import { Target, Eye, Users, Rocket, Heart, TrendingUp, Globe } from "lucide-react";
import { SiYoutube, SiInstagram, SiDiscord, SiGithub, SiLinkedin } from "react-icons/si";

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
    gradient: "from-brand-orange to-brand-yellow",
    hoverColor: "brand-orange/30",
    links: [
      { type: "linkedin", url: "https://www.linkedin.com/in/toshi" }
    ]
  },
  {
    name: "Elise",
    title: "Community Ambassador",
    image: "https://via.placeholder.com/150",
    gradient: "from-brand-blue to-purple-600",
    hoverColor: "brand-blue/30",
    links: [
      { type: "linkedin", url: "https://www.linkedin.com/in/elise" }
    ]
  },
  {
    name: "Vipul",
    title: "Community Ambassador",
    image: "https://via.placeholder.com/150",
    gradient: "from-purple-500 to-pink-600",
    hoverColor: "purple-500/30",
    links: [
      { type: "linkedin", url: "https://www.linkedin.com/in/vipul" }
    ]
  }
];

const getSocialIcon = (type: SocialLink["type"]) => {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "linkedin":
      return <SiLinkedin className={iconClass} />;
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
    <div>
      <main className="w-full">
        {/* Hero Section */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-24 px-4 md:px-6 max-w-7xl mx-auto flex flex-col items-center text-center relative isolate">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-gradient-to-tr from-[oklch(0.62_0.15_45)]/30 via-[oklch(0.88_0.12_80)]/30 to-[oklch(0.77_0.08_220)]/30 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-pink-900/30 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-cream-50 dark:bg-brand-cream-900 border border-brand-cream-100 dark:border-brand-cream-800 mb-8 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-orange">About Us</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-brand-cream-950 dark:text-brand-cream-50 mb-6 max-w-5xl mx-auto leading-[1.05]">
            Building the Future of <span className="bg-gradient-to-r from-brand-orange to-brand-yellow bg-clip-text text-transparent">Student Communities</span>
          </h1>
          
          <p className="text-xl text-brand-cream-600 dark:text-brand-cream-400 max-w-3xl mx-auto leading-relaxed font-light">
            Tail'ed Community is where student communities come together to create opportunities, share knowledge, and grow together.
          </p>
        </section>

        {/* Mission & Vision Section */}
        <section className="px-4 pb-24 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Mission Card */}
            <div className="relative bg-brand-cream-50 dark:bg-brand-cream-900/50 rounded-[2.5rem] p-8 md:p-12 overflow-hidden border border-brand-cream-200 dark:border-brand-cream-800 shadow-xl shadow-brand-cream-100/50 dark:shadow-none group hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[300px] h-[300px] bg-[oklch(0.62_0.15_45)]/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-brand-orange to-brand-yellow flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-8 h-8 text-white" />
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-6 tracking-tight">
                  Our Mission
                </h2>
                
                <p className="text-lg text-brand-cream-600 dark:text-brand-cream-400 leading-relaxed">
                  To empower students all over the world to lead their own growth through peer-driven initiatives, leveraging Tail'ed's network to create opportunities and recognition.
                </p>
              </div>
            </div>

            {/* Vision Card */}
            <div className="relative bg-brand-cream-50 dark:bg-brand-cream-900/50 rounded-[2.5rem] p-8 md:p-12 overflow-hidden border border-brand-cream-200 dark:border-brand-cream-800 shadow-xl shadow-brand-cream-100/50 dark:shadow-none group hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[300px] h-[300px] bg-[oklch(0.77_0.08_220)]/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-brand-blue to-purple-600 flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Eye className="w-8 h-8 text-white" />
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-6 tracking-tight">
                  Our Vision
                </h2>
                
                <p className="text-lg text-brand-cream-600 dark:text-brand-cream-400 leading-relaxed">
                  A world where every student with talent and grit can access meaningful opportunities—and where every company can discover and invest in the leaders of tomorrow.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-24 bg-brand-cream-50 dark:bg-background-dark">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-brand-cream-950 dark:text-brand-cream-50">
                Our Values
              </h2>
              <p className="text-brand-cream-600 dark:text-brand-cream-400 text-lg">
                The principles that guide everything we do at Tail'ed Community.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 rounded-3xl bg-brand-cream-100 dark:bg-brand-cream-900/50 hover:bg-brand-cream-50 dark:hover:bg-brand-cream-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-brand-cream-100 dark:hover:border-brand-cream-700">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-3 text-center md:text-left">
                  Community First
                </h3>
                <p className="text-brand-cream-600 dark:text-brand-cream-400 leading-relaxed text-center md:text-left">
                  We believe in the power of peer-driven communities to create lasting impact and meaningful connections.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-brand-cream-100 dark:bg-brand-cream-900/50 hover:bg-brand-cream-50 dark:hover:bg-brand-cream-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-brand-cream-100 dark:hover:border-brand-cream-700">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-brand-orange to-brand-yellow flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <Rocket className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-3 text-center md:text-left">
                  Student Empowerment
                </h3>
                <p className="text-brand-cream-600 dark:text-brand-cream-400 leading-relaxed text-center md:text-left">
                  We empower students to take ownership of their growth and create their own opportunities.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-brand-cream-100 dark:bg-brand-cream-900/50 hover:bg-brand-cream-50 dark:hover:bg-brand-cream-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-brand-cream-100 dark:hover:border-brand-cream-700">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <Heart className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-3 text-center md:text-left">
                  Inclusivity
                </h3>
                <p className="text-brand-cream-600 dark:text-brand-cream-400 leading-relaxed text-center md:text-left">
                  Every student with talent and grit deserves access to meaningful opportunities, regardless of background.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-brand-cream-100 dark:bg-brand-cream-900/50 hover:bg-brand-cream-50 dark:hover:bg-brand-cream-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-brand-cream-100 dark:hover:border-brand-cream-700">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-3 text-center md:text-left">
                  Continuous Growth
                </h3>
                <p className="text-brand-cream-600 dark:text-brand-cream-400 leading-relaxed text-center md:text-left">
                  We foster a culture of learning, improvement, and pushing boundaries together.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-brand-cream-100 dark:bg-brand-cream-900/50 hover:bg-brand-cream-50 dark:hover:bg-brand-cream-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-brand-cream-100 dark:hover:border-brand-cream-700">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-3 text-center md:text-left">
                  Innovation
                </h3>
                <p className="text-brand-cream-600 dark:text-brand-cream-400 leading-relaxed text-center md:text-left">
                  We constantly innovate to create better tools and experiences for student communities.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-brand-cream-100 dark:bg-brand-cream-900/50 hover:bg-brand-cream-50 dark:hover:bg-brand-cream-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-brand-cream-100 dark:hover:border-brand-cream-700">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto md:mx-0 mb-6 text-white shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-3 text-center md:text-left">
                  Transparency
                </h3>
                <p className="text-brand-cream-600 dark:text-brand-cream-400 leading-relaxed text-center md:text-left">
                  We build trust through open communication and honest relationships with our community.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-brand-cream-950 dark:text-brand-cream-50">
              The Team
            </h2>
            <p className="text-brand-cream-600 dark:text-brand-cream-400 text-lg">
              Meet the people building Tail'ed Community and supporting our community.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {teamMembers.map((member, index) => (
              <div 
                key={index}
                className={`group relative bg-brand-cream-50 dark:bg-brand-cream-900/50 rounded-3xl p-8 text-center border border-brand-cream-200 dark:border-brand-cream-800 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:border-${member.hoverColor} dark:hover:border-${member.hoverColor}`}
              >
                <div className="relative inline-block mb-6">
                  <div className={`size-32 rounded-full bg-gradient-to-br ${member.gradient} p-1 shadow-lg`}>
                    <div className="size-full rounded-full bg-brand-cream-100 dark:bg-brand-cream-800 overflow-hidden">
                      <img 
                        src={member.image} 
                        alt={member.name}
                        className="size-full object-cover"
                      />
                    </div>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-2">
                  {member.name}
                </h3>
                <p className="text-brand-cream-600 dark:text-brand-cream-400 font-medium mb-4">
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
                      className="text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-600 dark:hover:text-brand-cream-300 transition-colors"
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
          <div className="max-w-5xl mx-auto bg-brand-cream-950 dark:bg-brand-cream-50 rounded-[2.5rem] p-12 md:p-24 text-center relative overflow-hidden group">
            <div className="relative z-10 space-y-8">
              <h2 className="text-4xl md:text-6xl font-bold text-brand-cream-50 dark:text-brand-cream-950 tracking-tight max-w-3xl mx-auto leading-tight">
                Join us in building the future
              </h2>
              <p className="text-lg text-brand-cream-300 dark:text-brand-cream-600 max-w-xl mx-auto">
                Be part of a global community of students creating opportunities and shaping tomorrow.
              </p>
              <div className="flex justify-center pt-4">
                <Link to="/sign-in" className="px-10 py-4 bg-brand-cream-50 dark:bg-brand-cream-950 text-brand-cream-950 dark:text-brand-cream-50 rounded-full font-bold text-lg hover:bg-brand-cream-100 dark:hover:bg-brand-cream-800 transition-colors shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] dark:shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)]">
                  Get Started
                </Link>
              </div>
            </div>
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] bg-brand-blue dark:bg-brand-blue/50 rounded-full blur-[100px] opacity-40 group-hover:opacity-60 transition-opacity duration-1000"></div>
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-orange dark:bg-brand-orange/50 rounded-full blur-[100px] opacity-40 group-hover:opacity-60 transition-opacity duration-1000"></div>
          </div>
        </section>
      </main>
      
            <footer className="border-t border-brand-cream-100 dark:border-brand-cream-800 py-8 bg-brand-cream-50 dark:bg-brand-cream-950">
              <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-8">
                  <Link to="/discover" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">Discover</Link>
                  <Link to="/about" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">About</Link>
                  <a href="mailto:community@tailed.ca" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">Help</a>
                </div>
                <div className="flex items-center gap-6">
                  <Link to="https://www.youtube.com/@tailedcommunity" target="_blank" rel="noopener noreferrer" className="text-brand-cream-400 hover:text-brand-cream-900 dark:hover:text-brand-cream-50 transition-colors">
                    <SiYoutube className="w-5 h-5" />
                  </Link>
                  <Link to="https://www.instagram.com/tailed.community" target="_blank" rel="noopener noreferrer" className="text-brand-cream-400 hover:text-brand-cream-900 dark:hover:text-brand-cream-50 transition-colors">
                    <SiInstagram className="w-5 h-5" />
                  </Link>
                  <Link to="https://discord.gg/gpbtFXTgNQ" target="_blank" rel="noopener noreferrer" className="text-brand-cream-400 hover:text-brand-cream-900 dark:hover:text-brand-cream-50 transition-colors">
                    <SiDiscord className="w-5 h-5" />
                  </Link>
                  <Link to="https://github.com/tailed-community" target="_blank" rel="noopener noreferrer" className="text-brand-cream-400 hover:text-brand-cream-900 dark:hover:text-brand-cream-50 transition-colors">
                    <SiGithub className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </footer>
    </div>
  );
}
