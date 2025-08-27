import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Calendar, TrendingUp, ShoppingCart, Package, DollarSign, Clock, User, Hash, Settings, Lock, Unlock, Eye, EyeOff, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';

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

// Normalize Google Sheets URL (accept share links and convert to CSV export)
const normalizeGoogleSheetsUrl = (input: string): string => {
  if (!input) return '';
  if (input.includes('/export?') && input.includes('format=csv')) return input;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return input;
  const id = match[1];
  const gidMatch = input.match(/[?#&]gid=(\d+)/) || input.match(/#gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
};

export default function SalesReportDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');
  const [rawData, setRawData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState<string>('');
  const [autoSync, setAutoSync] = useState(false);
  const [showGoogleSheetsConfig, setShowGoogleSheetsConfig] = useState(false);
  const [isConfigLocked, setIsConfigLocked] = useState(false);

  // Enhanced sample data for better visualization (ignored when Google Sheets data is connected)
  const sampleData: SalesData[] = [
    // Today's orders
    {
      created_time: "2025-08-26T01:35:55+0000",
      sender: "Bhone Khant", 
      order_id: "ORD-20250826-5b1abb",
      item: '[{"item":"Redmi Note 12","price_per_unit":450000,"quantity":1,"subtotal":450000},{"item":"Phone Case","price_per_unit":15000,"quantity":2,"subtotal":30000}]'
    },
    {
      created_time: "2025-08-26T08:20:15+0000",
      sender: "Mg Thant",
      order_id: "ORD-20250826-7c2def",
      item: '[{"item":"Samsung Galaxy A54","price_per_unit":520000,"quantity":1,"subtotal":520000},{"item":"Screen Protector","price_per_unit":8000,"quantity":1,"subtotal":8000}]'
    },
    {
      created_time: "2025-08-26T14:45:30+0000", 
      sender: "Ma Hnin",
      order_id: "ORD-20250826-9e4bcd",
      item: '[{"item":"iPhone 15 Pro","price_per_unit":1800000,"quantity":1,"subtotal":1800000},{"item":"MagSafe Charger","price_per_unit":65000,"quantity":1,"subtotal":65000}]'
    },
    {
      created_time: "2025-08-26T19:41:34+0000",
      sender: "Ko Aung",
      order_id: "ORD-20250826-41afdf",
      item: '[{"item":"MacBook Air M2","price_per_unit":1950000,"quantity":1,"subtotal":1950000},{"item":"Magic Mouse","price_per_unit":120000,"quantity":1,"subtotal":120000}]'
    },
    
    // Yesterday's orders
    {
      created_time: "2025-08-25T09:15:20+0000",
      sender: "Ma Khin",
      order_id: "ORD-20250825-abc123", 
      item: '[{"item":"iPad Air","price_per_unit":850000,"quantity":1,"subtotal":850000},{"item":"Apple Pencil","price_per_unit":180000,"quantity":1,"subtotal":180000}]'
    },
    {
      created_time: "2025-08-25T12:30:45+0000",
      sender: "Ko Zaw",
      order_id: "ORD-20250825-def456",
      item: '[{"item":"Sony WH-1000XM5","price_per_unit":480000,"quantity":1,"subtotal":480000},{"item":"Charging Case","price_per_unit":25000,"quantity":1,"subtotal":25000}]'
    },
    {
      created_time: "2025-08-25T16:22:10+0000",
      sender: "Ma Phyu", 
      order_id: "ORD-20250825-ghi789",
      item: '[{"item":"Dell XPS 13","price_per_unit":1650000,"quantity":1,"subtotal":1650000},{"item":"Wireless Mouse","price_per_unit":35000,"quantity":1,"subtotal":35000}]'
    },
    
    // Past week orders
    {
      created_time: "2025-08-24T10:45:30+0000",
      sender: "Ko Min",
      order_id: "ORD-20250824-jkl012",
      item: '[{"item":"AirPods Pro 2","price_per_unit":380000,"quantity":2,"subtotal":760000},{"item":"Lightning Cable","price_per_unit":12000,"quantity":3,"subtotal":36000}]'
    },
    {
      created_time: "2025-08-23T14:20:15+0000",
      sender: "Ma Su",
      order_id: "ORD-20250823-mno345",
      item: '[{"item":"Nintendo Switch","price_per_unit":480000,"quantity":1,"subtotal":480000},{"item":"Pro Controller","price_per_unit":85000,"quantity":1,"subtotal":85000}]'
    },
    {
      created_time: "2025-08-22T11:30:45+0000", 
      sender: "Ko Naing",
      order_id: "ORD-20250822-pqr678",
      item: '[{"item":"PlayStation 5","price_per_unit":850000,"quantity":1,"subtotal":850000},{"item":"Extra Controller","price_per_unit":95000,"quantity":2,"subtotal":190000}]'
    },
    {
      created_time: "2025-08-21T15:45:20+0000",
      sender: "Ma Thida",
      order_id: "ORD-20250821-stu901",
      item: '[{"item":"Canon EOS R6","price_per_unit":2200000,"quantity":1,"subtotal":2200000},{"item":"50mm Lens","price_per_unit":650000,"quantity":1,"subtotal":650000}]'
    },
    
    // This month's earlier orders  
    {
      created_time: "2025-08-20T09:15:30+0000",
      sender: "Ko Htun",
      order_id: "ORD-20250820-vwx234",
      item: '[{"item":"Surface Laptop 5","price_per_unit":1750000,"quantity":1,"subtotal":1750000},{"item":"Surface Pen","price_per_unit":150000,"quantity":1,"subtotal":150000}]'
    },
    {
      created_time: "2025-08-19T13:22:45+0000",
      sender: "Ma Ei",
      order_id: "ORD-20250819-yz567",
      item: '[{"item":"Xiaomi Mi 13","price_per_unit":420000,"quantity":1,"subtotal":420000},{"item":"Wireless Earbuds","price_per_unit":85000,"quantity":1,"subtotal":85000}]'
    },
    {
      created_time: "2025-08-18T16:10:20+0000",
      sender: "Ko Lwin",
      order_id: "ORD-20250818-abc890",
      item: '[{"item":"Gaming Chair","price_per_unit":320000,"quantity":1,"subtotal":320000},{"item":"Desk Lamp","price_per_unit":45000,"quantity":1,"subtotal":45000}]'
    },
    
    // Last month's orders (July 2025)
    {
      created_time: "2025-07-28T10:30:15+0000",
      sender: "Ma Cho",
      order_id: "ORD-20250728-def123",
      item: '[{"item":"Lenovo ThinkPad","price_per_unit":1450000,"quantity":1,"subtotal":1450000},{"item":"Docking Station","price_per_unit":180000,"quantity":1,"subtotal":180000}]'
    },
    {
      created_time: "2025-07-25T14:45:30+0000",
      sender: "Ko Ye",
      order_id: "ORD-20250725-ghi456",
      item: '[{"item":"Smart TV 55 inch","price_per_unit":950000,"quantity":1,"subtotal":950000},{"item":"Sound Bar","price_per_unit":280000,"quantity":1,"subtotal":280000}]'
    },
    {
      created_time: "2025-07-22T11:20:45+0000",
      sender: "Ma May",
      order_id: "ORD-20250722-jkl789",
      item: '[{"item":"Air Fryer","price_per_unit":180000,"quantity":1,"subtotal":180000},{"item":"Rice Cooker","price_per_unit":120000,"quantity":1,"subtotal":120000}]'
    },
    {
      created_time: "2025-07-18T16:35:20+0000",
      sender: "Ko Htet",
      order_id: "ORD-20250718-mno012", 
      item: '[{"item":"Espresso Machine","price_per_unit":650000,"quantity":1,"subtotal":650000},{"item":"Coffee Beans","price_per_unit":25000,"quantity":4,"subtotal":100000}]'
    },
    {
      created_time: "2025-07-15T09:15:30+0000",
      sender: "Ma Nwe",
      order_id: "ORD-20250715-pqr345",
      item: '[{"item":"Robot Vacuum","price_per_unit":480000,"quantity":1,"subtotal":480000},{"item":"Extra Filters","price_per_unit":15000,"quantity":6,"subtotal":90000}]'
    },
    {
      created_time: "2025-07-12T13:45:15+0000",
      sender: "Ko San",
      order_id: "ORD-20250712-stu678",
      item: '[{"item":"Electric Scooter","price_per_unit":850000,"quantity":1,"subtotal":850000},{"item":"Helmet","price_per_unit":45000,"quantity":1,"subtotal":45000}]'
    },
    {
      created_time: "2025-07-08T12:20:45+0000",
      sender: "Ma Win",
      order_id: "ORD-20250708-vwx901",
      item: '[{"item":"Smart Watch","price_per_unit":320000,"quantity":1,"subtotal":320000},{"item":"Extra Bands","price_per_unit":25000,"quantity":3,"subtotal":75000}]'
    },
    
    // Additional historical data for better visualization
    {
      created_time: "2025-07-05T15:30:20+0000",
      sender: "Ko Tun",
      order_id: "ORD-20250705-yza234",
      item: '[{"item":"Bluetooth Speaker","price_per_unit":120000,"quantity":2,"subtotal":240000},{"item":"Power Bank","price_per_unit":35000,"quantity":1,"subtotal":35000}]'
    },
    {
      created_time: "2025-07-02T11:45:30+0000",
      sender: "Ma Moe", 
      order_id: "ORD-20250702-bcd567",
      item: '[{"item":"Tablet 10 inch","price_per_unit":380000,"quantity":1,"subtotal":380000},{"item":"Keyboard Cover","price_per_unit":65000,"quantity":1,"subtotal":65000}]'
    }
  ];

  // Fetch data from Google Sheets
  const fetchData = async (url?: string) => {
    const urlToUse = url || googleSheetsUrl || localStorage.getItem('googleSheetsUrl');
    const normalized = urlToUse ? normalizeGoogleSheetsUrl(urlToUse) : '';
    
    setLoading(true);
    setError(null);
    
    try {
      if (normalized && normalized.trim()) {
        const response = await fetch(normalized);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const parsedData = parseCSVToSalesData(text);
        setRawData(parsedData);
        
        // Save original URL (what user pasted)
        if (url) {
          localStorage.setItem('googleSheetsUrl', url);
          setGoogleSheetsUrl(url);
          setIsConfigLocked(true);
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

  // Parse CSV data to SalesData format (robust via PapaParse)
  const parseCSVToSalesData = (csvText: string): SalesData[] => {
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    if ((result as any).errors && (result as any).errors.length) {
      console.warn('CSV parse errors:', (result as any).errors);
    }

    const rows = (result.data as any[]).filter(Boolean);

    return rows.map((row: any) => {
      const get = (keys: string[]): string => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null) return String(row[k]);
          const found = Object.keys(row).find((rk) => rk && rk.trim && rk.trim().toLowerCase() === k.toLowerCase());
          if (found) return String(row[found]);
        }
        return '';
      };

      const itemsRaw = get(['items', 'Items', 'item', 'Item']);
      const itemsStr = (itemsRaw || '').replace(/\r/g, '').replace(/""/g, '"');

      return {
        created_time: get(['created_time', 'Created_Time', 'created time', 'Created Time']),
        sender: get(['buyer_name', 'Buyer_Name', 'buyer name', 'Buyer Name', 'sender', 'Sender']),
        order_id: get(['order_id', 'Order_ID', 'Order Id', 'Order ID']),
        item: itemsStr
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

  // This Month vs Last Month Comparison
  const monthlyComparisonCurrentVsLast = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calculate this month's data
    const thisMonthOrders = processedOrders.filter(order => {
      const orderDate = new Date(order.created_time);
      return orderDate >= thisMonthStart && orderDate <= thisMonthEnd;
    });

    // Calculate last month's data
    const lastMonthOrders = processedOrders.filter(order => {
      const orderDate = new Date(order.created_time);
      return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
    });

    const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const thisMonthOrderCount = thisMonthOrders.length;
    const lastMonthOrderCount = lastMonthOrders.length;

    const revenueChange = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;
    const orderChange = lastMonthOrderCount > 0 ? ((thisMonthOrderCount - lastMonthOrderCount) / lastMonthOrderCount * 100) : 0;

    return {
      thisMonth: {
        revenue: thisMonthRevenue,
        orders: thisMonthOrderCount,
        month: now.toLocaleDateString('my-MM', { month: 'long' })
      },
      lastMonth: {
        revenue: lastMonthRevenue,
        orders: lastMonthOrderCount,
        month: new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('my-MM', { month: 'long' })
      },
      revenueChange,
      orderChange
    };
  }, [processedOrders]);

  // Export to PDF functionality
  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 12;

      // Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('Sales Report Dashboard', margin, 18);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text(`Report Period: ${PERIOD_LABELS[selectedPeriod]}`, margin, 26);
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, 32);

      // Summary metrics table
      autoTable(pdf, {
        startY: 38,
        head: [['Metric', 'Value']],
        body: [
          ['Total Revenue', formatCurrency(summaryMetrics.totalRevenue)],
          ['Total Orders', String(summaryMetrics.totalOrders)],
          ['Total Items', String(summaryMetrics.totalItems)],
          ['Average Order Value', formatCurrency(summaryMetrics.averageOrderValue)],
        ],
        styles: { fontSize: 9 },
      });

      let currentY = (pdf as any).lastAutoTable?.finalY || 38;

      // Monthly comparison table
      const comparison = monthlyComparisonCurrentVsLast;
      autoTable(pdf, {
        startY: currentY + 6,
        head: [['', comparison.thisMonth.month, comparison.lastMonth.month]],
        body: [
          ['Revenue', formatCurrency(comparison.thisMonth.revenue), formatCurrency(comparison.lastMonth.revenue)],
          ['Orders', String(comparison.thisMonth.orders), String(comparison.lastMonth.orders)],
          ['Change', `${comparison.revenueChange >= 0 ? '+' : ''}${comparison.revenueChange.toFixed(1)}%`, `${comparison.orderChange >= 0 ? '+' : ''}${comparison.orderChange.toFixed(1)}%`],
        ],
        styles: { fontSize: 9 },
      });

      currentY = (pdf as any).lastAutoTable.finalY;

      // Recent orders table with items summary (auto page breaks)
      const tableBody = filteredOrders.slice(0, 100).map((order) => {
        const itemsSummary = order.items && order.items.length
          ? order.items.map((it) => `${it.item} x${it.quantity}`).join(', ')
          : '-';
        return [
          order.order_id,
          order.sender,
          new Date(order.created_time).toLocaleString(),
          itemsSummary,
          formatCurrency(order.total_amount),
        ];
      });

      autoTable(pdf, {
        startY: currentY + 8,
        head: [['Order ID', 'Customer', 'Date', 'Items', 'Amount']],
        body: tableBody,
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 36 },
          1: { cellWidth: 30 },
          2: { cellWidth: 34 },
          3: { cellWidth: 70 },
          4: { cellWidth: 20, halign: 'right' },
        },
        didDrawPage: (data) => {
          // Header per page
          pdf.setFontSize(9);
          pdf.text(`Sales Report - ${PERIOD_LABELS[selectedPeriod]}`, margin, 10);
          // Footer page number
          const pageSize = pdf.internal.pageSize;
          const pageWidth = pageSize.getWidth();
          const pageHeight = pageSize.getHeight();
          pdf.text(`${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
        },
      });

      const currentDate = new Date().toISOString().split('T')[0];
      const periodText = PERIOD_LABELS[selectedPeriod].replace(/\s/g, '-');
      pdf.save(`sales-report-${periodText}-${currentDate}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('PDF ဖိုင် ထုတ်ရာတွင် ပြဿနာရှိနေပါသည်။ ထပ်မံကြိုးစားပါ။');
    }
  };

  // Format currency in Myanmar Kyat
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('my-MM')} ကျပ်`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6" id="dashboard-content">
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
                  placeholder="Google Sheets Share Link (သို့) CSV URL ကို ထည့်သွင်းပါ..."
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
                Google Sheets ရဲ့ Share Link ကိုတိုက်ရိုက် ထည့်နိုင်သည်။ Share Link ထည့်ပါက အလိုအလျောက် CSV export URL အဖြစ် ပြောင်းပြီး ဒေတာကို ရယူပါမည်။
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
            <div className="space-y-4">
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
              
              {/* Export Options */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Export current period as PDF:
                  </div>
                  <Button 
                    onClick={exportToPDF}
                    variant="outline"
                    size="sm"
                    className="bg-gradient-to-r from-success/10 to-warning/10 hover:from-success/20 hover:to-warning/20 border-success/20"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export {PERIOD_LABELS[selectedPeriod]}
                  </Button>
                </div>
              </div>
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

            {/* This Month vs Last Month Comparison */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-info/10 to-primary/10 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      လစဉ် နှိုင်းယှဉ်ချက်
                    </CardTitle>
                    <CardDescription>
                      {monthlyComparisonCurrentVsLast.thisMonth.month} နှင့် {monthlyComparisonCurrentVsLast.lastMonth.month} နှိုင်းယှဉ်မှု
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Revenue Comparison */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-success" />
                      ရောင်းအား နှိုင်းယှဉ်ချက်
                    </h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-success/5 to-success/10 border border-success/20">
                        <div>
                          <p className="text-sm text-muted-foreground">{monthlyComparisonCurrentVsLast.thisMonth.month}</p>
                          <p className="text-xl font-bold text-success">
                            {formatCurrency(monthlyComparisonCurrentVsLast.thisMonth.revenue)}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={monthlyComparisonCurrentVsLast.revenueChange >= 0 ? "default" : "destructive"}
                            className={
                              monthlyComparisonCurrentVsLast.revenueChange >= 0 
                                ? "bg-success/10 text-success border-success/20" 
                                : ""
                            }
                          >
                            {monthlyComparisonCurrentVsLast.revenueChange >= 0 ? '+' : ''}
                            {monthlyComparisonCurrentVsLast.revenueChange.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-muted/5 to-muted/10 border border-muted/20">
                        <div>
                          <p className="text-sm text-muted-foreground">{monthlyComparisonCurrentVsLast.lastMonth.month}</p>
                          <p className="text-xl font-bold text-muted-foreground">
                            {formatCurrency(monthlyComparisonCurrentVsLast.lastMonth.revenue)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Visual Revenue Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{monthlyComparisonCurrentVsLast.revenueChange >= 0 ? 'တိုးတက်' : 'ကျဆင်း'}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            monthlyComparisonCurrentVsLast.revenueChange >= 0 ? 'bg-success' : 'bg-destructive'
                          }`}
                          style={{ 
                            width: `${Math.min(Math.abs(monthlyComparisonCurrentVsLast.revenueChange), 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Orders Comparison */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-info" />
                      မှာယူမှု နှိုင်းယှဉ်ချက်
                    </h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-info/5 to-info/10 border border-info/20">
                        <div>
                          <p className="text-sm text-muted-foreground">{monthlyComparisonCurrentVsLast.thisMonth.month}</p>
                          <p className="text-xl font-bold text-info">
                            {monthlyComparisonCurrentVsLast.thisMonth.orders.toLocaleString('my-MM')} ခု
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={monthlyComparisonCurrentVsLast.orderChange >= 0 ? "default" : "destructive"}
                            className={
                              monthlyComparisonCurrentVsLast.orderChange >= 0 
                                ? "bg-info/10 text-info border-info/20" 
                                : ""
                            }
                          >
                            {monthlyComparisonCurrentVsLast.orderChange >= 0 ? '+' : ''}
                            {monthlyComparisonCurrentVsLast.orderChange.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-muted/5 to-muted/10 border border-muted/20">
                        <div>
                          <p className="text-sm text-muted-foreground">{monthlyComparisonCurrentVsLast.lastMonth.month}</p>
                          <p className="text-xl font-bold text-muted-foreground">
                            {monthlyComparisonCurrentVsLast.lastMonth.orders.toLocaleString('my-MM')} ခု
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Visual Orders Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{monthlyComparisonCurrentVsLast.orderChange >= 0 ? 'တိုးတက်' : 'ကျဆင်း'}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            monthlyComparisonCurrentVsLast.orderChange >= 0 ? 'bg-info' : 'bg-destructive'
                          }`}
                          style={{ 
                            width: `${Math.min(Math.abs(monthlyComparisonCurrentVsLast.orderChange), 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comparison Chart */}
                <div className="mt-6">
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={[
                          {
                            month: monthlyComparisonCurrentVsLast.lastMonth.month,
                            revenue: monthlyComparisonCurrentVsLast.lastMonth.revenue,
                            orders: monthlyComparisonCurrentVsLast.lastMonth.orders,
                          },
                          {
                            month: monthlyComparisonCurrentVsLast.thisMonth.month,
                            revenue: monthlyComparisonCurrentVsLast.thisMonth.revenue,
                            orders: monthlyComparisonCurrentVsLast.thisMonth.orders,
                          }
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="month" 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12}
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
                        <Bar 
                          dataKey="revenue" 
                          fill="hsl(var(--chart-1))" 
                          name="ရောင်းအား"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar 
                          dataKey="orders" 
                          fill="hsl(var(--chart-2))" 
                          name="မှာယူမှုများ"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

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