import { createBrowserRouter, type RouteObject } from 'react-router'

import { AppLayout } from '@/app/layout/AppLayout'
import { RouteErrorPage } from '@/app/RouteErrorPage'
import type { RouteHandle } from '@/app/useDocumentTitle'
import { BudgetsPage } from '@/routes/budgets'
import { CatalogPage } from '@/routes/catalog'
import { DashboardPage } from '@/routes/dashboard'
import { ExpensesPage } from '@/routes/expenses'
import { NotFoundPage } from '@/routes/not-found'
import { OptimizePage } from '@/routes/optimize'
import { ShoppingListsPage } from '@/routes/shopping-lists'

const page = (title: string): RouteHandle => ({ title })

export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    // Last resort if the layout itself fails.
    errorElement: <RouteErrorPage />,
    children: [
      {
        // Page errors render inside the layout, so the sidebar keeps working.
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <DashboardPage />, handle: page('Dashboard') },
          { path: 'budgets', element: <BudgetsPage />, handle: page('Budgets') },
          { path: 'expenses', element: <ExpensesPage />, handle: page('Expenses') },
          { path: 'catalog', element: <CatalogPage />, handle: page('Catalog') },
          {
            path: 'shopping-lists',
            element: <ShoppingListsPage />,
            handle: page('Shopping Lists'),
          },
          { path: 'optimize', element: <OptimizePage />, handle: page('Optimize') },
          { path: '*', element: <NotFoundPage />, handle: page('Page not found') },
        ],
      },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(appRoutes)
}
