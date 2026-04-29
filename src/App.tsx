import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import Friends from "./pages/Friends";
import GameRoom from "./pages/GameRoom";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <AuthProvider>
        <Routes>

          {/* Public */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
          <Route path="/play/:gameType/:roomId" element={<ProtectedRoute><GameRoom /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </AuthProvider>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;