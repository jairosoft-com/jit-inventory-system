import { useDashboardStore } from '../store/dashboardStore';
import {
  AreaChart,
  Area,
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
  Cell,
} from 'recharts';
import './AnalyticsSection.css';

// Custom tooltip styling for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="recharts-custom-tooltip">
        <p className="recharts-tooltip-label">{label}</p>
        <ul className="recharts-tooltip-item-list">
          {payload.map((item: any, index: number) => (
            <li key={index} className="recharts-tooltip-item">
              <span
                className="recharts-tooltip-marker"
                style={{
                  backgroundColor: item.color || item.fill,
                }}
              />
              <span className="recharts-tooltip-name">{item.name}:</span>
              <strong className="recharts-tooltip-value">{item.value}</strong>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
};

export default function AnalyticsSection() {
  const { analytics, isLoading } = useDashboardStore();

  const conditionColors: Record<string, string> = {
    NEW: '#16a34a',       // Green
    GOOD: '#2563eb',      // Blue
    FAIR: '#f59e0b',      // Amber
    POOR: '#d97706',      // Dark Orange
    DAMAGED: '#dc2626',   // Red
  };

  const renderSkeleton = (title: string) => (
    <div className="dash-chart-card">
      <div className="dash-chart-header">
        <h3 className="dash-chart-title">{title}</h3>
      </div>
      <div className="dash-chart-body">
        <div className="dash-skeleton-chart animate-pulse">
          <div className="dash-skeleton-chart-body">
            <div className="dash-skeleton-chart-lines">
              <div className="dash-skeleton-chart-line" />
              <div className="dash-skeleton-chart-line" />
              <div className="dash-skeleton-chart-line" />
              <div className="dash-skeleton-chart-line" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading && !analytics) {
    return (
      <div className="dash-analytics-section animate-fade-in">
        <h2 className="dash-analytics-title">Operations Analytics</h2>
        <div className="dash-analytics-grid">
          <div className="dash-chart-card dash-chart-card--full">
            <div className="dash-chart-header">
              <h3 className="dash-chart-title">Stock Movement Trends (30 Days)</h3>
            </div>
            <div className="dash-chart-body">
              <div className="dash-skeleton-chart animate-pulse">
                <div className="dash-skeleton-chart-body">
                  <div className="dash-skeleton-chart-lines">
                    <div className="dash-skeleton-chart-line" />
                    <div className="dash-skeleton-chart-line" />
                    <div className="dash-skeleton-chart-line" />
                    <div className="dash-skeleton-chart-line" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {renderSkeleton('Borrow Activity (30 Days)')}
          {renderSkeleton('Equipment Conditions')}
        </div>
      </div>
    );
  }

  const stockData = analytics?.stockMovements || [];
  const borrowData = analytics?.borrowActivity || [];
  const conditionData = analytics?.equipmentConditions || [];

  const isStockEmpty = stockData.every(d => d.stockIn === 0 && d.stockOut === 0);
  const isBorrowEmpty = borrowData.every(d => d.total === 0);
  const isConditionEmpty = conditionData.every(d => d.count === 0);

  // Formatting date labels (e.g. "Jun 15")
  const formatDateLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="dash-analytics-section animate-fade-in">
      <h2 className="dash-analytics-title">Operations Analytics</h2>
      <div className="dash-analytics-grid">
        {/* Chart 1: Stock Movements */}
        <div className="dash-chart-card dash-chart-card--full">
          <div className="dash-chart-header">
            <h3 className="dash-chart-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              Stock Movement Trends (30 Days)
            </h3>
          </div>
          <div className="dash-chart-body">
            {isStockEmpty ? (
              <div className="dash-empty-state" style={{ height: '100%', justifyContent: 'center' }}>
                <div className="dash-empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <h4 className="dash-empty-heading">No Stock Movement Recorded</h4>
                <p className="dash-empty-text">Perform stock-in or stock-out operations to see movement charts.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorStockIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="colorStockOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDateLabel} 
                    stroke="#94a3b8" 
                    fontSize={11}
                    dy={10}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area 
                    name="Stock In (Added)" 
                    type="monotone" 
                    dataKey="stockIn" 
                    stroke="#16a34a" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorStockIn)" 
                  />
                  <Area 
                    name="Stock Out (Released)" 
                    type="monotone" 
                    dataKey="stockOut" 
                    stroke="#dc2626" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorStockOut)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Borrow Activity */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <h3 className="dash-chart-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 2.1l4 4-4 4" />
                <path d="M3 12.2v-2a4 4 0 0 1 4-4h14" />
                <path d="M7 21.9l-4-4 4-4" />
                <path d="M21 11.8v2a4 4 0 0 1-4 4H3" />
              </svg>
              Borrow Activity (30 Days)
            </h3>
          </div>
          <div className="dash-chart-body">
            {isBorrowEmpty ? (
              <div className="dash-empty-state" style={{ height: '100%', justifyContent: 'center' }}>
                <div className="dash-empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <h4 className="dash-empty-heading">No Borrow Records Found</h4>
                <p className="dash-empty-text">Create and process borrow requests to track team borrowing activity.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={borrowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDateLabel} 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    dy={10}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Line 
                    name="Total" 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    name="Approved" 
                    type="monotone" 
                    dataKey="approved" 
                    stroke="#16a34a" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    name="Pending" 
                    type="monotone" 
                    dataKey="pending" 
                    stroke="#d97706" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Equipment Conditions */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <h3 className="dash-chart-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
              Equipment Conditions
            </h3>
          </div>
          <div className="dash-chart-body">
            {isConditionEmpty ? (
              <div className="dash-empty-state" style={{ height: '100%', justifyContent: 'center' }}>
                <div className="dash-empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                  </svg>
                </div>
                <h4 className="dash-empty-heading">No Active Equipment</h4>
                <p className="dash-empty-text">Register trackable equipment to view physical condition breakdown.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={conditionData} 
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <YAxis 
                    type="category" 
                    dataKey="condition" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]} barSize={16}>
                    {conditionData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={conditionColors[entry.condition] || '#94a3b8'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
