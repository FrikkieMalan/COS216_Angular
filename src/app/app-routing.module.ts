import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CustomerOrdersComponent }   from './pages/customer-orders/customer-orders.component';
import { CourierDashboardComponent } from './pages/courier-dashboard/courier-dashboard.component';

const routes: Routes = [
  { path: 'customer-orders',   component: CustomerOrdersComponent },
  { path: 'courier-dashboard', component: CourierDashboardComponent },
  { path: '',                   redirectTo: '/customer-orders', pathMatch: 'full' },
  { path: '**',                 redirectTo: '/customer-orders' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
