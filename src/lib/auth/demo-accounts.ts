import type { Role } from '@/types/api';

export interface DemoAccount {
  role: Role;
  email: string;
  password: string;
}

// Intentionally public credentials for synthetic demo accounts.
// The owner explicitly approved publishing these five demo passwords for autofill.
// Login still uses the ordinary Backend /auth/login endpoint.
const backendAccounts: DemoAccount[] = [
  {
    "role": "director",
    "email": "director@fotoprint.demo",
    "password": "mnAAXXJzSJFeZYc0lATe4MeZrr9KcIIU"
  },
  {
    "role": "manager",
    "email": "manager@fotoprint.demo",
    "password": "x_D4fQV9RTfe1VkFcOhkZtD1cYDIlTs2"
  },
  {
    "role": "analyst",
    "email": "analyst@fotoprint.demo",
    "password": "eEhfIQ_byNAJhl-O2GbwCtgq1iAMVudD"
  },
  {
    "role": "employee",
    "email": "employee@fotoprint.demo",
    "password": "s0zcN5lhFl4ys0bfX7i0gczfSPRMTM7N"
  },
  {
    "role": "admin",
    "email": "admin@fotoprint.demo",
    "password": "i-bthSJfAu_taa3_n7Ue-g9PjoU7jaD5"
  }
];

export const MOCK_DEMO_PASSWORD = 'Demo12345678';

export function demoAccounts(useMocks: boolean): DemoAccount[] {
  return useMocks
    ? backendAccounts.map(({ role }) => ({ role, email: `${role}@photoprint.by`, password: MOCK_DEMO_PASSWORD }))
    : backendAccounts;
}
