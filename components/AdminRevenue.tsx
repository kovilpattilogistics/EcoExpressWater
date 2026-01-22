import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from './SharedComponents';
import { subscribeTransactions, subscribeOrders } from '../services/firestoreService';
import { Transaction, Order } from '../types';

export const AdminRevenue: React.FC = () => {
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const unsubTrans = subscribeTransactions((transactions) => {
      const invested = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((acc, curr) => acc + curr.amount, 0);
      setTotalInvested(invested);
    });

    const unsubOrders = subscribeOrders((orders) => {
      // Calculate revenue from Delivered orders
      const revenue = orders
        .filter(o => o.status.includes('Delivered') || o.status.includes('picked'))
        .reduce((acc, curr) => acc + curr.totalAmount, 0);
      setTotalRevenue(revenue);
    });

    return () => {
      unsubTrans();
      unsubOrders();
    };
  }, []);

  const profit = totalRevenue - totalInvested;
  const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Financial Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-600">Total Revenue (Cash In)</p>
          <p className="text-2xl font-bold text-blue-900">₹{totalRevenue}</p>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <p className="text-sm text-orange-600">Total Invested (Cash Out)</p>
          <p className="text-2xl font-bold text-orange-900">₹{totalInvested}</p>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <p className="text-sm text-green-600">Net Profit</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-green-900">₹{profit}</p>
            <span className="text-xs text-green-700 font-medium mb-1">({margin}% margin)</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Investment vs Revenue">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="invested" fill="#f97316" name="Invested" />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Recent Transactions">
          {/* Simple list for now */}
          <div className="text-sm text-slate-500 text-center py-10">
            Detailed transaction history table would go here.
          </div>
        </Card>
      </div>
    </div>
  );
};
