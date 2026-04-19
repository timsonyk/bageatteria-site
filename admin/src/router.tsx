import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { CategoriesPage } from './pages/catalog/CategoriesPage'
import { ProductsPage } from './pages/catalog/ProductsPage'
import { ModificationsPage } from './pages/catalog/ModificationsPage'
import { RecommendationsPage } from './pages/catalog/RecommendationsPage'
import { HighlightsPage } from './pages/catalog/HighlightsPage'
import { CustomersPage } from './pages/customers/CustomersPage'
import { OrdersPage } from './pages/orders/OrdersPage'
import { OrderDetailPage } from './pages/orders/OrderDetailPage'
import { BannersPage } from './pages/marketing/BannersPage'
import { PromoCodesPage } from './pages/marketing/PromoCodesPage'
import { NotificationsPage } from './pages/notifications/NotificationsPage'
import { PickupsPage } from './pages/delivery/PickupsPage'
import { ZonesPage } from './pages/delivery/ZonesPage'
import { TextsPage } from './pages/settings/TextsPage'
import { LoyaltyPage } from './pages/settings/LoyaltyPage'
import { StoreLocationsPage } from './pages/settings/StoreLocationsPage'
import {
  StockDashboardPage,
  DeliveriesPage,
  DeliveryDetailPage,
  InventoriesPage,
  InventoryDetailPage,
  StockItemsPage,
  MovementsPage,
} from './pages/stock'
import { Protected } from './components/Protected'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <Protected>
        <AdminLayout />
      </Protected>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'catalog/categories', element: <CategoriesPage /> },
      { path: 'catalog/products', element: <ProductsPage /> },
      { path: 'catalog/modifications', element: <ModificationsPage /> },
      { path: 'catalog/recommendations', element: <RecommendationsPage /> },
      { path: 'catalog/highlights', element: <HighlightsPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      { path: 'marketing/banners', element: <BannersPage /> },
      { path: 'marketing/promo-codes', element: <PromoCodesPage /> },
      { path: 'marketing/notifications', element: <NotificationsPage /> },
      { path: 'delivery/pickups', element: <PickupsPage /> },
      { path: 'delivery/zones', element: <ZonesPage /> },
      { path: 'stock', element: <StockDashboardPage /> },
      { path: 'stock/deliveries', element: <DeliveriesPage /> },
      { path: 'stock/deliveries/:id', element: <DeliveryDetailPage /> },
      { path: 'stock/inventories', element: <InventoriesPage /> },
      { path: 'stock/inventories/:id', element: <InventoryDetailPage /> },
      { path: 'stock/items', element: <StockItemsPage /> },
      { path: 'stock/movements', element: <MovementsPage /> },
      { path: 'settings/texts', element: <TextsPage /> },
      { path: 'settings/loyalty', element: <LoyaltyPage /> },
      { path: 'settings/store-locations', element: <StoreLocationsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

