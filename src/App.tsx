import { AppProvider } from "./lib/store";
import { RouterProvider, useRoute } from "./lib/router";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { CrmPage } from "./pages/CrmPage";
import { OmnichannelPage } from "./pages/OmnichannelPage";
import { CallCenterPage } from "./pages/CallCenterPage";
import { CallbotPage } from "./pages/CallbotPage";
import { TelesalesPage } from "./pages/TelesalesPage";
import { MessagingPage } from "./pages/MessagingPage";
import { UleadUflowPage } from "./pages/UleadUflowPage";
import { LandingPage } from "./pages/LandingPage";

function ProductApp() {
  const route = useRoute();

  const page = (() => {
    switch (route.base) {
      case "crm":
        return <CrmPage />;
      case "da-kenh":
        return <OmnichannelPage />;
      case "tong-dai":
        return <CallCenterPage />;
      case "callbot":
        return <CallbotPage />;
      case "telesales":
        return <TelesalesPage />;
      case "nhan-tin":
        return <MessagingPage />;
      case "ulead-uflow":
        return <UleadUflowPage />;
      default:
        return <DashboardPage />;
    }
  })();

  return <AppShell>{page}</AppShell>;
}

function Routes() {
  const route = useRoute();
  return route.inApp ? <ProductApp /> : <LandingPage />;
}

function App() {
  return (
    <AppProvider>
      <RouterProvider>
        <Routes />
      </RouterProvider>
    </AppProvider>
  );
}

export default App;
