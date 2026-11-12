import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth, RequireCapability } from '@/app/guards';
import { LoginPage } from '@/features/auth/LoginPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { SalesPage } from '@/features/sales/SalesPage';
import { OrdersPage } from '@/features/orders/OrdersPage';
import { OrderDetailPage } from '@/features/orders/OrderDetailPage';
import { ProductionPage } from '@/features/production/ProductionPage';
import { FinanceHrPage } from '@/features/finance-hr/FinanceHrPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { AlertsPage } from '@/features/alerts/AlertsPage';
import { AlertDetailPage } from '@/features/alerts/AlertDetailPage';
import { DecisionsPage } from '@/features/decisions/DecisionsPage';
import { DecisionCreatePage } from '@/features/decisions/DecisionCreatePage';
import { DecisionDetailPage } from '@/features/decisions/DecisionDetailPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TaskDetailPage } from '@/features/tasks/TaskDetailPage';
import { ForecastPage } from '@/features/forecast/ForecastPage';
import { DataQualityPage } from '@/features/data-quality/DataQualityPage';
import { AuditLogsPage } from '@/features/audit-logs/AuditLogsPage';
import { AuditLogDetailPage } from '@/features/audit-logs/AuditLogDetailPage';
import { UsersPage } from '@/features/users/UsersPage';
import { MetricDetailPage } from '@/features/metrics/MetricDetailPage';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';
import { NotFoundPage } from '@/features/errors/NotFoundPage';
import { ForbiddenPage } from '@/features/errors/ForbiddenPage';
import { ImpactMapPage } from '@/features/impact-map/ImpactMapPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route
          path="/dashboard"
          element={
            <RequireCapability capability="analytics.view">
              <DashboardPage />
            </RequireCapability>
          }
        />
        <Route
          path="/sales"
          element={
            <RequireCapability capability="sales.view">
              <SalesPage />
            </RequireCapability>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireCapability capability="orders.read">
              <OrdersPage />
            </RequireCapability>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequireCapability capability="orders.read">
              <OrderDetailPage />
            </RequireCapability>
          }
        />
        <Route
          path="/production"
          element={
            <RequireCapability capability="production.view">
              <ProductionPage />
            </RequireCapability>
          }
        />
        <Route
          path="/finance-hr"
          element={
            <RequireCapability capability="finance.view">
              <FinanceHrPage />
            </RequireCapability>
          }
        />
        <Route
          path="/analytics"
          element={
            <RequireCapability capability="bi.view">
              <AnalyticsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/impact-map"
          element={
            <RequireCapability capability="impactMap.view">
              <ImpactMapPage />
            </RequireCapability>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireCapability capability="analytics.view">
              <AlertsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/alerts/:id"
          element={
            <RequireCapability capability="analytics.view">
              <AlertDetailPage />
            </RequireCapability>
          }
        />
        <Route
          path="/decisions"
          element={
            <RequireCapability capability="decisions.read">
              <DecisionsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/decisions/new"
          element={
            <RequireCapability capability="decisions.write">
              <DecisionCreatePage />
            </RequireCapability>
          }
        />
        <Route
          path="/decisions/:id"
          element={
            <RequireCapability capability="decisions.read">
              <DecisionDetailPage />
            </RequireCapability>
          }
        />
        <Route
          path="/tasks"
          element={
            <RequireCapability capability="tasks.read">
              <TasksPage />
            </RequireCapability>
          }
        />
        <Route
          path="/tasks/:id"
          element={
            <RequireCapability capability="tasks.read">
              <TaskDetailPage />
            </RequireCapability>
          }
        />
        <Route
          path="/forecast"
          element={
            <RequireCapability capability="forecast.view">
              <ForecastPage />
            </RequireCapability>
          }
        />
        <Route
          path="/data-quality"
          element={
            <RequireCapability capability="dataQuality.view">
              <DataQualityPage />
            </RequireCapability>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <RequireCapability capability="audit.read">
              <AuditLogsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/audit-logs/:id"
          element={
            <RequireCapability capability="audit.read">
              <AuditLogDetailPage />
            </RequireCapability>
          }
        />
        <Route
          path="/users"
          element={
            <RequireCapability capability="users.manage">
              <UsersPage />
            </RequireCapability>
          }
        />
        <Route
          path="/metrics/:code"
          element={
            <RequireCapability capability="analytics.view">
              <MetricDetailPage />
            </RequireCapability>
          }
        />
        <Route
          path="/customers/:id"
          element={
            <RequireCapability capability="sales.view">
              <CustomerDetailPage />
            </RequireCapability>
          }
        />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
