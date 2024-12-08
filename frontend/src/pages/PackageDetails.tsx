// Page for displaying package details

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Page from "@/components/user-defined/page";
import { ChevronLeft } from "lucide-react";
import { useUserManager } from "@/hooks/use-usermanager";
import Base64Unzipper from "@/components/user-defined/base64-decoder";
import API from "@/api/api";
import { Skeleton } from "@/components/ui/skeleton";
import Package from "@/models/package";
import { toast } from "@/hooks/use-toast";
import Spinner from "@/components/user-defined/spinner";
import React from "react";

interface PackageDetailsProps {
    isResult?: boolean;
}

function PackageDetails({ isResult = false }: PackageDetailsProps) {
    const [packageState, setPackage] = useState<Package | null>(null);
    const [loading, setLoading] = useState(true); // Add loading state
    const [isError, setIsError] = useState(false);
    const { id } = useParams<{ id: string }>();
    const [packageContent, setPackageContent] = useState<string | null>(null);
    const [rating, setRating] = useState<Map<string, number> | string | null>(null);
    const [cost, setCost] = useState<number | string | null>(null);
    const { user } = useUserManager();

    const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");

    const headers = {
        "Content-Type": "application/json",
        "X-Authorization": user?.token
    }


    const getPackageMeta = async () => {
        try {
            const response = await api.get(`/package/${id}`, headers);
            if (response.data.Content !== '') {
                setPackageContent(response.data.Content);
            } else {
                setPackageContent(response.data.URL);
            }
            const pkg = new Package(response.metadata.ID, response.metadata.Name, response.metadata.Version);

            setPackage(pkg);
        } catch (error) {
            toast({ title: "Error", description: "Package not found" });
            setIsError(true);
        }
    };

    if (isError) {
        return <h1>Package not found.</h1>
    }

    const getRate = async () => {
        try {
            const response = await api.get(`/package/${id}/rate`, headers);
            const ratingMap = new Map<string, number>();
            Object.entries(response).forEach(([key, value]) => {

                ratingMap.set(key, value as number);
            });
            setRating(ratingMap);
        } catch (error) {
            setRating("Not available");
        }
    };

    const getCost = async () => {
        try {
            const response = await api.get(`/package/${id}/cost`, headers);
            setCost(response[id!].totalCost);
        } catch (error) {
            setCost("Not available");
        }

    };

    useEffect(() => {
        if (id) {
            getPackageMeta();
            getRate();
            getCost();
            setLoading(false);
        }
    }, []);

    // useEffect(() => { }, [loading]);




    const spacer = <div className="w-3 h-1"></div>;

    const handleBack = () => {
        window.history.back();
    };

    return (
        <div>
            <Page>
                {isResult && <Button variant="link" onClick={handleBack}>{<ChevronLeft />}{spacer}Back to results</Button>}
                <Card>
                    <CardHeader>
                        <CardTitle>{loading ? <Spinner /> : <h1>{packageState?.name}</h1>}</CardTitle>
                        <h2>Package ID: {id}</h2>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-5">
                            {loading ? <Skeleton className="w-full h-10 col-span-12" /> :
                                <div className="col-span-6">
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="min-h-[200px]">
                                                <Base64Unzipper base64Zip={packageContent ?? ""} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            }
                            {loading ? <Skeleton className="w-full h-10 col-span-4" /> :
                                <div className="col-span-6">
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="relative min-h-[200px] flex flex-col gap-5">
                                                <div className="flex-1 w-full">
                                                    <p className="text-m text-gray-400">Package rating</p>
                                                    {rating !== null ? (
                                                        typeof rating === "string" ? (
                                                            rating
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-4">
                                                            {Array.from(rating.entries()).map(([key, value]: [string, any], index: number) => (
                                                                <React.Fragment key={index}>
                                                                    <span className="font-semibold">{key}:</span>
                                                                    <span className="text-right">{value}</span>
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                        )
                                                    ) : (
                                                        <Skeleton className="w-[100px] h-7" />
                                                    )}
                                                </div>
                                                <div className="flex-1 w-full">
                                                    <p className="text-m text-gray-400">Package cost</p>
                                                    {cost !== null ? cost : <Skeleton className="w-[100px] h-7 " />}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            }
                        </div>
                    </CardContent>
                </Card>
            </Page>
        </div>
    );
}

export default PackageDetails;