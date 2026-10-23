import { useState } from "react";
import { Search, UserPlus, UserCheck, UserX, MessageCircle } from "lucide-react";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";

type FriendStatus = "friend" | "pending" | "suggested";

interface MockPerson {
    id: string;
    name: string;
    role: string;
    status: FriendStatus;
}

const INITIAL_PEOPLE: MockPerson[] = [
    { id: "1", name: "Priya S.", role: "Computer Science · McGill", status: "friend" },
    { id: "2", name: "Marco D.", role: "Software Eng. · Concordia", status: "friend" },
    { id: "3", name: "Aisha K.", role: "Recruiter · ABB", status: "pending" },
    { id: "4", name: "Liam T.", role: "Data Science · UdeM", status: "suggested" },
    { id: "5", name: "Sofia R.", role: "Recruiter · Altevo", status: "suggested" },
];

function Avatar({ name }: { name: string }) {
    return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-joy-grass/10 text-sm font-bold text-joy-grass">
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

function StatusAction({
    status,
    onToggle,
}: {
    status: FriendStatus;
    onToggle: () => void;
}) {
    if (status === "friend") {
        return (
            <button
                type="button"
                onClick={onToggle}
                className="inline-flex items-center gap-1.5 rounded-lg border border-joy-ink/12 px-3 py-1.5 text-xs font-bold text-joy-ink-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
            >
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Friends
            </button>
        );
    }
    if (status === "pending") {
        return (
            <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 rounded-lg border border-joy-ink/12 px-3 py-1.5 text-xs font-bold text-joy-ink-muted opacity-60"
            >
                <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                Pending
            </button>
        );
    }
    return (
        <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 rounded-lg bg-joy-grass px-3 py-1.5 text-xs font-bold text-white transition hover:bg-joy-grass-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
        >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Add
        </button>
    );
}

export default function FriendsConceptPage() {
    const [people, setPeople] = useState<MockPerson[]>(INITIAL_PEOPLE);
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState<"all" | "friend" | "pending" | "suggested">("all");

    const toggleStatus = (id: string) => {
        setPeople((prev) =>
            prev.map((p) => {
                if (p.id !== id) return p;
                if (p.status === "suggested") return { ...p, status: "pending" };
                if (p.status === "friend") return { ...p, status: "suggested" };
                return p;
            }),
        );
    };

    const filtered = people.filter((p) => {
        const matchesTab = tab === "all" || p.status === tab;
        const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
        return matchesTab && matchesQuery;
    });

    const friendCount = people.filter((p) => p.status === "friend").length;
    const pendingCount = people.filter((p) => p.status === "pending").length;

    const tabs: { key: typeof tab; label: string; count?: number }[] = [
        { key: "all", label: "All" },
        { key: "friend", label: "Friends", count: friendCount },
        { key: "pending", label: "Pending", count: pendingCount },
        { key: "suggested", label: "Suggested" },
    ];

    return (
        <PlaygroundShell routes={LIVE_ROUTES} showSwitcher={false} activeNav="friends">
            <section className="px-5 pb-16 pt-8">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-joy-sky/30 bg-joy-sky/8 px-3.5 py-1.5 text-xs font-bold text-joy-sky-ink">
                        <span className="h-1.5 w-1.5 rounded-full bg-joy-sky" aria-hidden="true" />
                        Concept preview — not connected to real data
                    </div>

                    <h1 className="joy-display mt-3 text-3xl font-extrabold text-joy-ink sm:text-4xl">
                        Friends
                    </h1>
                    <p className="mt-2 text-sm text-joy-ink-muted">
                        Connect with other students and employers you've met through events and communities.
                    </p>

                    <div className="relative mt-6">
                        <Search
                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-joy-ink-muted"
                            aria-hidden="true"
                        />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search people..."
                            className="w-full rounded-xl border border-joy-ink/12 bg-white py-2.5 pl-10 pr-4 text-sm text-joy-ink placeholder:text-joy-ink-muted focus:outline-none focus:ring-2 focus:ring-joy-grass/60"
                        />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                aria-current={tab === t.key ? "page" : undefined}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
                                    tab === t.key
                                        ? "bg-joy-grass text-white"
                                        : "border border-joy-ink/12 text-joy-ink-muted hover:bg-joy-ink/5"
                                }`}
                            >
                                {t.label}
                                {typeof t.count === "number" && (
                                    <span className="ml-1 opacity-80">({t.count})</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="mt-6 space-y-3">
                        {filtered.length === 0 && (
                            <p className="rounded-2xl border border-joy-ink/8 bg-white p-6 text-center text-sm text-joy-ink-muted">
                                No one matches this search.
                            </p>
                        )}
                        {filtered.map((p) => (
                            <div
                                key={p.id}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-joy-ink/8 bg-white p-4 shadow-sm"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <Avatar name={p.name} />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-joy-ink">{p.name}</p>
                                        <p className="truncate text-xs text-joy-ink-muted">{p.role}</p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {p.status === "friend" && (
                                        <button
                                            type="button"
                                            aria-label={`Message ${p.name}`}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-joy-ink-muted transition hover:bg-joy-ink/5 hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                        >
                                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    )}
                                    <StatusAction status={p.status} onToggle={() => toggleStatus(p.id)} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </PlaygroundShell>
    );
}