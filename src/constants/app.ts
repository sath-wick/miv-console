import type { Role } from "@/types/models";

export interface NavItem {
  path: string;
  label: string;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/home", label: "Home", roles: ["admin", "courier"] },
  { path: "/menu", label: "Menu", roles: ["admin"] },
  { path: "/billing", label: "Billing", roles: ["admin"] },
  { path: "/payments", label: "Payments", roles: ["admin"] },
  { path: "/subscriptions", label: "Subscriptions", roles: ["admin"] },
  { path: "/customers", label: "Customers", roles: ["admin"] },
  { path: "/history", label: "History", roles: ["admin"] },
  { path: "/command-center", label: "Command Center", roles: ["admin"] },
  { path: "/kitchen-board", label: "Kitchen Dashboard", roles: ["admin"] },
  { path: "/courier", label: "Courier", roles: ["courier", "admin"] },
  { path: "/inventory", label: "Inventory", roles: ["admin"] }
];
