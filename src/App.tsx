import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleRoute } from "@/components/auth/RoleRoute";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { CustomersPage } from "@/pages/CustomersPage";
import { CustomerFormPage } from "@/pages/CustomerFormPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { InventoryFormPage } from "@/pages/InventoryFormPage";
import { MenuPage } from "@/pages/MenuPage";
import { BillingPage } from "@/pages/BillingPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { CommandCenterPage } from "@/pages/CommandCenterPage";
import { KitchenBoardPage } from "@/pages/KitchenBoardPage";
import { CourierPage } from "@/pages/CourierPage";
import { PaymentsPage } from "@/pages/PaymentsPage";
import { PaymentsDetailPage } from "@/pages/PaymentsDetailPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { SubscriptionFormPage } from "@/pages/SubscriptionFormPage";
import { SubscriptionEditPage } from "@/pages/SubscriptionEditPage";

function Shell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/home"
        element={
          <RoleRoute allow={["admin", "courier"]}>
            <Shell>
              <HomePage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/customers"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <CustomersPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/customers/new"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <CustomerFormPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/customers/:id/edit"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <CustomerFormPage />
            </Shell>
          </RoleRoute>
        }
      />

      {/* Payments module */}
      <Route
        path="/payments"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <PaymentsPage />
            </Shell>
          </RoleRoute>
        }
      />
      <Route
        path="/payments/:customerId"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <PaymentsDetailPage />
            </Shell>
          </RoleRoute>
        }
      />

      {/* Subscriptions module */}
      <Route
        path="/subscriptions"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <SubscriptionsPage />
            </Shell>
          </RoleRoute>
        }
      />
      <Route
        path="/subscriptions/new"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <SubscriptionFormPage />
            </Shell>
          </RoleRoute>
        }
      />
      <Route
        path="/subscriptions/:customerId/edit"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <SubscriptionEditPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <InventoryPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/inventory/new"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <InventoryFormPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/inventory/:id/edit"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <InventoryFormPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/menu"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <MenuPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/billing"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <BillingPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/history"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <HistoryPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/command-center"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <CommandCenterPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/kitchen-board"
        element={
          <RoleRoute allow={["admin"]}>
            <Shell>
              <KitchenBoardPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route
        path="/courier"
        element={
          <RoleRoute allow={["courier", "admin"]}>
            <Shell>
              <CourierPage />
            </Shell>
          </RoleRoute>
        }
      />

      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
