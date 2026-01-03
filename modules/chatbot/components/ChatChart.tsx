"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];

interface ChartData {
  type: "pie" | "bar" | "line";
  title?: string;
  data: Array<{ name: string; value: number; [key: string]: any }>;
  xAxisKey?: string;
  yAxisKey?: string;
}

interface ChatChartProps {
  chartData: ChartData;
}

export function ChatChart({ chartData }: ChatChartProps) {
  const { type, title, data, xAxisKey = "name", yAxisKey = "value" } = chartData;

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="my-4 p-4 bg-white rounded-lg border border-gray-200">
      {title && (
        <h4 className="text-lg font-semibold mb-4 text-center">{title}</h4>
      )}
      <ResponsiveContainer width="100%" height={300}>
        {type === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={yAxisKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
            <Legend />
          </PieChart>
        ) : type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
            <Legend />
            {Object.keys(data[0] || {})
              .filter(key => key !== xAxisKey && key !== "name")
              .map((key, index) => (
                <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
              ))}
            {Object.keys(data[0] || {}).filter(key => key !== xAxisKey && key !== "name").length === 0 && (
              <Bar dataKey={yAxisKey} fill="#0088FE" />
            )}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
            <Legend />
            {Object.keys(data[0] || {})
              .filter(key => key !== xAxisKey && key !== "name")
              .map((key, index) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} />
              ))}
            {Object.keys(data[0] || {}).filter(key => key !== xAxisKey && key !== "name").length === 0 && (
              <Line type="monotone" dataKey={yAxisKey} stroke="#0088FE" />
            )}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

