import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Leads from './pages/Leads';
import TGLeads from './pages/TGLeads';
import EmailBulk from './pages/EmailBulk';
import Sms from './pages/Sms';
import Calls from './pages/Calls';
import Support from './pages/Support';
import Marketing from './pages/Marketing';
import Companies from './pages/Companies';
import Projects from './pages/Projects';
import ProjectManagement from './pages/ProjectManagement';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Users from './pages/Users';
import Settings from './pages/Settings';
import ProjectIframePage from './pages/ProjectIframePage';
import DoctorProject from './pages/DoctorProject';
import TGCalabriaProject from './pages/TGCalabriaProject';
import TGCalabriaTry from './pages/TGCalabriaTry';
import Subscribe from './pages/Subscribe';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import SubscriptionCancel from './pages/SubscriptionCancel';
import Layout from './components/layout/Layout';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

import Register from './pages/Register';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/subscription/success',
    element: <SubscriptionSuccess />,
  },
  {
    path: '/subscription/cancel',
    element: <SubscriptionCancel />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'sales',
        element: <Sales />,
      },
      {
        path: 'leads',
        element: <Leads />,
      },
      {
        path: 'tg-leads',
        element: <TGLeads />,
      },
      {
        path: 'emails',
        element: <EmailBulk />,
      },
      {
        path: 'sms',
        element: <Sms />,
      },
      {
        path: 'calls',
        element: <Calls />,
      },
      {
        path: 'support',
        element: <Support />,
      },
      {
        path: 'marketing',
        element: <Marketing />,
      },
      {
        path: 'customers',
        element: <Customers />,
      },
      {
        path: 'customers/:id',
        element: <CustomerDetail />,
      },
      {
        path: 'projects',
        element: <Projects />,
      },
      {
        path: 'projects/:projectId/iframe',
        element: <ProjectIframePage />,
      },
      {
        path: 'projects/:projectId/doctor',
        element: <DoctorProject />,
      },
      {
        path: 'projects/:projectId/tg-calabria',
        element: <TGCalabriaProject />,
      },
      {
        path: 'projects/:projectId/tg-calabria/try',
        element: <TGCalabriaTry />,
      },
      {
        path: 'project-management',
        element: <ProjectManagement />,
      },
      {
        path: 'companies',
        element: <Companies />,
      },
      {
        path: 'users',
        element: <Users />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'subscribe',
        element: <Subscribe />,
      },
    ],
  },
]);
