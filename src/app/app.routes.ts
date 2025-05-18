import { Routes } from '@angular/router';
import { LoginComponent }   from './pages/login/login.component';
import { CustomerOrdersComponent }   from './pages/customer-orders/customer-orders.component';
import { CourierDashboardComponent } from './pages/courier-dashboard/courier-dashboard.component';
import { AuthGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'customer-orders',   component: CustomerOrdersComponent, canActivate: [AuthGuard] },
  { path: 'courier-dashboard', component: CourierDashboardComponent, canActivate: [AuthGuard] },
  { path: '',                   redirectTo: 'login', pathMatch: 'full' },
  { path: '**',                 redirectTo: 'login' }
];