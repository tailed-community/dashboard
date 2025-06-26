import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
  Scatter,
} from "recharts";
import {
  Github,
  Award,
  Trophy,
  Code,
  User,
  ExternalLink,
  BarChart2,
  School,
  Calendar,
  Clock,
  BriefcaseIcon,
  GraduationCap,
  TrendingUp,
  Hash,
  Cpu,
} from "lucide-react";

interface ApplicantStats {
  totalApplicants: number;
  statusDistribution: {
    [key: string]: number;
  };
  githubStats: {
    averageContributions: number;
    maxContributions: number;
    topLanguages: Array<{ language: string; count: number }>;
    contributionDistribution: {
      [key: string]: number;
    };
  };
  devpostStats: {
    averageHackathons: number;
    averageWins: number;
    participationRate: number;
    topTechnologies: Array<{ technology: string; count: number }>;
  };
  educationStats: {
    universities: Array<{ name: string; count: number }>;
    majors: Array<{ name: string; count: number }>;
    graduationYears: Array<{ year: string; count: number }>;
  };
  applicationTimeline: Array<{ date: string; count: number }>;
  topPerformers: Array<{
    id: string;
    name: string;
    email: string;
    score: number;
    githubContributions?: number;
    hackathonCount?: number;
    winCount?: number;
  }>;
}

interface ApplicantStatsProps {
  jobId: string;
  stats: ApplicantStats;
}

// Colors for charts
const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#A259FF",
  "#FF6B6B",
  "#4CAF50",
  "#9C27B0",
];

export function ApplicantStats({ jobId, stats }: ApplicantStatsProps) {
  // Prepare data for status distribution pie chart
  const statusData = Object.entries(stats.statusDistribution).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  // Prepare data for contribution distribution chart
  const contributionDistData = Object.entries(
    stats.githubStats.contributionDistribution || {}
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => {
      // Custom sorting for contribution buckets
      const getBucketValue = (bucket: string) => {
        if (bucket === "0") return 0;
        if (bucket === "1000+") return 1001;
        return parseInt(bucket.split("-")[0]);
      };
      return getBucketValue(a.name) - getBucketValue(b.name);
    });

  // Format timeline data
  const timelineData = stats.applicationTimeline.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    count: item.count,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Applicant Analytics</h2>

      {/* Stats Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Applicants
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalApplicants}</div>
            <p className="text-xs text-muted-foreground">
              Candidates applied for this position
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. GitHub Contributions
            </CardTitle>
            <Github className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.githubStats.averageContributions.toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Max: {stats.githubStats.maxContributions}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Hackathons
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.devpostStats.averageHackathons.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Win rate:{" "}
              {(
                (stats.devpostStats.averageWins /
                  stats.devpostStats.averageHackathons) *
                  100 || 0
              ).toFixed(0)}
              %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Devpost Participation
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.devpostStats.participationRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Of applicants have Devpost profiles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart2 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="github">
            <Github className="h-4 w-4 mr-2" />
            GitHub
          </TabsTrigger>
          <TabsTrigger value="hackathons">
            <Award className="h-4 w-4 mr-2" />
            Hackathons
          </TabsTrigger>
          <TabsTrigger value="education">
            <School className="h-4 w-4 mr-2" />
            Education
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Application Status</CardTitle>
                <CardDescription>
                  Distribution of candidates by application status
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name) => [
                        `${value} candidates (${((value / stats.totalApplicants) * 100).toFixed(1)}%)`,
                        name,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Top Programming Languages</CardTitle>
                <CardDescription>
                  Most popular languages among applicants
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.githubStats.topLanguages.slice(0, 7)}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 40,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="language"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#8884d8">
                      {stats.githubStats.topLanguages
                        .slice(0, 7)
                        .map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Application Timeline</CardTitle>
              <CardDescription>
                Number of applications received per day
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 20,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#0088FE"
                    fill="#0088FE"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GitHub Tab */}
        <TabsContent value="github" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>GitHub Contribution Distribution</CardTitle>
                <CardDescription>
                  Range of GitHub contributions across applicants
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={contributionDistData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip
                      formatter={(value) => [`${value} applicants`]}
                    />
                    <Bar dataKey="value" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Languages</CardTitle>
                <CardDescription>
                  Most common programming languages
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.githubStats.topLanguages.slice(0, 7)}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ language, percent }) =>
                        `${language}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      nameKey="language"
                      dataKey="count"
                    >
                      {stats.githubStats.topLanguages
                        .slice(0, 7)
                        .map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hackathons Tab */}
        <TabsContent value="hackathons" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Technologies in Hackathons</CardTitle>
                <CardDescription>
                  Most popular technologies used in hackathon projects
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.devpostStats.topTechnologies.slice(0, 10)}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 40,
                    }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="technology" type="category" width={100} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#00C49F">
                      {stats.devpostStats.topTechnologies
                        .slice(0, 10)
                        .map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Devpost Metrics</CardTitle>
                <CardDescription>
                  Summary of hackathon participation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        Average Hackathons
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Per applicant with Devpost profiles
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold">
                        {stats.devpostStats.averageHackathons.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        Average Wins
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Hackathon awards per applicant
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold">
                        {stats.devpostStats.averageWins.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        Win Rate
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Average wins per hackathon
                      </p>
                    </div>
                    <span className="font-bold">
                      {(
                        (stats.devpostStats.averageWins /
                          stats.devpostStats.averageHackathons) *
                          100 || 0
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        Devpost Profile Rate
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Applicants with Devpost profiles
                      </p>
                    </div>
                    <span className="font-bold">
                      {stats.devpostStats.participationRate}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Education Tab */}
        <TabsContent value="education" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Universities</CardTitle>
                <CardDescription>
                  Most common educational institutions
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.educationStats.universities.slice(0, 8)}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 50,
                    }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={150}
                      tick={{ fontSize: 12 }}
                    />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#A259FF" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Majors</CardTitle>
                <CardDescription>Most common fields of study</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.educationStats.majors.slice(0, 8)}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 50,
                    }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={150}
                      tick={{ fontSize: 12 }}
                    />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#FFBB28" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Graduation Years</CardTitle>
              <CardDescription>
                Distribution of applicants by graduation year
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.educationStats.graduationYears}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Application Timeline</CardTitle>
              <CardDescription>
                Number of applications received over time
              </CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={timelineData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 20,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="count"
                    fill="#0088FE"
                    stroke="#0088FE"
                    name="Applications"
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#FF8042"
                    name="Trend"
                    strokeWidth={2}
                  />
                  <Scatter dataKey="count" fill="#FF8042" name="Data points" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Performers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Candidates</CardTitle>
          <CardDescription>
            Candidates ranked by their overall performance score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Candidate</th>
                  <th className="text-center py-3 px-4">Overall Score</th>
                  <th className="text-center py-3 px-4">GitHub</th>
                  <th className="text-center py-3 px-4">Hackathons</th>
                  <th className="text-center py-3 px-4">Wins</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.topPerformers.map((candidate) => (
                  <tr key={candidate.id} className="border-b">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {candidate.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{candidate.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {candidate.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        {candidate.score.toFixed(0)}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-4">
                      {candidate.githubContributions ? (
                        <span className="flex items-center justify-center gap-1">
                          <Github className="h-3 w-3" />
                          {candidate.githubContributions}
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {candidate.hackathonCount ? (
                        <span className="flex items-center justify-center gap-1">
                          <Award className="h-3 w-3" />
                          {candidate.hackathonCount}
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {candidate.winCount ? (
                        <span className="flex items-center justify-center gap-1">
                          <Trophy className="h-3 w-3" />
                          {candidate.winCount}
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="text-right py-3 px-4">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/jobs/${jobId}/candidates/${candidate.id}`}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild>
          <Link to={`/jobs/${jobId}/candidates`}>View All Candidates</Link>
        </Button>
      </div>
    </div>
  );
}
