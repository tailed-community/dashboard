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
  { date: "2024-04-01", count: 222 },
  { date: "2024-04-02", count: 97 },
  { date: "2024-04-03", count: 167 },
  { date: "2024-04-04", count: 242 },
  { date: "2024-04-05", count: 373 },
  { date: "2024-04-06", count: 301 },
  { date: "2024-04-07", count: 245 },
  { date: "2024-04-08", count: 409 },
  { date: "2024-04-09", count: 59 },
  { date: "2024-04-10", count: 261 },
  { date: "2024-04-11", count: 327 },
  { date: "2024-04-12", count: 292 },
  { date: "2024-04-13", count: 342 },
  { date: "2024-04-14", count: 137 },
  { date: "2024-04-15", count: 120 },
  { date: "2024-04-16", count: 138 },
  { date: "2024-04-17", count: 446 },
  { date: "2024-04-18", count: 364 },
  { date: "2024-04-19", count: 243 },
  { date: "2024-04-20", count: 89 },
  { date: "2024-04-21", count: 137 },
  { date: "2024-04-22", count: 224 },
  { date: "2024-04-23", count: 138 },
  { date: "2024-04-24", count: 387 },
  { date: "2024-04-25", count: 215 },
  { date: "2024-04-26", count: 75 },
  { date: "2024-04-27", count: 383 },
  { date: "2024-04-28", count: 122 },
  { date: "2024-04-29", count: 315 },
  { date: "2024-04-30", count: 454 },
  { date: "2024-05-01", count: 165 },
  { date: "2024-05-02", count: 293 },
  { date: "2024-05-03", count: 247 },
  { date: "2024-05-04", count: 385 },
  { date: "2024-05-05", count: 481 },
  { date: "2024-05-06", count: 498 },
  { date: "2024-05-07", count: 388 },
  { date: "2024-05-08", count: 149 },
  { date: "2024-05-09", count: 227 },
  { date: "2024-05-10", count: 293 },
  { date: "2024-05-11", count: 335 },
  { date: "2024-05-12", count: 197 },
  { date: "2024-05-13", count: 197 },
  { date: "2024-05-14", count: 448 },
  { date: "2024-05-15", count: 473 },
  { date: "2024-05-16", count: 338 },
  { date: "2024-05-17", count: 499 },
  { date: "2024-05-18", count: 315 },
  { date: "2024-05-19", count: 235 },
  { date: "2024-05-20", count: 177 },
  { date: "2024-05-21", count: 82 },
  { date: "2024-05-22", count: 81 },
  { date: "2024-05-23", count: 252 },
  { date: "2024-05-24", count: 294 },
  { date: "2024-05-25", count: 201 },
  { date: "2024-05-26", count: 213 },
  { date: "2024-05-27", count: 420 },
  { date: "2024-05-28", count: 233 },
  { date: "2024-05-29", count: 78 },
  { date: "2024-05-30", count: 340 },
  { date: "2024-05-31", count: 178 },
  { date: "2024-06-01", count: 178 },
  { date: "2024-06-02", count: 470 },
  { date: "2024-06-03", count: 103 },
  { date: "2024-06-04", count: 439 },
  { date: "2024-06-05", count: 88 },
  { date: "2024-06-06", count: 294 },
  { date: "2024-06-07", count: 323 },
  { date: "2024-06-08", count: 385 },
  { date: "2024-06-09", count: 438 },
  { date: "2024-06-10", count: 155 },
  { date: "2024-06-11", count: 92 },
  { date: "2024-06-12", count: 492 },
  { date: "2024-06-13", count: 81 },
  { date: "2024-06-14", count: 426 },
  { date: "2024-06-15", count: 307 },
  { date: "2024-06-16", count: 371 },
  { date: "2024-06-17", count: 475 },
  { date: "2024-06-18", count: 107 },
  { date: "2024-06-19", count: 341 },
  { date: "2024-06-20", count: 408 },
  { date: "2024-06-21", count: 169 },
  { date: "2024-06-22", count: 317 },
  { date: "2024-06-23", count: 480 },
  { date: "2024-06-24", count: 132 },
  { date: "2024-06-25", count: 141 },
  { date: "2024-06-26", count: 434 },
  { date: "2024-06-27", count: 448 },
  { date: "2024-06-28", count: 149 },
  { date: "2024-06-29", count: 103 },
  { date: "2024-06-30", count: 446 },
];

const chartConfig = {
  candidates: {
    label: "Candidates",
  },
  count: {
    label: "Number of applicants",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function CandidatesChart() {
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
          <CardTitle>Number of applicants - Interactive</CardTitle>
          <CardDescription>
            Showing applicants for the last 3 months
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
                  stopColor="var(--color-count)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-count)"
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
              type="natural"
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
