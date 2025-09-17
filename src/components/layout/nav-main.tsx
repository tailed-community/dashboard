import { ChevronRight, type LucideIcon } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import { AspectRatio } from "../ui/aspect-ratio";

function Logo() {
  return (
    <Link className="flex items-center justify-center" to="/">
      <div className="flex items-center h-16 w-40">
        <AspectRatio ratio={3042 / 968}>
          <img
            src="/tailed-logo-fixed-shadow.svg"
            alt="Logo"
            className="object-contain h-full w-full"
          />
        </AspectRatio>
      </div>
    </Link>
  );
}

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <Logo />
        <span className="text-lg tracking-tight">Tail&apos;ed Community</span>
      </div>
      <SidebarGroup>
        <SidebarGroupLabel>{m.platform()}</SidebarGroupLabel>
        <SidebarMenu>
          {items.map((item) => (
            <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRight />
                        <span className="sr-only">{m.toggle()}</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <Link to={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}
