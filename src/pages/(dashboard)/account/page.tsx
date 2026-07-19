import AccountPage from "@/pages/(dashboard)/account/account-new";

// Slice 2: the account page now renders its own full-width PlaygroundShell
// (header/footer + joy chrome), so this wrapper simply mounts it. The old
// padded dashboard-frame divs were removed to avoid constraining the shell.
export default function Page() {
    return <AccountPage />;
}
