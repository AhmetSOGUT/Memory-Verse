import LoginScreen from "./components/LoginScreen";
import StatusScreen from "./components/StatusScreen";
import Workspace from "./components/Workspace";
import { useAuth } from "./hooks/useAuth";

/** Yalnızca oturum durumuna göre hangi ekranın gösterileceğine karar verir. */
function App() {
  const { state, login, logout, retry } = useAuth();

  switch (state.status) {
    case "loading":
      return <StatusScreen title="Yükleniyor…" />;
    case "unreachable":
      return (
        <StatusScreen
          title="Sunucuya ulaşılamıyor"
          message={state.message}
          actionLabel="Tekrar dene"
          onAction={retry}
        />
      );
    case "anonymous":
      return <LoginScreen onLogin={login} />;
    case "authenticated":
      return <Workspace user={state.user} onLogout={logout} />;
  }
}

export default App;