import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { useUserManager } from "@/hooks/use-usermanager";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import Cookies from "js-cookie";

function LogOutButton() {
    const { setUser, user } = useUserManager();

    const handleLogOut = () => {
        setUser(null);
        Cookies.remove("user");
    }

    const spacer = <div className="w-2 h-1"></div>;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full mobile:h-16">
                    Hello, {user?.username}
                    {spacer}
                    {<><div className="mobile:hidden"><ChevronDown size="1rem" /></div>
                        <div><ChevronsUpDown className="md:hidden" size="1rem" /></div></>}
                </Button>

            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={handleLogOut}>
                        Log Out
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default LogOutButton;