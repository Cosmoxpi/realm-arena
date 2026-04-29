import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // ✅ This reads token from URL hash automatically
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth error:", error.message);
          navigate("/auth");
          return;
        }

        if (data.session) {
          console.log("User:", data.session.user);
          navigate("/dashboard");
        } else {
          navigate("/auth");
        }
      } catch (err) {
        console.error(err);
        navigate("/auth");
      }
    };

    handleAuth();
  }, [navigate]);

  return <p>Signing you in...</p>;
};

export default AuthCallback;