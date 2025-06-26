import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const chartData = [
  { date: "2024-04-01", count: 0 },
  { date: "2024-04-02", count: 3 },
  { date: "2024-04-03", count: 3 },
  { date: "2024-04-04", count: 3 },
  { date: "2024-04-05", count: 3 },
  { date: "2024-04-06", count: 3 },
  { date: "2024-04-07", count: 3 },
  { date: "2024-04-08", count: 3 },
  { date: "2024-04-09", count: 3 },
  { date: "2024-04-10", count: 3 },
  { date: "2024-04-11", count: 3 },
  { date: "2024-04-12", count: 3 },
  { date: "2024-04-13", count: 3 },
  { date: "2024-04-14", count: 3 },
  { date: "2024-04-15", count: 3 },
  { date: "2024-04-16", count: 3 },
  { date: "2024-04-17", count: 3 },
  { date: "2024-04-18", count: 3 },
  { date: "2024-04-19", count: 3 },
  { date: "2024-04-20", count: 3 },
  { date: "2024-04-21", count: 3 },
  { date: "2024-04-22", count: 3 },
  { date: "2024-04-23", count: 3 },
  { date: "2024-04-24", count: 3 },
  { date: "2024-04-25", count: 3 },
  { date: "2024-04-26", count: 3 },
  { date: "2024-04-27", count: 3 },
  { date: "2024-04-28", count: 3 },
  { date: "2024-04-29", count: 3 },
  { date: "2024-04-30", count: 3 },
  { date: "2024-05-01", count: 2 },
  { date: "2024-05-02", count: 2 },
  { date: "2024-05-03", count: 2 },
  { date: "2024-05-04", count: 2 },
  { date: "2024-05-05", count: 2 },
  { date: "2024-05-06", count: 2 },
  { date: "2024-05-07", count: 2 },
  { date: "2024-05-08", count: 2 },
  { date: "2024-05-09", count: 2 },
  { date: "2024-05-10", count: 2 },
  { date: "2024-05-11", count: 2 },
  { date: "2024-05-12", count: 2 },
  { date: "2024-05-13", count: 2 },
  { date: "2024-05-14", count: 2 },
  { date: "2024-05-15", count: 2 },
  { date: "2024-05-16", count: 2 },
  { date: "2024-05-17", count: 2 },
  { date: "2024-05-18", count: 2 },
  { date: "2024-05-19", count: 2 },
  { date: "2024-05-20", count: 2 },
  { date: "2024-05-21", count: 2 },
  { date: "2024-05-22", count: 2 },
  { date: "2024-05-23", count: 2 },
  { date: "2024-05-24", count: 2 },
  { date: "2024-05-25", count: 2 },
  { date: "2024-05-26", count: 2 },
  { date: "2024-05-27", count: 2 },
  { date: "2024-05-28", count: 2 },
  { date: "2024-05-29", count: 2 },
  { date: "2024-05-30", count: 2 },
  { date: "2024-05-31", count: 2 },
  { date: "2024-06-01", count: 4 },
  { date: "2024-06-02", count: 4 },
  { date: "2024-06-03", count: 4 },
  { date: "2024-06-04", count: 4 },
  { date: "2024-06-05", count: 4 },
  { date: "2024-06-06", count: 4 },
  { date: "2024-06-07", count: 4 },
  { date: "2024-06-08", count: 4 },
  { date: "2024-06-09", count: 4 },
  { date: "2024-06-10", count: 4 },
  { date: "2024-06-11", count: 4 },
  { date: "2024-06-12", count: 4 },
  { date: "2024-06-13", count: 4 },
  { date: "2024-06-14", count: 4 },
  { date: "2024-06-15", count: 4 },
  { date: "2024-06-16", count: 4 },
  { date: "2024-06-17", count: 4 },
  { date: "2024-06-18", count: 4 },
  { date: "2024-06-19", count: 4 },
  { date: "2024-06-20", count: 4 },
  { date: "2024-06-21", count: 4 },
  { date: "2024-06-22", count: 4 },
  { date: "2024-06-23", count: 4 },
  { date: "2024-06-24", count: 4 },
  { date: "2024-06-25", count: 4 },
  { date: "2024-06-26", count: 4 },
  { date: "2024-06-27", count: 4 },
  { date: "2024-06-28", count: 4 },
  { date: "2024-06-29", count: 4 },
  { date: "2024-06-30", count: 4 },
];

const chartConfig = {
  openPositions: {
    label: "Open Positions",
  },
  count: {
    label: "Number of Open Positions",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function OpenPositionsChart() {
  const [timeRange, setTimeRange] = React.useState("90d");

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date);
    const referenceDate = new Date("2024-06-30");
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return date >= startDate;
  });

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>Open Positions - Interactive</CardTitle>
          <CardDescription>
            Showing open positions for the last 3 months
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Last 3 months
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-desktop)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-desktop)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-mobile)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-mobile)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="count"
              type="basis"
              fill="url(#fillDesktop)"
              stroke="var(--color-count)"
              stackId="a"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
