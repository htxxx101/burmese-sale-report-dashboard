import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, ShoppingCart, Package, DollarSign, Clock, User, Hash, Settings, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface OrderItem {
  item: string;
  price_per_unit: number;
  quantity: number;
  subtotal: number;
}

interface SalesData {
  created_time: string;
  sender: string;
  order_id: string;
  item: string;
}

interface ProcessedOrder {
  created_time: string;
  sender: string;
  order_id: string;
  items: OrderItem[];
  total_amount: number;
  total_quantity: number;
}

interface DailySales {
  date: string;
  revenue: number;
  orders: number;
}

interface ProductSales {
  name: string;
  value: number;
  quantity: number;
  fill: string;
}

type Period = 'today' | 'yesterday' | 'last_week' | 'last_month' | 'this_month' | 'last_3_months' | 'last_6_months';

// Chart configuration
const chartConfig = {
  revenue: {
    label: "ရောင်းအား",
    color: "hsl(var(--chart-1))",
  },
  orders: {
    label: "မှာယူမှုများ",
    color: "hsl(var(--chart-2))",
  },
};

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const PERIOD_LABELS = {
  today: 'ယနေ့',
  yesterday: 'မနေ့က', 
  last_week: 'ပြီးခဲ့သောအပတ်',
  this_month: 'ယခုလ',
  last_month: 'ပြီးခဲ့သောလ',
  last_3_months: 'ပြီးခဲ့သော ၃ လ',
  last_6_months: 'ပြီးခဲ့သော ၆ လ'
};

const PERIOD_ORDER: Period[] = ['today', 'yesterday', 'last_week', 'this_month', 'last_month', 'last_3_months', 'last_6_months'];

export default function SalesReportDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');
  const [rawData, setRawData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState<string>('');
  const [autoSync, setAutoSync] = useState(false);
  const [showGoogleSheetsConfig, setShowGoogleSheetsConfig] = useState(false);
  const [isConfigLocked, setIsConfigLocked] = useState(false);

  // Sample data for development (replace with Google Sheets API call)
  const sampleData: SalesData[] = [
    {
      created_time: "2025-08-26T01:35:55+0000",
      sender: "Bhone Khant",
      order_id: "ORD-20250826-5b1abb",
      item: '[{"item":"Redmi note12","price_per_unit":15000,"quantity":1,"subtotal":15000},{"item":"Gannng","price_per_unit":30000,"quantity":2,"subtotal":60000},{"item":"Lamba","price_per_unit":2400,"quantity":3,"subtotal":7200}]'
    },
    {
      created_time: "2025-08-26T19:41:34+0000",
      sender: "Ahha lala",
      order_id: "ORD-20250826-41afdf",
      item: '[{"item":"Tomato sauce","price_per_unit":12000,"quantity":1,"subtotal":12000},{"item":"Ginger","price_per_unit":30000,"quantity":2,"subtotal":60000},{"item":"Nano","price_per_unit":24000,"quantity":1,"subtotal":24000}]'
    },
    {
      created_time: "2025-08-25T10:15:20+0000",
      sender: "John Doe",
      order_id: "ORD-20250825-abc123",
      item: '[{"item":"iPhone 15","price_per_unit":450000,"quantity":1,"subtotal":450000}]'
    },
    {
      created_time: "2025-08-24T14:30:45+0000",
      sender: "Jane Smith",
      order_id: "ORD-20250824-def456",
      item: '[{"item":"Samsung Galaxy","price_per_unit":320000,"quantity":1,"subtotal":320000},{"item":"Case","price_per_unit":5000,"quantity":2,"subtotal":10000}]'
    }
  ];

  // Fetch data from Google Sheets
  const fetchData = async (url?: string) => {
    const urlToUse = url || googleSheetsUrl || localStorage.getItem('googleSheetsUrl');
    
    setLoading(true);
    setError(null);
    
    try {
      if (urlToUse && urlToUse.trim()) {
        // Try to fetch from Google Sheets URL
        const response = await fetch(urlToUse);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        const parsedData = parseCSVToSalesData(csvText);
        setRawData(parsedData);
        
        // Save URL to localStorage for future use
        if (url) {
          localStorage.setItem('googleSheetsUrl', url);
          setGoogleSheetsUrl(url);
          setIsConfigLocked(true); // Lock config after successful connection
        }
      } else {
        // Use sample data if no URL provided
        await new Promise(resolve => setTimeout(resolve, 1000));
        setRawData(sampleData);
      }
    } catch (err) {
      setError('Google Sheets မှ ဒေတာ ရယူရာတွင် ပြဿနာ ရှိနေပါသည်။ URL ကို စစ်ဆေးပြီး ပြန်လည် ကြိုးစားပါ။');
      console.error('Error fetching data:', err);
      // Fallback to sample data on error
      setRawData(sampleData);
    } finally {
      setLoading(false);
    }
  };

  // Parse CSV data to SalesData format
  const parseCSVToSalesData = (csvText: string): SalesData[] => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim().replace(/"/g, '') || '';
      });
      
      return {
        created_time: row.created_time || '',
        sender: row.sender || '',
        order_id: row.order_id || '',
        item: row.item || ''
      };
    });
  };

  useEffect(() => {
    // Load saved URL from localStorage
    const savedUrl = localStorage.getItem('googleSheetsUrl');
    const savedAutoSync = localStorage.getItem('autoSync') === 'true';
    
    if (savedUrl) {
      setGoogleSheetsUrl(savedUrl);
      setIsConfigLocked(true); // Lock if URL already exists
      setShowGoogleSheetsConfig(true); // Show config if URL exists
    }
    setAutoSync(savedAutoSync);
    
    fetchData();
  }, []);

  // Auto-sync every 30 minutes
  useEffect(() => {
    if (!autoSync) return;
    
    const interval = setInterval(() => {
      if (googleSheetsUrl) {
        fetchData();
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    return () => clearInterval(interval);
  }, [autoSync, googleSheetsUrl]);

  // Parse and process data
  const processedOrders = useMemo((): ProcessedOrder[] => {
    return rawData.map(row => {
      try {
        const items: OrderItem[] = JSON.parse(row.item);
        const total_amount = items.reduce((sum, item) => sum + item.subtotal, 0);
        const total_quantity = items.reduce((sum, item) => sum + item.quantity, 0);
        
        return {
          created_time: row.created_time,
          sender: row.sender,
          order_id: row.order_id,
          items,
          total_amount,
          total_quantity
        };
      } catch (error) {
        console.error('Error parsing items for order:', row.order_id, error);
        return {
          created_time: row.created_time,
          sender: row.sender,
          order_id: row.order_id,
          items: [],
          total_amount: 0,
          total_quantity: 0
        };
      }
    });
  }, [rawData]);

  // Filter data by selected period
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return processedOrders.filter(order => {
      const orderDate = new Date(order.created_time);
      const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

      switch (selectedPeriod) {
        case 'today':
          return orderDay.getTime() === today.getTime();
        case 'yesterday':
          return orderDay.getTime() === yesterday.getTime();
        case 'last_week':
          return orderDate >= weekAgo && orderDate < today;
        case 'last_month':
          return orderDate >= monthAgo && orderDate < today;
        case 'this_month':
          return orderDate >= thisMonthStart;
        case 'last_3_months':
          return orderDate >= threeMonthsAgo && orderDate < today;
        case 'last_6_months':
          return orderDate >= sixMonthsAgo && orderDate < today;
        default:
          return true;
      }
    });
  }, [processedOrders, selectedPeriod]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const totalOrders = filteredOrders.length;
    const totalItems = filteredOrders.reduce((sum, order) => sum + order.total_quantity, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      totalItems,
      averageOrderValue
    };
  }, [filteredOrders]);

  // Prepare daily sales data for line chart
  const dailySalesData = useMemo((): DailySales[] => {
    const salesByDate: { [key: string]: { revenue: number; orders: number } } = {};

    filteredOrders.forEach(order => {
      const date = new Date(order.created_time).toISOString().split('T')[0];
      if (!salesByDate[date]) {
        salesByDate[date] = { revenue: 0, orders: 0 };
      }
      salesByDate[date].revenue += order.total_amount;
      salesByDate[date].orders += 1;
    });

    return Object.entries(salesByDate)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('my-MM'),
        revenue: data.revenue,
        orders: data.orders
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredOrders]);

  // Prepare top products data for pie chart
  const topProductsData = useMemo((): ProductSales[] => {
    const productSales: { [key: string]: { quantity: number; revenue: number } } = {};

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.item]) {
          productSales[item.item] = { quantity: 0, revenue: 0 };
        }
        productSales[item.item].quantity += item.quantity;
        productSales[item.item].revenue += item.subtotal;
      });
    });

    return Object.entries(productSales)
      .map(([name, data], index) => ({
        name,
        value: data.revenue,
        quantity: data.quantity,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredOrders]);

  // Monthly comparison data for multi-month periods
  const monthlyComparisonData = useMemo(() => {
    if (!['last_3_months', 'last_6_months'].includes(selectedPeriod)) {
      return [];
    }

    const monthlyData: { [key: string]: { revenue: number; orders: number } } = {};

    filteredOrders.forEach(order => {
      const date = new Date(order.created_time);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, orders: 0 };
      }
      monthlyData[monthKey].revenue += order.total_amount;
      monthlyData[monthKey].orders += 1;
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month: new Date(`${month}-01`).toLocaleDateString('my-MM', { 
          year: 'numeric', 
          month: 'long' 
        }),
        revenue: data.revenue,
        orders: data.orders
      }))
      .sort((a, b) => new Date(`${a.month.split(' ')[1]}-${a.month.split(' ')[0]}-01`).getTime() - 
                     new Date(`${b.month.split(' ')[1]}-${b.month.split(' ')[0]}-01`).getTime());
  }, [filteredOrders, selectedPeriod]);

  // Format currency in Myanmar Kyat
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('my-MM')} ကျပ်`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-info to-success bg-clip-text text-transparent">
            Burmese Sale Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Your Online Sale Report
          </p>
        </div>

        {/* Google Sheets Configuration Toggle */}
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <span className="font-medium">Data Source</span>
                {googleSheetsUrl && (
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    ချိတ်ဆက်ပြီး
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {googleSheetsUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsConfigLocked(!isConfigLocked)}
                    className="flex items-center gap-2"
                  >
                    {isConfigLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    {isConfigLocked ? 'Unlock' : 'Lock'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGoogleSheetsConfig(!showGoogleSheetsConfig)}
                  className="flex items-center gap-2"
                >
                  {showGoogleSheetsConfig ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showGoogleSheetsConfig ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Sheets Configuration Panel */}
        {showGoogleSheetsConfig && (
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-primary" />
                Google Sheets Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-2">
                <Input
                  type="text"
                  placeholder="Google Sheets CSV URL ကို ထည့်သွင်းပါ..."
                  value={googleSheetsUrl}
                  onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                  className="flex-1"
                  disabled={isConfigLocked}
                />
                <Button 
                  onClick={() => fetchData(googleSheetsUrl)} 
                  disabled={loading || (isConfigLocked && !!googleSheetsUrl)}
                  className="bg-gradient-to-r from-primary to-info"
                >
                  {loading ? 'ရယူနေသည်...' : 'ဒေတာ ရယူရန်'}
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSync"
                  checked={autoSync}
                  onChange={(e) => {
                    setAutoSync(e.target.checked);
                    localStorage.setItem('autoSync', e.target.checked.toString());
                  }}
                  className="rounded"
                  disabled={isConfigLocked}
                />
                <label htmlFor="autoSync" className="text-sm">
                  ၃၀ မိနစ်တိုင်း အလိုအလျောက် ပြန်လည်ရယူရန် (Auto-sync every 30 minutes)
                </label>
              </div>
              
              {isConfigLocked && (
                <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-warning">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Configuration is locked. Click "Unlock" to make changes.
                  </p>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Google Sheets ကို CSV format အဖြစ် export လုပ်ပြီး လင့်ခ်ကို အသုံးပြုပါ
              </p>
            </CardContent>
          </Card>
        )}

        {/* Period Selector */}
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              ကာလ ရွေးချယ်ရန်
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PERIOD_ORDER.map(period => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className={cn(
                    "transition-all duration-200",
                    selectedPeriod === period && "bg-gradient-to-r from-primary to-info shadow-lg"
                  )}
                >
                  {PERIOD_LABELS[period]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">ဒေတာများ ရယူနေပါသည်...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-0 shadow-lg border-destructive/20">
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{error}</p>
              <Button 
                onClick={() => fetchData()} 
                className="mt-4"
                variant="outline"
              >
                ပြန်လည် ကြိုးစားရန်
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-success/10 to-success/5 hover:shadow-xl transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">စုစုပေါင်း ဝင်ငွေ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-success">{formatCurrency(summaryMetrics.totalRevenue)}</div>
                    </div>
                    <DollarSign className="h-8 w-8 text-success/60" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-info/10 to-info/5 hover:shadow-xl transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">စုစုပေါင်း မှာယူမှုများ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-info">{summaryMetrics.totalOrders.toLocaleString('my-MM')}</div>
                    </div>
                    <ShoppingCart className="h-8 w-8 text-info/60" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-warning/10 to-warning/5 hover:shadow-xl transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">စုစုပေါင်း ကုန်ပစ္စည်းများ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-warning">{summaryMetrics.totalItems.toLocaleString('my-MM')}</div>
                    </div>
                    <Package className="h-8 w-8 text-warning/60" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/10 to-primary/5 hover:shadow-xl transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">ပျမ်းမျှ မှာယူမှု တန်ဖိုး</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-primary">{formatCurrency(summaryMetrics.averageOrderValue)}</div>
                    </div>
                    <TrendingUp className="h-8 w-8 text-primary/60" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Sales Line Chart */}
              <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">နေ့စဉ် ရောင်းအား</CardTitle>
                  <CardDescription>ရောင်းအား ပမာណ နှင့် မှာယူမှု အရေအတွက်</CardDescription>
                </CardHeader>
                <CardContent>
                  {dailySalesData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailySalesData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="date" 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="hsl(var(--chart-1))" 
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="orders" 
                            stroke="hsl(var(--chart-2))" 
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      ရွေးချယ်ထားသော ကာလအတွင်း ဒေတာ မရှိပါ
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Products Pie Chart */}
              <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">အရောင်းရဆုံး ကုန်ပစ္စည်းများ</CardTitle>
                  <CardDescription>ရောင်းအား တန်ဖိုး အရ ရန်ကင်း</CardDescription>
                </CardHeader>
                <CardContent>
                  {topProductsData.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={topProductsData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {topProductsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartTooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as ProductSales;
                                return (
                                  <div className="bg-background border rounded-lg p-3 shadow-lg">
                                    <p className="font-medium">{data.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      တန်ဖိုး: {formatCurrency(data.value)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      အရေအတွက်: {data.quantity}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      ရွေးချယ်ထားသော ကာလအတွင်း ဒေတာ မရှိပါ
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Comparison for 3/6 month periods */}
            {['last_3_months', 'last_6_months'].includes(selectedPeriod) && monthlyComparisonData.length > 0 && (
              <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">လစဉ် ရောင်းအား နှိုင်းယှဉ်ချက်</CardTitle>
                  <CardDescription>လတိုင်း ရောင်းအား တိုးတက်မှု သို့မဟုတ် ကျဆင်းမှု</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="month" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <ChartTooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-background border rounded-lg p-3 shadow-lg">
                                  <p className="font-medium">{label}</p>
                                  <p className="text-sm text-success">
                                    ရောင်းအား: {formatCurrency(payload[0].value as number)}
                                  </p>
                                  <p className="text-sm text-info">
                                    မှာယူမှုများ: {payload[1].value}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="hsl(var(--chart-1))" 
                          strokeWidth={3}
                          dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="orders" 
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={3}
                          dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2, r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Recent Orders Table */}
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">လတ်တလော မှာယူမှုများ</CardTitle>
                <CardDescription>နောက်ဆုံး ရရှိသော မှာယူမှု စာရင်း</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredOrders.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-medium">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              အချိန်
                            </div>
                          </TableHead>
                          <TableHead className="font-medium">
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4" />
                              မှာယူမှု နံပါတ်
                            </div>
                          </TableHead>
                          <TableHead className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              ကုန်ပစ္စည်း အရေအတွက်
                            </div>
                          </TableHead>
                          <TableHead className="font-medium text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <DollarSign className="h-4 w-4" />
                              စုစုပေါင်း တန်ဖိုး
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders
                          .sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime())
                          .slice(0, 10)
                          .map((order, index) => (
                            <TableRow key={order.order_id} className="hover:bg-muted/30 transition-colors">
                              <TableCell>
                                <div className="text-sm">
                                  <div>{new Date(order.created_time).toLocaleDateString('my-MM')}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(order.created_time).toLocaleTimeString('my-MM')}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {order.order_id}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {order.total_quantity} ခု
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(order.total_amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    ရွေးချယ်ထားသော ကာလအတွင်း မှာယူမှု မရှိပါ
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">
            ရောင်းအား အစီရင်ခံစာ ဒက်ရှ်ဘုတ် - လုပ်ငန်း လုပ်ကိုင်မှု ကို အချိန်နှင့်တစ်ပြေးညီ စောင့်ကြည့်ရှုစေ့ရန်
          </p>
        </div>
      </div>
    </div>
  );
}