"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Wind } from "lucide-react";
import { NAV } from "@/components/layout/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wind className="size-4" />
          </span>
          <span className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Applied Data Science</span>
            <span className="text-[11px] text-muted-foreground">Capital Bikeshare · 6 units</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.name}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.name}</span>
                          {item.module && (
                            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground group-data-[collapsible=icon]:hidden">
                              M{item.module}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="px-3 py-3 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-1.5">
          <Activity className="size-3" />
          UCI Bike Sharing (id 275) · 2011–2012
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
