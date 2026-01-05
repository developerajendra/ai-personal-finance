'use client';

import { useQuery } from '@tanstack/react-query';
import { Property } from '@/core/types';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Home, TrendingUp, MapPin, Calendar, DollarSign } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';

const COLORS = ['#FF8C42', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

export function PropertiesDetailView() {
  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['properties', 'published'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/properties?isPublished=true');
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading properties data..." size="lg" />
      </div>
    );
  }

  const totalPurchasePrice = properties.reduce((sum, prop) => sum + prop.purchasePrice, 0);
  const totalCurrentValue = properties.reduce(
    (sum, prop) => sum + (prop.currentValue || prop.purchasePrice),
    0
  );
  const totalAppreciation = totalCurrentValue - totalPurchasePrice;
  const appreciationPercent = totalPurchasePrice > 0 
    ? ((totalAppreciation / totalPurchasePrice) * 100).toFixed(2)
    : 0;

  const propertyTypeBreakdown = properties.reduce((acc, prop) => {
    const typeName = prop.type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    acc[typeName] = (acc[typeName] || 0) + (prop.currentValue || prop.purchasePrice);
    return acc;
  }, {} as Record<string, number>);

  const propertyChartData = Object.entries(propertyTypeBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const propertyValueComparison = properties.map((prop) => ({
    name: prop.name.length > 15 ? prop.name.substring(0, 15) + '...' : prop.name,
    purchasePrice: prop.purchasePrice,
    currentValue: prop.currentValue || prop.purchasePrice,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Properties</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {properties.length}
              </p>
            </div>
            <Home className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Purchase Value</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">
                ₹{totalPurchasePrice.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Value</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                ₹{totalCurrentValue.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Appreciation</p>
              <p
                className={`text-2xl font-bold mt-2 ${
                  totalAppreciation >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                ₹{totalAppreciation.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ({appreciationPercent}%)
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {propertyChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Property Type Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={propertyChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value">
                  {propertyChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {propertyValueComparison.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Purchase vs Current Value</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={propertyValueComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="purchasePrice" fill="#FF8C42" name="Purchase Price" />
                <Bar dataKey="currentValue" fill="#4ECDC4" name="Current Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Property Details Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Property Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchase Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Appreciation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchase Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {properties.map((property) => {
                const appreciation = (property.currentValue || property.purchasePrice) - property.purchasePrice;
                const appreciationPercent = property.purchasePrice > 0
                  ? ((appreciation / property.purchasePrice) * 100).toFixed(2)
                  : '0.00';
                
                return (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {property.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {property.type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {property.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{property.purchasePrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                      ₹{(property.currentValue || property.purchasePrice).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`font-semibold ${
                          appreciation >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {appreciation >= 0 ? '+' : ''}₹{appreciation.toLocaleString()} ({appreciationPercent}%)
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(property.purchaseDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          property.status === 'owned'
                            ? 'bg-green-100 text-green-800'
                            : property.status === 'rented-out'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {property.status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {properties.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Home className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No properties data available. Add properties in the Portfolio section.</p>
          </div>
        )}
      </div>
    </div>
  );
}

