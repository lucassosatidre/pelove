import { Map, LogOut, Sun, Moon, Database, BarChart3, Sparkles, FileSpreadsheet, FileText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import logoPeLove from "@/assets/logo-pelove.png";

const menuItems = [
  { title: "Mapa Estratégico", url: "/mapa", icon: Map },
  { title: "Dashboards", url: "/dashboards", icon: BarChart3 },
  { title: "DRE", url: "/dre", icon: FileSpreadsheet },
  { title: "DRE v2", url: "/dre-v2", icon: FileText },
  { title: "Advisor", url: "/advisor", icon: Sparkles },
  { title: "Integração Saipos", url: "/configuracoes/saipos", icon: Database },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Header: logo oficial clicável */}
        {!collapsed ? (
          <div className="flex items-center justify-center px-3 h-14 relative border-b border-sidebar-border">
            <NavLink to="/mapa" className="flex items-center justify-center h-full" aria-label="PE Love — Ir para Mapa Estratégico">
              <img
                src={logoPeLove}
                alt="PE Love — Planejamento Estratégico"
                className="h-10 w-auto object-contain"
                style={{ mixBlendMode: "lighten" }}
              />
            </NavLink>
            <button
              onClick={toggle}
              className="absolute top-1/2 -translate-y-1/2 right-2 h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors"
              title={dark ? "Modo claro" : "Modo escuro"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center px-2 pt-3 pb-3 gap-2 border-b border-sidebar-border">
            <NavLink to="/mapa" aria-label="PE Love" className="flex items-center justify-center">
              <img
                src={logoPeLove}
                alt="PE Love"
                className="h-8 w-8 object-contain"
                style={{ mixBlendMode: "lighten" }}
              />
            </NavLink>
            <button
              onClick={toggle}
              className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors"
              title={dark ? "Modo claro" : "Modo escuro"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="!text-sidebar-foreground hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground"
                      activeClassName="!bg-primary !text-primary-foreground font-medium hover:!bg-primary hover:!text-primary-foreground"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && profile && (
          <p className="text-xs text-sidebar-foreground truncate mb-2">{profile.name}</p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-sidebar-foreground hover:text-sidebar-primary transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
