import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // ✅ IMPORTANT: this parses hash from URL
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);

        if (error) {
          console.error("Auth error:", error.message);
          navigate("/auth");
          return;
        }

        if (data?.session) {
          console.log("Login success:", data.session.user);
          navigate("/dashboard");
        } else {
          navigate("/auth");
        }
      } catch (err) {
        console.error("Unexpected error:", err);
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