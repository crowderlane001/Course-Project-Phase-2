import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Page from "@/components/user-defined/page";
import { useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface PackageDetailsProps {
    isResult?: boolean;
}

function PackageDetails({ isResult = false }: PackageDetailsProps) {
    const { id } = useParams<{ id: string }>();
    const spacer = <div className="w-3 h-1"></div>

    const handleBack = () => {
        window.history.back();
    }

    return (
        <div>
            <Page>
                {isResult && <Button variant="link" onClick={handleBack}>{<ChevronLeft />}{spacer}Back to results</Button>}
                <Card>
                    <CardHeader>
                        <CardTitle><h1>Package Name</h1> </CardTitle>
                        <h2>Package ID: {id}</h2>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-8">
                                <Card>
                                    <CardContent className="p-4">
                                        <p>Package description</p>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="col-span-4">
                                <Card>
                                    <CardContent className="p-4">
                                        <p>Package score</p>
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