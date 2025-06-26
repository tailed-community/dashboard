import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import {
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ChevronDown,
  Filter,
  MoreHorizontal,
  Github,
  Award,
  User,
  Mail,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  Eye,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

interface Candidate {
  id: string;
  name: string;
  email: string;
  status: string;
  score: number;
  appliedAt: string;
  initials: string;
  githubContributions?: number;
  githubUsername?: string;
  hackathonCount?: number;
  devpostUsername?: string;
  winCount?: number;
}

export default function CandidatesPage() {
  const { id: jobId } = useParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'score',
    direction: 'desc'
  });

  useEffect(() => {
    async function fetchCandidates() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiFetch(`/jobs/${jobId}/candidates`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch candidates");
        }

        const data = await response.json();
        setCandidates(data);
      } catch (err) {
        console.error("Error fetching candidates:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching candidates"
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (jobId) {
      fetchCandidates();
    }
  }, [jobId]);

  const sortedCandidates = [...candidates].sort((a, b) => {
    const key = sortConfig.key as keyof Candidate;

    if (a[key] < b[key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[key] > b[key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const filteredCandidates = sortedCandidates.filter((candidate) => {
    const matchesSearch =
      searchQuery === "" ||
      candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === null || candidate.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch (e) {
      return "N/A";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "opened":
        return "bg-blue-100 text-blue-800";
      case "sent":
      case "imported":
        return "bg-yellow-100 text-yellow-800";
      case "interviewing":
      case "interviewed":
        return "bg-purple-100 text-purple-800";
      case "hired":
      case "accepted":
        return "bg-emerald-100 text-emerald-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Candidates</h1>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <CardTitle>All Candidates</CardTitle>
                  <CardDescription>
                    Manage and review job applicants
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search candidates..."
                      className="pl-8 w-full md:w-[250px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setStatusFilter(null)}
                        className={statusFilter === null ? "bg-accent" : ""}
                      >
                        All Statuses
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setStatusFilter("Sent")}
                        className={statusFilter === "Sent" ? "bg-accent" : ""}
                      >
                        Sent
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setStatusFilter("Opened")}
                        className={
                          statusFilter === "Opened" ? "bg-accent" : ""
                        }
                      >
                        Opened
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setStatusFilter("Completed")}
                        className={
                          statusFilter === "Completed" ? "bg-accent" : ""
                        }
                      >
                        Completed
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex h-[200px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading candidates...</span>
                </div>
              ) : error ? (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                  <h3 className="mt-4 text-lg font-medium">
                    No candidates found
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    {searchQuery || statusFilter
                      ? "Try adjusting your filters or search query"
                      : "You haven't received any applications yet"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <div className="flex items-center cursor-pointer" onClick={() => requestSort('name')}>
                            Candidate
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center cursor-pointer" onClick={() => requestSort('status')}>
                            Status
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center cursor-pointer" onClick={() => requestSort('score')}>
                            Score
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center cursor-pointer" onClick={() => requestSort('appliedAt')}>
                            Applied
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead>GitHub</TableHead>
                        <TableHead>Hackathons</TableHead>
                        <TableHead>Wins</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCandidates.map((candidate) => (
                        <TableRow key={candidate.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                {candidate.githubUsername ? (
                                  <AvatarImage
                                    src={`https://github.com/${candidate.githubUsername}.png`}
                                  />
                                ) : null}
                                <AvatarFallback>
                                  {candidate.initials || candidate.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {candidate.name}
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {candidate.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getStatusColor(candidate.status || "sent")}
                            >
                              {candidate.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-primary/10 text-primary border-primary/20 flex items-center w-fit">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {candidate.score}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDate(candidate.appliedAt)}
                          </TableCell>
                          <TableCell>
                            {candidate.githubContributions ? (
                              <div className="flex items-center gap-1">
                                <Github className="h-4 w-4" />
                                <span>{candidate.githubContributions}</span>
                              </div>
                            ) : candidate.githubUsername ? (
                              <div className="flex items-center gap-1">
                                <Github className="h-4 w-4" />
                                <span>Profile</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {candidate.hackathonCount ? (
                              <div className="flex items-center gap-1">
                                <Award className="h-4 w-4" />
                                <span>{candidate.hackathonCount}</span>
                              </div>
                            ) : candidate.devpostUsername ? (
                              <div className="flex items-center gap-1">
                                <Award className="h-4 w-4" />
                                <span>Profile</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {candidate.winCount ? (
                              <div className="flex items-center gap-1">
                                <Trophy className="h-4 w-4" />
                                <span>{candidate.winCount}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/jobs/${jobId}/candidates/${candidate.id}`}>
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">View</span>
                                </Link>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">More</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Link
                                      to={`/jobs/${jobId}/candidates/${candidate.id}`}
                                      className="flex w-full"
                                    >
                                      View Application
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>Send Email</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem>Archive</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
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
      </div>
    </>
  );
}
