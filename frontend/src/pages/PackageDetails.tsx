import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Page from "@/components/user-defined/page";
import { ChevronLeft } from "lucide-react";
import { usePackageManager } from "@/hooks/use-packagemanager";
import { useUserManager } from "@/hooks/use-usermanager";
import Base64Unzipper from "@/components/user-defined/base64-decoder";
import API from "@/api/api";
import { Skeleton } from "@/components/ui/skeleton";

interface PackageDetailsProps {
    isResult?: boolean;
}

function PackageDetails({ isResult = false }: PackageDetailsProps) {
    const { packages } = usePackageManager();
    const { id } = useParams<{ id: string }>();
    const [packageContent, setPackageContent] = useState<string | null>(null);
    const [isContent, setIsContent] = useState<boolean>(true);
    const [rating, setRating] = useState<number | string | null>(null);
    const [cost, setCost] = useState<number | null>(null);
    const { user } = useUserManager();

    const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");

    const headers = {
        "Content-Type": "application/json",
        "X-Authorization": user?.token
    }

    const getPackageMeta = async () => {
        const response = await api.get(`/package/${id}`, headers);
        if (response.data.Content !== '') {
            setPackageContent(response.data.Content);
            setIsContent(true);
        } else {
            setPackageContent(response.data.URL);
        }
    };

    const getRate = async () => {
        const response = await api.get(`/package/${id}/rate`, headers);
        if (isContent) {
            setRating(response[id!].Rating);
        } else {
            setRating("Not available");
        }
    };

    const getCost = async () => {
        const response = await api.get(`/package/${id}/cost`, headers);
        setCost(response[id!].totalCost);
    };

    useEffect(() => {
        if (id) {
            getPackageMeta();
            getRate();
            getCost();
        }
    }, []);

    const spacer = <div className="w-3 h-1"></div>;
    const packageFromId = packages.get(id ?? "");
    if (!packageFromId) {
        return <div>Package not found</div>;
    }

    const handleBack = () => {
        window.history.back();
    };

    return (
        <div>
            <Page>
                {isResult && <Button variant="link" onClick={handleBack}>{<ChevronLeft />}{spacer}Back to results</Button>}
                <Card>
                    <CardHeader>
                        <CardTitle><h1>{packageFromId.name}</h1> </CardTitle>
                        <h2>Package ID: {id}</h2>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-8">
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="min-h-[200px]">
                                            {isContent ?
                                                <Base64Unzipper base64Zip={packageContent ?? ""} /> :
                                                <Button variant={"link"} onClick={() => window.open(packageContent ?? "", "_blank")}>
                                                    View repository
                                                </Button>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="col-span-4">
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="relative min-h-[200px] flex flex-col">
                                            <div className="flex-1 w-full">
                                                <p className="text-sm text-gray-400">Package rating</p>
                                                {rating !== null ? rating : <Skeleton className="w-[100px] h-7 " />}
                                            </div>
                                            <div className="flex-1 w-full">
                                                <p className="text-sm text-gray-400">Package cost</p>
                                                {cost !== null ? cost : <Skeleton className="w-[100px] h-7 " />}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </Page>
        </div>
    );
}

export default PackageDetails;