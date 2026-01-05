import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle,
  Instagram,
  Mail,
  MapPin,
  Rocket,
  Share2,
  ShieldCheck,
  Twitter,
  Users,
} from "lucide-react";
import { Header } from "@/components/landing/header";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs, getFirestore } from "firebase/firestore";
import { SiDiscord, SiGithub, SiInstagram, SiYoutube } from "react-icons/si";
import { getApp } from "firebase/app";

interface Event {
  id: string;
  title: string;
  datetime: Date;
  location?: string;
  city?: string;
  heroImageUrl?: string;
  price?: number;
  attendees?: number;
  maxAttendees?: number;
}

interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  memberCount: number;
  logoUrl?: string;
  bannerUrl?: string;
}

const mockEvent: Event = {
  id: "mock",
  title: "NYC Tech Students Mixer",
  datetime: new Date(),
  location: "The Standard, High Line",
  city: "New York",
  heroImageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAZ3Ujh7h950aqQW1IFQk96kBbq8-Jw6RIG3ELoHJ3XQykj0P-NJQpldCcEbEDZo3wnLUpw5TjhLAxQSZCyrTUsT8_OwcFptbNiPM9afVLwf9dHJFyluseMx2dfrL4WOdJ7SQPOq-YISYLXhaPL02jsZgLeNrlSm2y7ySR4Q811M2dn_SW9iS5c84-FMIY_lki9RbUyvM7uoRuLyHbRSlmcKnzJpQXGvQlQf5sdCtmg6_ZEAeKL_fAa-FmtGTtBBYozzlAEl4tyiEgk)",
  price: 0,
  attendees: 44,
  maxAttendees: 100,
};

const mockCommunity: Community = {
  id: "mock",
  name: "Design Guild",
  description: "A community for student designers to share work, get feedback, and find mentorship.",
  category: "Arts & Culture",
  memberCount: 2400,
  logoUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB5Z-pwwrKkVf2i83sPKxgaGvmwFd292YucasHSDp_QeTRg4Ec6iOuDGYM2A1m03ROjBdO2CSnb7hQN9oqF2okj7LpaOQ524Ug1eKj9sRPKXh6n7UNN6pZQlm2pP4xk7eYLHzlnAGQFpokGqHl9-ZTWzOV4Km3ICb1MekAqWLgGJOxRRw34Kb1PqSrgSXzSiHHFPj5mGEYDojZncq6mf1gprJgw3h3qDIE85Eo-C9Liwq9tGBIACedsSvKnPxsPyrGeYM5h397OXeIJ",
  bannerUrl: undefined,
};

export default function LandingPage() {
  const [featuredEvent, setFeaturedEvent] = useState<Event>(mockEvent);
  const [featuredCommunity, setFeaturedCommunity] = useState<Community>(mockCommunity);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const db = getFirestore(getApp());
        
        // Fetch event
        const eventsRef = collection(db, "events");
        const now = new Date();
        const eventQuery = query(
          eventsRef,
          where("datetime", ">=", now),
          orderBy("datetime", "asc"),
          limit(1)
        );
        
        const eventSnapshot = await getDocs(eventQuery);
        
        if (!eventSnapshot.empty) {
          const doc = eventSnapshot.docs[0];
          const data = doc.data();
          setFeaturedEvent({
            id: doc.id,
            title: data.title,
            datetime: data.datetime.toDate(),
            location: data.location,
            city: data.city,
            heroImageUrl: data.heroImageUrl,
            price: data.price,
            attendees: data.attendees || 0,
            maxAttendees: data.maxAttendees,
          });
        }

        // Fetch community
        const communitiesRef = collection(db, "communities");
        const communityQuery = query(
          communitiesRef,
          orderBy("memberCount", "desc"),
          limit(1)
        );
        
        const communitiesnapshot = await getDocs(communityQuery);
        
        if (!communitiesnapshot.empty) {
          const doc = communitiesnapshot.docs[0];
          const data = doc.data();
          setFeaturedCommunity({
            id: doc.id,
            name: data.name,
            description: data.description,
            category: data.category,
            memberCount: data.memberCount || 0,
            logoUrl: data.logoUrl,
            bannerUrl: data.bannerUrl,
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  const formatEventDateTime = (date: Date) => {
    const now = new Date();
    const diffInHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24 && date.getDate() === now.getDate()) {
      return `Today • ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else if (diffInHours < 48 && date.getDate() === now.getDate() + 1) {
      return `Tomorrow • ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else {
      return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} • ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }
  };

  return (
    <div className="bg-brand-cream dark:bg-neutral-950 font-sans text-brand-cream-900 dark:text-brand-cream-100 overflow-x-hidden transition-colors duration-200 antialiased selection:bg-[oklch(0.62_0.15_45)]/20 selection:text-[oklch(0.62_0.15_45)]">
      <Header />
      <main className="w-full">
        <section className="pt-32 pb-16 md:pt-40 md:pb-24 px-4 md:px-6 max-w-7xl mx-auto flex flex-col items-center text-center relative isolate">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-gradient-to-tr from-[oklch(0.62_0.15_45)]/30 via-[oklch(0.88_0.12_80)]/30 to-[oklch(0.77_0.08_220)]/30 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-pink-900/30 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-cream-50 dark:bg-brand-cream-900 border border-brand-cream-100 dark:border-brand-cream-800 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-orange">New</span>
            <span className="w-px h-3 bg-brand-cream-200 dark:bg-gray-700"></span>
            <span className="text-xs font-medium text-brand-cream-600 dark:text-brand-cream-300">The Community Platform for Students</span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-brand-cream-950 dark:text-brand-cream-50 mb-6 max-w-5xl mx-auto leading-[1.05]">
            Where Student Communities <span className="bg-gradient-to-r from-brand-orange to-brand-yellow bg-clip-text text-transparent">Connect &amp; Grow</span>
          </h1>
          <p className="text-xl text-brand-cream-600 dark:text-brand-cream-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Unlock exclusive events, discover career opportunities, and join vibrant clubs. <strong className="text-brand-cream-900 dark:text-brand-cream-50 font-medium">Built by students, for students</strong>.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link to="/sign-in" className="w-full sm:w-auto px-8 py-4 rounded-full bg-brand-cream-950 text-brand-cream-50 dark:bg-brand-cream-50 dark:text-brand-cream-950 font-semibold text-lg hover:scale-105 transition-all shadow-lg hover:shadow-xl hover:shadow-blue-500/10 flex items-center justify-center">
              Join for free
            </Link>
            <Link to="/community" className="w-full sm:w-auto px-8 py-4 rounded-full bg-brand-cream-50 dark:bg-brand-cream-950 border border-brand-cream-200 dark:border-brand-cream-800 text-brand-cream-900 dark:text-brand-cream-50 font-medium text-lg hover:border-blue-500/50 dark:hover:border-blue-500/50 hover:bg-brand-cream-50 dark:hover:bg-brand-cream-900 transition-all group flex items-center justify-center">
              Explore communities <span className="inline-block transition-transform group-hover:translate-x-1 ml-1">→</span>
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm text-brand-cream-500 font-medium">
            <CheckCircle className="text-green-500 w-5 h-5" />
            <span>Always free for students</span>
          </div>
        </section>
        <section className="px-4 pb-24 max-w-[1400px] mx-auto">
          <div className="relative bg-brand-cream-50 dark:bg-brand-cream-900/50 rounded-[2.5rem] p-6 md:p-12 overflow-hidden border border-brand-cream-200 dark:border-brand-cream-800 shadow-2xl shadow-brand-cream-100/50 dark:shadow-none">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[500px] h-[500px] bg-[oklch(0.77_0.08_220)]/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[500px] h-[500px] bg-[oklch(0.62_0.15_45)]/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
              <div className="space-y-4 group">
                <div className="flex items-center gap-3 mb-2 px-1">
                  <h3 className="font-bold text-lg text-brand-cream-900 dark:text-brand-cream-50">Discover Events</h3>
                </div>
                <Link to="/events" className="block space-y-3 cursor-pointer bg-brand-cream-50 dark:bg-brand-cream-950 p-4 rounded-3xl shadow-sm border border-brand-cream-100 dark:border-brand-cream-800 group-hover:border-[oklch(0.62_0.15_45)]/30 dark:group-hover:border-[oklch(0.62_0.15_45)]/30 group-hover:shadow-lg transition-all duration-300">
                  <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-brand-cream-100">
                    <div className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url("${featuredEvent.heroImageUrl}")` }}></div>
                    <div className="absolute top-3 left-3 bg-brand-cream-50/90 dark:bg-brand-cream-950/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold shadow-sm text-[oklch(0.77_0.08_220)] uppercase tracking-wider">
                      {featuredEvent.price === 0 ? "Free" : `$${featuredEvent.price}`}
                    </div>
                  </div>
                  <div className="space-y-1 px-1">
                    <p className="text-xs font-bold text-[oklch(0.62_0.15_45)] uppercase tracking-wide">
                      {formatEventDateTime(featuredEvent.datetime)}
                    </p>
                    <h3 className="text-lg font-bold text-brand-cream-950 dark:text-brand-cream-50 leading-tight">
                      {featuredEvent.title}
                    </h3>
                    {featuredEvent.location && (
                      <p className="text-sm text-brand-cream-500 line-clamp-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {featuredEvent.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 px-1">
                    <div className="flex items-center -space-x-2">
                      <img alt="attendee" className="size-7 rounded-full border-2 border-brand-cream-50 dark:border-brand-cream-950" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVeg0mCZyOyxZ27Vsz6dimTV-VWKazJuch4TujH5iBHHd_y5xDPbp3QKTLM01oTEluBODkwcoRykpHqEqJwAz5bz8w4KVOOeyw0flGpqYwiS1t15CnwdVoEtg-TvULDjGD5JQttNB-trZmXROG0G4H2iupERxH63202IOE2bJ3rreXsUfEO4v_UDGL5MJi3DzHaks8tWDtm8CePXtgvNv5AteGMrTmZpBgwIi5oCL6j-KXXdUcWRgQaxxed0EaUCE32byNy9nxB_je" />
                      <img alt="attendee" className="size-7 rounded-full border-2 border-brand-cream-50 dark:border-brand-cream-950" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBEUNIUuj7BhQ8_-MwJtMtICghKsonXRAYhQe4yNwUjlXfOshEwJJb4x3Loz93Jpdvw5Wg0koYZLnnjBgoeJ73mwxN524ArdylNSjdbF1y886rOL9V2cWH-YOk_UP-NuA8yI8NxpxVsRHWe1CdpJZKZqdAixIMCLaYRBFtyIJGjjkcLERza2sX9tpLre_-r-F6Hc0BrO4BCMqycvl4oeis6hBaDgEYBVvRWwxZrhKuojTLvGYYeHN_FrKo5LOSCWkwiJBhlGmJkbIFf" />
                      {(featuredEvent.attendees ?? 0) > 2 && (
                        <div className="size-7 rounded-full border-2 border-brand-cream-50 dark:border-brand-cream-950 bg-brand-cream-100 dark:bg-brand-cream-800 flex items-center justify-center text-[10px] text-brand-cream-600 dark:text-brand-cream-300 font-bold">
                          +{(featuredEvent.attendees ?? 0) - 2}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-brand-cream-900 dark:text-brand-cream-50 bg-brand-cream-50 dark:bg-brand-cream-900 px-3 py-1.5 rounded-lg hover:bg-brand-cream-100 dark:hover:bg-brand-cream-800 transition-colors">
                      View Events
                    </span>
                  </div>
                </Link>
              </div>
              <div className="space-y-4 group">
                <div className="flex items-center gap-3 mb-2 px-1">
                  <h3 className="font-bold text-lg text-brand-cream-900 dark:text-brand-cream-50">Find Opportunities</h3>
                </div>
                <Link to="/jobs" className="block bg-brand-cream-50 dark:bg-brand-cream-950 p-5 rounded-3xl shadow-sm border border-brand-cream-100 dark:border-brand-cream-800 group-hover:border-[oklch(0.77_0.08_220)]/30 dark:group-hover:border-[oklch(0.77_0.08_220)]/30 group-hover:shadow-lg transition-all duration-300">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="size-14 rounded-xl bg-brand-cream-50 border border-brand-cream-100 dark:border-brand-cream-800 bg-center bg-cover shadow-sm" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBWBYpefzD8NOWhQ_NcngMCplUELaIUd9oMWeVb5kOuXAZiYKP622HmRyJjgs4A33RQN_ptNeFfpUD0PFOwvgQYznWwfjBR29MtTGdzApW6mC2sMRWwkjuXg_8-mxh4Jm27Yoy118m6g6e4IwJdt-tYHqllQAkgk9WTJLfCAVzAmRDUZ7_xU4tPdvlfMrSTbB0zMbhEZyP19TjT0tFkN_FS3-Gv1C4wuEAsYGzFg2Lebx2haWtFRpKgkywNsHfLPPZ8OmV9E95gglg8")' }}></div>
                    <span className="px-2.5 py-1 rounded-full bg-[oklch(0.77_0.08_220)]/10 dark:bg-[oklch(0.77_0.08_220)]/20 text-[oklch(0.77_0.08_220)] dark:text-[oklch(0.77_0.08_220)] text-xs font-bold border border-[oklch(0.77_0.08_220)]/20 dark:border-[oklch(0.77_0.08_220)]/30 uppercase tracking-wide">New</span>
                  </div>
                  <div className="space-y-1 mb-5">
                    <h3 className="font-bold text-lg text-brand-cream-950 dark:text-brand-cream-50 leading-tight">Product Design Intern</h3>
                    <p className="text-brand-cream-500 text-sm font-medium">Stripe • Remote</p>
                  </div>
                  <div className="flex gap-2 mb-5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-md bg-brand-cream-50 dark:bg-brand-cream-900 text-brand-cream-600 dark:text-brand-cream-400 text-xs font-semibold border border-brand-cream-100 dark:border-brand-cream-800">Internship</span>
                    <span className="px-2.5 py-1 rounded-md bg-brand-cream-50 dark:bg-brand-cream-900 text-brand-cream-600 dark:text-brand-cream-400 text-xs font-semibold border border-brand-cream-100 dark:border-brand-cream-800">Design</span>
                    <span className="px-2.5 py-1 rounded-md bg-brand-cream-50 dark:bg-brand-cream-900 text-brand-cream-600 dark:text-brand-cream-400 text-xs font-semibold border border-brand-cream-100 dark:border-brand-cream-800">5/hr</span>
                  </div>
                  <span className="block w-full py-2.5 text-sm font-bold bg-brand-blue hover:bg-brand-blue/90 text-brand-cream-50 rounded-xl transition-colors shadow-sm shadow-[oklch(0.77_0.08_220)]/30 dark:shadow-none text-center">View Details</span>
                </Link>
              </div>
              <div className="space-y-4 group">
                <div className="flex items-center gap-3 mb-2 px-1">
                  <h3 className="font-bold text-lg text-brand-cream-900 dark:text-brand-cream-50">Discover Communities</h3>
                </div>
                <Link to="/community" className="block space-y-3 cursor-pointer bg-brand-cream-50 dark:bg-brand-cream-950 p-4 rounded-3xl shadow-sm border border-brand-cream-100 dark:border-brand-cream-800 group-hover:border-purple-200 dark:group-hover:border-purple-900/50 group-hover:shadow-lg transition-all duration-300">
                  <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                    {featuredCommunity.bannerUrl ? (
                      <div className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url("${featuredCommunity.bannerUrl}")` }}></div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-16 h-16 text-purple-200 dark:text-purple-700" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 bg-brand-cream-50/90 dark:bg-brand-cream-950/80 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                      <span className="text-purple-600 dark:text-purple-400">
                        {featuredCommunity.memberCount >= 1000 
                          ? `${(featuredCommunity.memberCount / 1000).toFixed(1).replace(/\.0$/, '')}k` 
                          : featuredCommunity.memberCount}
                      </span>
                    </div>
                    {featuredCommunity.logoUrl && (
                      <div className="absolute -bottom-6 left-3 size-12 rounded-xl shadow-lg border-2 border-brand-cream-50 dark:border-brand-cream-950 bg-brand-cream-50 dark:bg-brand-cream-950 overflow-hidden">
                        <img src={featuredCommunity.logoUrl} alt={featuredCommunity.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 px-1 pt-2">
                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                      {featuredCommunity.category}
                    </p>
                    <h3 className="text-lg font-bold text-brand-cream-950 dark:text-brand-cream-50 leading-tight">
                      {featuredCommunity.name}
                    </h3>
                    <p className="text-sm text-brand-cream-500 line-clamp-2">
                      {featuredCommunity.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 px-1">
                    <div className="flex items-center -space-x-2">
                      <img alt="member" className="size-7 rounded-full border-2 border-brand-cream-50 dark:border-brand-cream-950" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGrL8ZaLleb-9sFwTFBI6_2X7uuf7pgUtpRF8cdYEqv2k3W-Nygr-SWnJSs_8fO4Nn000p2UD8ISrspF7wKecTmx_YAUIotQEYcMTRp8zXCAZocbe-Ep44gTEnE_3NeNNbSql0xXOmRdo2DLKkDfBCRpJGrObacMNgxc0ktj1BkChV9LSBmD2p-nSMCRCXJtsabA964b1455ye0LFhl67Kd0a7-pPGJtHR2Yo-LUDncr8AJ1MD5VO7E96Lau_tkll1dNjbndb0Ap07" />
                      <img alt="member" className="size-7 rounded-full border-2 border-brand-cream-50 dark:border-brand-cream-950" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVeg0mCZyOyxZ27Vsz6dimTV-VWKazJuch4TujH5iBHHd_y5xDPbp3QKTLM01oTEluBODkwcoRykpHqEqJwAz5bz8w4KVOOeyw0flGpqYwiS1t15CnwdVoEtg-TvULDjGD5JQttNB-trZmXROG0G4H2iupERxH63202IOE2bJ3rreXsUfEO4v_UDGL5MJi3DzHaks8tWDtm8CePXtgvNv5AteGMrTmZpBgwIi5oCL6j-KXXdUcWRgQaxxed0EaUCE32byNy9nxB_je" />
                      <img alt="member" className="size-7 rounded-full border-2 border-brand-cream-50 dark:border-brand-cream-950" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBEUNIUuj7BhQ8_-MwJtMtICghKsonXRAYhQe4yNwUjlXfOshEwJJb4x3Loz93Jpdvw5Wg0koYZLnnjBgoeJ73mwxN524ArdylNSjdbF1y886rOL9V2cWH-YOk_UP-NuA8yI8NxpxVsRHWe1CdpJZKZqdAixIMCLaYRBFtyIJGjjkcLERza2sX9tpLre_-r-F6Hc0BrO4BCMqycvl4oeis6hBaDgEYBVvRWwxZrhKuojTLvGYYeHN_FrKo5LOSCWkwiJBhlGmJkbIFf" />
                    </div>
                    <span className="text-sm font-semibold text-brand-cream-900 dark:text-brand-cream-50 bg-brand-cream-50 dark:bg-brand-cream-900 px-3 py-1.5 rounded-lg hover:bg-brand-cream-100 dark:hover:bg-brand-cream-800 transition-colors">
                      View Communities
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="py-12 px-6">
          <div className="max-w-5xl mx-auto bg-brand-cream-950 dark:bg-brand-cream-50 rounded-[2.5rem] p-12 md:p-24 text-center relative overflow-hidden group">
            <div className="relative z-10 space-y-8">
              <span className="inline-block py-1 px-3 rounded-full bg-brand-cream-50/10 dark:bg-brand-cream-950/5 text-brand-cream-50 dark:text-brand-cream-950 text-sm font-semibold mb-2 backdrop-blur-sm border border-brand-cream-50/10 dark:border-brand-cream-950/10">100% Free Forever</span>
              <h2 className="text-4xl md:text-6xl font-bold text-brand-cream-50 dark:text-brand-cream-950 tracking-tight max-w-3xl mx-auto leading-tight">Ready to join your community?</h2>
              <p className="text-lg text-brand-cream-300 dark:text-brand-cream-600 max-w-xl mx-auto">Start connecting with students, attending events, and building your future today.</p>
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
