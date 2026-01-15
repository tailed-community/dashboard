import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Users, Mail, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";

type Member = {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    school: string;
    program: string;
    graduationYear: number;
    initials: string;
    createdAt: Date;
};

interface CommunityMembersTabProps {
    communityId: string;
}

export default function CommunityMembersTab({ communityId }: CommunityMembersTabProps) {
    const { user } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                setLoading(true);
                
                if (!communityId || !user) {
                    setMembers([]);
                    return;
                }

                // Fetch members via API (returns only public fields)
                const response = await apiFetch(`/communities/${communityId}/members`);
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Failed to fetch members");
                }

                const membersData = result.members.map((m: any) => ({
                    ...m,
                    createdAt: m.createdAt ? new Date(m.createdAt._seconds * 1000) : new Date(),
                }));

                // Sort by join date (newest first)
                membersData.sort((a: Member, b: Member) => b.createdAt.getTime() - a.createdAt.getTime());
                setMembers(membersData);

            } catch (error) {
                console.error("Error fetching members:", error);
                toast.error("Failed to load community members");
            } finally {
                setLoading(false);
            }
        };

        fetchMembers();
    }, [communityId, user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
        );
    }

    if (members.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Community Members</CardTitle>
                    <CardDescription>
                        View and manage your community members
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12">
                        <Users className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                        <p className="text-slate-600">
                            No members yet in this community.
                        </p>
                        <p className="text-sm text-slate-500 mt-2">
                            Members will appear here when they join or are imported via events.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Total Members
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">
                            {members.length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            With School Info
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">
                            {members.filter(m => m.school).length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Recent Joins (7 days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">
                            {members.filter(m => {
                                const daysSinceJoin = (Date.now() - m.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                                return daysSinceJoin <= 7;
                            }).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Members Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Members</CardTitle>
                    <CardDescription>
                        Complete list of community members
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>School</TableHead>
                                    <TableHead>Program</TableHead>
                                    <TableHead>Graduation Year</TableHead>
                                    <TableHead>Joined</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
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
                                                    {!member.firstName && !member.lastName && (
                                                        <Badge variant="outline" className="text-xs">
                                                            Imported
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-3 w-3 text-slate-400" />
                                                <span className="text-sm text-slate-600 font-mono">
                                                    {member.email}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-slate-600">
                                                {member.school || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-slate-600">
                                                {member.program || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-slate-600">
                                                {member.graduationYear || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3 w-3 text-slate-400" />
                                                <span className="text-sm text-slate-600">
                                                    {member.createdAt.toLocaleDateString("en-US", {
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
