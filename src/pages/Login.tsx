import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { User, Lock } from "lucide-react";
import logoPeLove from "@/assets/logo-pelove.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/mapa");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <img
          src={logoPeLove}
          alt="PE Love - Planejamento Estratégico"
          className="w-[300px] md:w-[420px] mb-8"
          style={{ mixBlendMode: "lighten" }}
        />

        {/* Welcome text */}
        <h1 className="text-2xl font-bold text-white mb-1">Bem-vindo</h1>
        <p className="mb-8" style={{ color: "#999" }}>Entre com suas credenciais</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="space-y-2">
            <label className="text-white text-sm font-medium flex items-center gap-2">
              <User size={16} />
              Usuário
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 rounded-xl px-4 text-white outline-none transition-colors"
              style={{
                backgroundColor: "#2D2D2D",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "#444",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#F97316")}
              onBlur={(e) => (e.target.style.borderColor = "#444")}
            />
          </div>

          <div className="space-y-2">
            <label className="text-white text-sm font-medium flex items-center gap-2">
              <Lock size={16} />
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 rounded-xl px-4 text-white outline-none transition-colors"
              style={{
                backgroundColor: "#2D2D2D",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "#444",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#F97316")}
              onBlur={(e) => (e.target.style.borderColor = "#444")}
            />
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-500"
              />
              <span className="text-sm" style={{ color: "#999" }}>Lembrar minha senha</span>
            </label>
            <button type="button" className="text-sm font-medium hover:underline" style={{ color: "#F97316" }}>
              Esqueceu a senha?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#F97316" }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
