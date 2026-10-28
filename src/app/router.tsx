import { createBrowserRouter, type RouteObject } from 'react-router'
import { Layout } from '@/app/Layout'
import { HomePage } from '@/pages/HomePage'
import {
  CheckPage,
  ManualPage,
  NotationPage,
  NotFoundPage,
  ScanPage,
  SolutionPage,
  UploadPage,
} from '@/pages/placeholders'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
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
