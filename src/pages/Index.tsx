import { useAuth, AuthProvider } from '@/contexts/AuthContext';
import { Login } from '@/components/Login';
import { Dashboard } from '@/components/Dashboard';

function AppContent() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return <Login />;
  }

  return <Dashboard />;
}

const Index = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default Index;
