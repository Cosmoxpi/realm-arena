import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // ✅ This forces Supabase to read URL hash (access_token)
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth error:", error.message);
          navigate("/auth");
          return;
        }

        // 🔥 IMPORTANT: manually set session if needed
        if (!data.session && window.location.hash.includes("access_token")) {
          console.log("Processing token from URL...");

          await supabase.auth.setSession({
            access_token: new URLSearchParams(window.location.hash.substring(1)).get("access_token")!,
            refresh_token: new URLSearchParams(window.location.hash.substring(1)).get("refresh_token")!,
          });
        }

        const { data: finalSession } = await supabase.auth.getSession();

        if (finalSession.session) {
          console.log("LOGIN SUCCESS");
          navigate("/dashboard");
        } else {
          console.log("NO SESSION");
          navigate("/auth");
        }
      } catch (err) {
        console.error(err);
        navigate("/auth");
      }
    };

    handleAuth();
  }, [navigate]);

  return <p style={{ textAlign: "center" }}>Signing you in...</p>;
};

export default AuthCallback;