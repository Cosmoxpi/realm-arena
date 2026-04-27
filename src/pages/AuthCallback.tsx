import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Auth error:", error.message);
        navigate("/auth");
        return;
      }

      if (data.session) {
        // ✅ Logged in successfully
        navigate("/dashboard");
      } else {
        // ❌ No session
        navigate("/auth");
      }
    };

    handleAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin w-6 h-6" />
      <span className="ml-2">Signing you in...</span>
    </div>
  );
};

export default AuthCallback;