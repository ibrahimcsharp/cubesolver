import { createBrowserRouter, type RouteObject } from 'react-router'
import { ErrorPage } from '@/app/ErrorPage'
import { Layout } from '@/app/Layout'
import { HomePage } from '@/pages/HomePage'
import { LivePage } from '@/pages/LivePage'
import { ManualPage } from '@/pages/ManualPage'
import { NotationPage } from '@/pages/NotationPage'
import { CheckPage } from '@/pages/CheckPage'
import { NotFoundPage } from '@/pages/placeholders'
import { ScanPage } from '@/pages/ScanPage'
import { UploadPage } from '@/pages/UploadPage'
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
      { path: '/live', element: <LivePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
