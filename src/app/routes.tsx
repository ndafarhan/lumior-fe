import { createBrowserRouter, type RouteObject } from 'react-router'

import { PublicOnlyRoute, RequireHousehold, RequireSession, RootRoute } from '@/app/guards'
import { AppLayout } from '@/app/layout/AppLayout'
import { RouteErrorPage } from '@/app/RouteErrorPage'
import type { RouteHandle } from '@/app/useDocumentTitle'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { InvitePage } from '@/features/households/InvitePage'
import { AccountPage } from '@/routes/account'
import { BudgetsPage } from '@/routes/budgets'
import { CatalogPage } from '@/routes/catalog'
import { DashboardPage } from '@/routes/dashboard'
import { ExpenseCategoriesPage } from '@/routes/expense-categories'
import { ExpensesPage } from '@/routes/expenses'
import { HouseholdPage } from '@/routes/household'
import { NotFoundPage } from '@/routes/not-found'
import { OptimizePage } from '@/routes/optimize'
import { ShoppingListsPage } from '@/routes/shopping-lists'
import { WelcomePage } from '@/routes/welcome'

const page = (title: string): RouteHandle => ({ title })

/** Pages inside the app layout: they need a session and an active household. */
const layoutPages: RouteObject[] = [
  { index: true, element: <DashboardPage />, handle: page('Dashboard') },
  { path: 'budgets', element: <BudgetsPage />, handle: page('Budgets') },
  { path: 'expenses', element: <ExpensesPage />, handle: page('Expenses') },
  {
    path: 'expenses/categories',
    element: <ExpenseCategoriesPage />,
    handle: page('Expense categories'),
  },
  { path: 'catalog', element: <CatalogPage />, handle: page('Catalog') },
  { path: 'shopping-lists', element: <ShoppingListsPage />, handle: page('Shopping Lists') },
  { path: 'optimize', element: <OptimizePage />, handle: page('Optimize') },
  { path: 'household', element: <HouseholdPage />, handle: page('Household settings') },
  { path: 'account', element: <AccountPage />, handle: page('Account') },
  { path: '*', element: <NotFoundPage />, handle: page('Page not found') },
]

export const appRoutes: RouteObject[] = [
  {
    element: <RootRoute />,
    // Last resort if a guard or the layout itself fails.
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: 'login', element: <LoginPage />, handle: page('Sign in') },
          { path: 'register', element: <RegisterPage />, handle: page('Create account') },
        ],
      },
      {
        element: <RequireSession />,
        children: [
          { path: 'welcome', element: <WelcomePage />, handle: page('Welcome') },
          { path: 'invite/:code', element: <InvitePage />, handle: page('Invitation') },
          {
            element: <RequireHousehold />,
            children: [
              {
                element: <AppLayout />,
                children: [
                  // Page errors render inside the layout, so the sidebar keeps working.
                  { errorElement: <RouteErrorPage />, children: layoutPages },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(appRoutes)
}
