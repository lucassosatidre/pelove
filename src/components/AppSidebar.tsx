import { Map, LogOut, Sun, Moon, Database, BarChart3, Sparkles, FileSpreadsheet, FileText, Settings, Heart } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useUserRole } from "@/hooks/useUserRole";
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

type Item = { title: string; url: string; icon: any; adminOnly?: boolean };
const menuItems: Item[] = [
  { title: "Mapa Estratégico", url: "/mapa", icon: Map },
  { title: "Dashboards", url: "/dashboards", icon: BarChart3, adminOnly: true },
  { title: "DRE", url: "/dre", icon: FileSpreadsheet, adminOnly: true },
  { title: "DRE v2", url: "/dre-v2", icon: FileText, adminOnly: true },
  { title: "Advisor", url: "/advisor", icon: Sparkles },
  { title: "Integração Saipos", url: "/configuracoes/saipos", icon: Database, adminOnly: true },
  { title: "Configurações", url: "/configuracoes", icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const { dark, toggle } = useTheme();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const visibleItems = menuItems.filter((i) => !i.adminOnly || isAdmin);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Header: logo oficial clicável */}
        {!collapsed ? (
          <div className="relative flex h-28 items-center justify-center border-b border-sidebar-border px-3 py-3">
            <NavLink
              to="/mapa"
              className="flex h-full w-full items-center justify-center"
              aria-label="PE Love — Ir para Mapa Estratégico"
            >
              <img
                src={logoPeLove}
                alt="PE Love — Planejamento Estratégico"
                className="block h-20 w-40 object-contain"
              />
            </NavLink>
            <button
              onClick={toggle}
              className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors"
              title={dark ? "Modo claro" : "Modo escuro"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 border-b border-sidebar-border px-2 pb-3 pt-3">
            <NavLink to="/mapa" aria-label="PE Love" className="flex items-center justify-center">
              <img
                src={logoPeLove}
                alt="PE Love"
                className="block h-9 w-9 object-contain"
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
              {visibleItems.map((item) => (
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
