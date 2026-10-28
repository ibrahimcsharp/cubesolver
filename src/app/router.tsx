import { createBrowserRouter, type RouteObject } from 'react-router'
import { ErrorPage } from '@/app/ErrorPage'
import { Layout } from '@/app/Layout'
import { HomePage } from '@/pages/HomePage'
import { ManualPage } from '@/pages/ManualPage'
import { NotationPage } from '@/pages/NotationPage'
import { CheckPage, NotFoundPage, ScanPage, UploadPage } from '@/pages/placeholders'
import { SolutionPage } from '@/pages/SolutionPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/scan', element: <ScanPage /> },
      { path: '/upload', element: <UploadPage /> },
      { path: '/manual', element: <ManualPage /> },
      { path: '/check', element: <CheckPage /> },
      { path: '/solution', element: <SolutionPage /> },
      { path: '/notation', element: <NotationPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
