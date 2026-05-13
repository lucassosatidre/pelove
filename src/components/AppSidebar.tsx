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
        {/* Header: logo + branding centralizado */}
        {!collapsed ? (
          <div className="flex flex-col items-center px-4 pt-5 pb-3 relative">
            <button
              onClick={toggle}
              className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors"
              title={dark ? "Modo claro" : "Modo escuro"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <img
              src={logoPeLove}
              alt="PE Love"
              className="w-[120px] object-contain"
              style={{ mixBlendMode: "lighten" }}
            />
            <p className="text-sm font-bold tracking-wide text-sidebar-accent-foreground leading-tight mt-2">PE LOVE</p>
            <p className="text-[10px] text-sidebar-foreground/60">Planejamento Estratégico</p>
          </div>
        ) : (
          <div className="flex flex-col items-center px-2 pt-5 pb-3 gap-2">
            <img
              src={logoPeLove}
              alt="PE Love"
              className="h-8 w-8 object-contain"
              style={{ mixBlendMode: "lighten" }}
            />
            <button
              onClick={toggle}
              className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors"
              title={dark ? "Modo claro" : "Modo escuro"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        )}

        {!collapsed && <div className="mx-3 mb-2 border-b border-sidebar-border" />}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground"
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
