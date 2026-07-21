import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const LINKS = [
    { to: "/admin/moderation", label: "Review queue" },
    { to: "/admin/content", label: "All content" },
    { to: "/admin/audit-log", label: "Audit log" },
];

/**
 * AdminNav — understated shared nav rendered at the top of every platform-admin
 * page. Deliberately plain: these are internal tools, not a product surface.
 */
export function AdminNav() {
    return (
        <nav className="mb-6 flex flex-wrap items-center gap-1 border-b border-slate-200 pb-3">
            {LINKS.map((link) => (
                <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                        cn(
                            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            isActive
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )
                    }
                >
                    {link.label}
                </NavLink>
            ))}
        </nav>
    );
}
