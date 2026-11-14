import type {Professional,Service,Tenant} from '@/lib/api';

export type PublicTenant = Tenant & {
  services:Service[];
  professionals:Professional[];
  paymentAvailable:boolean;
  bookingEnabled:boolean;
};
