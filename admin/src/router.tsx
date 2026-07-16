import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { LoginPage } from './pages/Login'
import { CategoriesPage } from './pages/catalog/CategoriesPage'
import { ProductsPage } from './pages/catalog/ProductsPage'
import { ModificationsPage } from './pages/catalog/ModificationsPage'
import { RecommendationsPage } from './pages/catalog/RecommendationsPage'
import { HighlightsPage } from './pages/catalog/HighlightsPage'
import { BannersPage } from './pages/marketing/BannersPage'
import { PromoCodesPage } from './pages/marketing/PromoCodesPage'
import { PickupsPage } from './pages/delivery/PickupsPage'
import { ZonesPage } from './pages/delivery/ZonesPage'
import { TextsPage } from './pages/settings/TextsPage'
import { StoreLocationsPage } from './pages/settings/StoreLocationsPage'
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
      { index: true, element: <Navigate to="/catalog/categories" replace /> },
      { path: 'catalog/categories', element: <CategoriesPage /> },
      { path: 'catalog/products', element: <ProductsPage /> },
      { path: 'catalog/modifications', element: <ModificationsPage /> },
      { path: 'catalog/recommendations', element: <RecommendationsPage /> },
      { path: 'catalog/highlights', element: <HighlightsPage /> },
      { path: 'marketing/banners', element: <BannersPage /> },
      { path: 'marketing/promo-codes', element: <PromoCodesPage /> },
      { path: 'delivery/pickups', element: <PickupsPage /> },
      { path: 'delivery/zones', element: <ZonesPage /> },
      { path: 'settings/texts', element: <TextsPage /> },
      { path: 'settings/store-locations', element: <StoreLocationsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
