import { Header } from "@/components/landing/header";
import { Outlet } from "react-router-dom";

export default function PublicLayout() {
    return (
        <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}
