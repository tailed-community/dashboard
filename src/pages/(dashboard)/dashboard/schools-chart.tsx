import { Cell, Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartData = [
  { school: "McGill University", count: 100 },
  { school: "Concordia University", count: 222 },
  { school: "Polytechnique", count: 210 },
  { school: "ÉTS", count: 45 },
];
const generateChartConfig = (data: typeof chartData) => {
  return data.reduce(
    (config, entry, index) => {
      config[entry.school] = {
        label: entry.school,
        color: `var(--chart-${index + 1})`, // Uses --chart-1, --chart-2, etc.
      };
      return config;
    },
    {} as Record<string, { label: string; color: string }>
  );
};

const chartConfig = generateChartConfig(chartData) satisfies ChartConfig;

export function SchoolChart() {
  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>Schools - Interactive</CardTitle>
          <CardDescription>Showing total of schools</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="school"
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="var(--chart-1)" // Default color, overridden per slice
            >
              {chartData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`var(--chart-${(index % 5) + 1})`}
                />
              ))}
            </Pie>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
