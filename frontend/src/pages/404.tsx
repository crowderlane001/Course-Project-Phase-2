import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Frown } from "lucide-react";
import Page from "@/components/user-defined/page";

function NotFound() {
    const nav = useNavigate();

    const handleHomeClick = () => {
        nav("/");
    }

    return (
        <Page>
            <div className="h-full w-full flex flex-col gap-5">
                <div className="flex flex-row gap-5">
                    <h1>Woah! Looks like you got lost.</h1>
                    <Frown size="3rem" />
                </div>
                <h3>Error code: 404, Page Not Found</h3>
                <div className="w-[50%] max-w-[300px] min-w-[100px]">
                    <Button variant="outline" onClick={handleHomeClick}>Let's get you back home</Button>
                </div>
            </div>
        </Page>
    );
}

export default NotFound;