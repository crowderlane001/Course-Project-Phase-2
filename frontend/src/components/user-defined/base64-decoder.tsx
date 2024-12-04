import React, { useEffect, useState } from "react";
import JSZip from "jszip";
import { Skeleton } from "../ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "../ui/button";
import { Tooltip, TooltipTrigger, TooltipProvider, TooltipContent } from "../ui/tooltip";

interface ExtractedFile {
    fileName: string;
    fileData: Blob;
}

interface Base64UnzipperProps {
    base64Zip: string;
}

const Base64Unzipper: React.FC<Base64UnzipperProps> = ({ base64Zip }) => {
    const [files, setFiles] = useState<ExtractedFile[]>([]);
    const [isDone, setIsDone] = useState<boolean>(false);

    const handleBase64Unzip = async () => {
        // Example Base64 string representing a ZIP file

        try {
            // Step 1: Decode Base64 string to binary
            const binaryString = atob(base64Zip);
            const binaryData = new Uint8Array(
                [...binaryString].map((char) => char.charCodeAt(0))
            );

            // Step 2: Use JSZip to unzip the binary data
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(binaryData);

            // Step 3: Extract files and display them
            const extractedFiles: ExtractedFile[] = [];
            for (const fileName in zipContent.files) {
                const fileData = await zipContent.files[fileName].async("blob");
                extractedFiles.push({ fileName, fileData });
            }

            setFiles(extractedFiles);
        } catch (error) {
            console.error("Error unzipping Base64 file:", error);
        }

        setIsDone(true);
    };

    useEffect(() => {
        handleBase64Unzip();
    }, [base64Zip]);

    const truncateString = (str: string, num: number) => {
        if (str.length <= num) {
            return str;
        }
        return str.slice(0, num) + "...";
    };

    return (
        <div>
            <TooltipProvider>
                <div className="grid grid-cols-5 gap-4 items-center">
                    <h2 className="col-span-4">Files <span className="text-xs italic text-gray-400">Hover over each file to view full name</span></h2>
                    <h2>Download</h2>
                </div>
                <ScrollArea className="h-[300px] w-full rounded p-2">
                    <ul>
                        {!isDone || files.length === 0 ? (
                            <div className="flex flex-col gap-5">
                                <Skeleton className="w-[200px] h-7 " />
                                <Skeleton className="w-[100px] h-7 " />
                            </div>
                        ) : (
                            files.map((file, index) => (
                                <li key={index} className="grid grid-cols-4 gap-4 items-center">
                                    <div className="flex items-center col-span-3">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="cursor-help">{truncateString(file.fileName, 40)}</span>
                                            </TooltipTrigger>
                                            <TooltipContent sideOffset={5} side="top" align="center">
                                                {file.fileName}
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div>
                                        <Button
                                            variant="link"
                                            onClick={() => {
                                                const url = URL.createObjectURL(file.fileData);
                                                window.open(url, "_blank");
                                            }}
                                        >
                                            Download
                                        </Button>
                                    </div>
                                </li>
                            ))
                        )}

                    </ul>
                </ScrollArea>
            </TooltipProvider>
        </div>
    );
};

export default Base64Unzipper;