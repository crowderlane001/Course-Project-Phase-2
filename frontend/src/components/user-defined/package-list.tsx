import React, { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { usePackageManager } from "@/hooks/use-packagemanager";
import { Link } from "react-router-dom";
import { Skeleton } from "../ui/skeleton";

const PackageList: React.FC = () => {
    const { packages } = usePackageManager();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (packages === null || packages.size === 0) {
            const timeoutId = setTimeout(() => {
                setLoading(false);
            }, 1000);

            return () => clearTimeout(timeoutId); // Cleanup the timeout if the component unmounts
        } else {
            setLoading(false);
        }
    }, [packages]);

    if (loading) {
        return (
            <div className="flex flex-col gap-5">
                <Skeleton className="w-full h-10" />
                <Skeleton className="w-full h-10" />
                <Skeleton className="w-full h-10" />
                <Skeleton className="w-full h-10" />
            </div>
        );
    } else if (packages === null || packages.size === 0) {
        return (
            <div className="flex flex-col gap-5">
                <h2>No packages found</h2>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {Array.from(packages.values()).map((pkg, index) => (
                <Link to={`/packages/results/${pkg.id}`} key={index}>
                    <Card key={index}>
                        <CardHeader>
                            <div className="flex flex-row gap-5 items-center">
                                <h2>{pkg.name}</h2>
                                <p className="text-gray-400 text-sm">Version: {pkg.version}</p>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>
            ))}
        </div>
    );
};

export default PackageList;