import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, UserCog, Mail, Trash2, UserPlus, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";

type Admin = {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    initials: string;
};

type Member = {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    initials: string;
};

interface CommunityAdminsTabProps {
    communityId: string;
}

export default function CommunityAdminsTab({ communityId }: CommunityAdminsTabProps) {
    const { user } = useAuth();
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [addingAdmin, setAddingAdmin] = useState<string | null>(null);
    const [removingAdmin, setRemovingAdmin] = useState<string | null>(null);

    const fetchAdmins = async () => {
        try {
            const response = await apiFetch(`/communities/${communityId}/admins`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to fetch admins");
            }

            setAdmins(result.admins || []);
        } catch (error) {
            console.error("Error fetching admins:", error);
            toast.error("Failed to load admins");
        }
    };

    const fetchMembers = async () => {
        try {
            const response = await apiFetch(`/communities/${communityId}/members`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to fetch members");
            }

            setMembers(result.members || []);
        } catch (error) {
            console.error("Error fetching members:", error);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                
                if (!communityId || !user) {
                    return;
                }

                await Promise.all([fetchAdmins(), fetchMembers()]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [communityId, user]);

    const handleAddAdmin = async (userId: string) => {
        try {
            setAddingAdmin(userId);

            const response = await apiFetch(`/communities/${communityId}/admins`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to add admin");
            }

            toast.success("Admin added successfully");
            await fetchAdmins();
            setAddDialogOpen(false);
            setSearchQuery("");
        } catch (error) {
            console.error("Error adding admin:", error);
            toast.error(error instanceof Error ? error.message : "Failed to add admin");
        } finally {
            setAddingAdmin(null);
        }
    };

    const handleRemoveAdmin = async (userId: string) => {
        // Prevent removing last admin
        if (admins.length <= 1) {
            toast.error("Cannot remove the last admin");
            return;
        }

        try {
            setRemovingAdmin(userId);

            const response = await apiFetch(`/communities/${communityId}/admins/${userId}`, {
                method: "DELETE",
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to remove admin");
            }

            toast.success("Admin removed successfully");
            await fetchAdmins();
        } catch (error) {
            console.error("Error removing admin:", error);
            toast.error(error instanceof Error ? error.message : "Failed to remove admin");
        } finally {
            setRemovingAdmin(null);
        }
    };

    // Filter members who are not already admins and match search query
    const availableMembers = members.filter((member) => {
        const isNotAdmin = !admins.some((admin) => admin.userId === member.userId);
        const matchesSearch = searchQuery === "" ||
            member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
        return isNotAdmin && matchesSearch;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Add Admin Button */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Community Admins</h2>
                    <p className="text-sm text-slate-600 mt-1">
                        Manage who can administer this community
                    </p>
                </div>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Admin
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Add Community Admin</DialogTitle>
                            <DialogDescription>
                                Select a member to grant admin privileges. Admins can manage community settings, events, and members.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            {/* Search Input */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search members by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {/* Available Members List */}
                            <div className="max-h-96 overflow-y-auto border rounded-lg">
                                {availableMembers.length === 0 ? (
                                    <div className="text-center py-12">
                                        <UserCog className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                                        <p className="text-slate-600">
                                            {searchQuery ? "No members found matching your search" : "All members are already admins"}
                                        </p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Member</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead className="w-32">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {availableMembers.map((member) => (
                                                <TableRow key={member.userId}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarFallback className="text-xs bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                                                                    {member.initials || member.firstName?.[0] || "U"}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-medium text-slate-900">
                                                                    {member.firstName} {member.lastName}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-sm text-slate-600 font-mono">
                                                            {member.email}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleAddAdmin(member.userId)}
                                                            disabled={addingAdmin === member.userId}
                                                        >
                                                            {addingAdmin === member.userId ? (
                                                                <>
                                                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                                    Adding...
                                                                </>
                                                            ) : (
                                                                "Make Admin"
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Admins List */}
            <Card>
                <CardHeader>
                    <CardTitle>Current Admins ({admins.length})</CardTitle>
                    <CardDescription>
                        {admins.length === 1 
                            ? "At least one admin must remain" 
                            : "Users with administrative privileges"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {admins.length === 0 ? (
                        <div className="text-center py-12">
                            <UserCog className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                            <p className="text-slate-600">No admins found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Admin</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead className="w-32">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {admins.map((admin) => (
                                        <TableRow key={admin.userId}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="text-xs bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                                                            {admin.initials || admin.firstName?.[0] || "U"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium text-slate-900">
                                                            {admin.firstName} {admin.lastName}
                                                        </p>
                                                        {admin.userId === user?.uid && (
                                                            <Badge variant="outline" className="text-xs mt-1">
                                                                You
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-3 w-3 text-slate-400" />
                                                    <span className="text-sm text-slate-600 font-mono">
                                                        {admin.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRemoveAdmin(admin.userId)}
                                                    disabled={admins.length <= 1 || removingAdmin === admin.userId}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    {removingAdmin === admin.userId ? (
                                                        <>
                                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                            Removing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Trash2 className="h-3 w-3 mr-1" />
                                                            Remove
                                                        </>
                                                    )}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
