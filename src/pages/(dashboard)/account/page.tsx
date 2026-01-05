import AccountPage from "@/pages/(dashboard)/account/account-new";
import { useState, useEffect } from "react";

export default function Page() {
    const [_, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 30);
        };
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return (
        <>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
                    <AccountPage />
                </div>
            </div>
        </>
    );
}
